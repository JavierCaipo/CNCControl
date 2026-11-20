import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, lte, or, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { reviewSnapshots, machines, users } from '@/db/schema';
import { getSession } from '@/lib/auth';

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!['gerente', 'supervisor', 'superadmin'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Acceso restringido a Gerencia y Supervisión.' },
        { status: 403 }
      );
    }

    if (!db) {
      return NextResponse.json({ error: 'Base de datos no disponible.' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = session.organizationId;
    if (!orgId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Usuario sin organización asignada.' }, { status: 403 });
    }

    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const machineParam = searchParams.get('machineId');
    const statusParam = searchParams.get('status');

    const conditions = [];

    if (orgId) {
      conditions.push(eq(reviewSnapshots.organizationId, orgId));
    }

    if (fromParam) {
      const fromDate = new Date(fromParam);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(reviewSnapshots.createdAt, fromDate));
      }
    }

    if (toParam) {
      const toDate = new Date(toParam);
      if (!isNaN(toDate.getTime())) {
        conditions.push(lte(reviewSnapshots.createdAt, toDate));
      }
    }

    if (machineParam && machineParam !== 'all') {
      conditions.push(
        or(
          eq(reviewSnapshots.machineId, machineParam),
          eq(machines.code, machineParam)
        )
      );
    }

    if (statusParam && ['ok', 'warning', 'critical'].includes(statusParam)) {
      conditions.push(eq(reviewSnapshots.status, statusParam as 'ok' | 'warning' | 'critical'));
    }

    const supervisorTable = alias(users, 'supervisor');

    const rows = await db
      .select({
        id: reviewSnapshots.id,
        shift: reviewSnapshots.shift,
        workOrder: reviewSnapshots.workOrder,
        status: reviewSnapshots.status,
        incidentsCount: reviewSnapshots.incidentsCount,
        evidenceUrls: reviewSnapshots.evidenceUrls,
        supervisorApprovedAt: reviewSnapshots.supervisorApprovedAt,
        createdAt: reviewSnapshots.createdAt,
        machineCode: machines.code,
        machineName: machines.name,
        operatorName: users.name,
        supervisorName: supervisorTable.name,
      })
      .from(reviewSnapshots)
      .innerJoin(machines, eq(reviewSnapshots.machineId, machines.id))
      .innerJoin(users, eq(reviewSnapshots.operatorId, users.id))
      .leftJoin(supervisorTable, eq(reviewSnapshots.supervisorId, supervisorTable.id))
      .where(and(...conditions))
      .orderBy(desc(reviewSnapshots.createdAt));

    // Generar CSV con BOM UTF-8 (\uFEFF) para compatibilidad con Excel
    const headers = [
      'Fecha',
      'Hora',
      'Máquina',
      'Código',
      'Operario',
      'OT',
      'Turno',
      'Estado',
      'Incidencias',
      'Validado Por',
      'Fecha Validación',
      'URLs de Evidencia',
    ];

    const csvRows = [headers.map(escapeCsvField).join(',')];

    for (const r of rows) {
      const d = new Date(r.createdAt);
      const fecha = d.toISOString().slice(0, 10);
      const hora = d.toTimeString().slice(0, 8);
      const estado =
        r.status === 'ok' ? 'Conforme' : r.status === 'warning' ? 'Alerta' : 'Crítico';
      const validadoPor = r.supervisorApprovedAt ? (r.supervisorName || 'Supervisor') : 'Pendiente';
      const fechaValidacion = r.supervisorApprovedAt
        ? new Date(r.supervisorApprovedAt).toISOString().slice(0, 19).replace('T', ' ')
        : 'Pendiente';
      const fotos = Array.isArray(r.evidenceUrls) ? r.evidenceUrls.join(' | ') : '';

      const line = [
        escapeCsvField(fecha),
        escapeCsvField(hora),
        escapeCsvField(r.machineName),
        escapeCsvField(r.machineCode),
        escapeCsvField(r.operatorName),
        escapeCsvField(r.workOrder || 'N/A'),
        escapeCsvField(r.shift),
        escapeCsvField(estado),
        escapeCsvField(r.incidentsCount),
        escapeCsvField(validadoPor),
        escapeCsvField(fechaValidacion),
        escapeCsvField(fotos),
      ];

      csvRows.push(line.join(','));
    }

    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.join('\r\n');
    const filename = `reporte-revisiones-cnc-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al exportar CSV.';
    console.error('Error en GET /api/snapshots/export:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

