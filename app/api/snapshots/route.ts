import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, gte, lte, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/db';
import { reviewSnapshots, machines, users, reviews } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { validateReviewQuality, newInspection } from '@/lib/cnc-model';
import { sendCriticalAlert } from '@/lib/alerts';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Base de datos no disponible.' }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const machineParam = searchParams.get('machineId');
    const statusParam = searchParams.get('status');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const onlyPendingParam = searchParams.get('onlyPendingApproval');

    const orgId = session.organizationId;
    if (!orgId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Usuario sin organización asignada.' }, { status: 403 });
    }

    // Build conditions
    const conditions = [];

    if (orgId) {
      conditions.push(eq(reviewSnapshots.organizationId, orgId));
    }

    // Operarios solo ven sus propios turnos cerrados
    if (session.role === 'operario') {
      conditions.push(eq(reviewSnapshots.operatorId, session.userId));
    }

    if (machineParam) {
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

    if (onlyPendingParam === 'true') {
      conditions.push(isNull(reviewSnapshots.supervisorApprovedAt));
    }

    const supervisorTable = alias(users, 'supervisor');

    const rows = await db
      .select({
        id: reviewSnapshots.id,
        organizationId: reviewSnapshots.organizationId,
        machineId: reviewSnapshots.machineId,
        operatorId: reviewSnapshots.operatorId,
        supervisorId: reviewSnapshots.supervisorId,
        shift: reviewSnapshots.shift,
        workOrder: reviewSnapshots.workOrder,
        status: reviewSnapshots.status,
        checklistPayload: reviewSnapshots.checklistPayload,
        incidentsCount: reviewSnapshots.incidentsCount,
        evidenceUrls: reviewSnapshots.evidenceUrls,
        supervisorApprovedAt: reviewSnapshots.supervisorApprovedAt,
        createdAt: reviewSnapshots.createdAt,
        machine: {
          id: machines.id,
          code: machines.code,
          name: machines.name,
          model: machines.model,
        },
        operator: {
          id: users.id,
          name: users.name,
          role: users.role,
        },
        supervisor: {
          id: supervisorTable.id,
          name: supervisorTable.name,
          role: supervisorTable.role,
        },
      })
      .from(reviewSnapshots)
      .innerJoin(machines, eq(reviewSnapshots.machineId, machines.id))
      .innerJoin(users, eq(reviewSnapshots.operatorId, users.id))
      .leftJoin(supervisorTable, eq(reviewSnapshots.supervisorId, supervisorTable.id))
      .where(and(...conditions))
      .orderBy(desc(reviewSnapshots.createdAt));

    return NextResponse.json({ snapshots: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener snapshots.';
    console.error('Error en GET /api/snapshots:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Base de datos no disponible.' }, { status: 503 });
    }

    const orgId = session.organizationId;
    if (!orgId && session.role !== 'superadmin') {
      return NextResponse.json({ error: 'Usuario sin organización asignada.' }, { status: 403 });
    }

    const body = await req.json();
    const { machineId, shift, workOrder, checklistPayload, incidentsCount, evidenceUrls } = body;

    if (!machineId) {
      return NextResponse.json({ error: 'Falta especificar la máquina (machineId).' }, { status: 400 });
    }

    // Resolver la máquina perteneciente a la organización
    const machineConditions = [
      or(eq(machines.id, machineId), eq(machines.code, machineId)),
    ];
    if (orgId) {
      machineConditions.push(eq(machines.organizationId, orgId));
    }

    const [machine] = await db
      .select()
      .from(machines)
      .where(and(...machineConditions));

    if (!machine) {
      return NextResponse.json(
        { error: 'Máquina no encontrada o no pertenece a su organización.' },
        { status: 404 }
      );
    }

    const targetOrgId = machine.organizationId;

    // Validación de calidad estricta
    const checks = checklistPayload?.checks || {};
    const incidents = checklistPayload?.incidents || [];
    const photos = Array.isArray(evidenceUrls) ? evidenceUrls : [];

    const quality = validateReviewQuality({
      checks,
      incidents,
      evidenceUrls: photos,
    });

    if (!quality.valid) {
      return NextResponse.json(
        {
          error: 'Regla de calidad no superada. Turno bloqueado.',
          details: quality.errors,
        },
        { status: 400 }
      );
    }

    // Insertar registro inmutable append-only
    const [snapshot] = await db
      .insert(reviewSnapshots)
      .values({
        organizationId: targetOrgId,
        machineId: machine.id,
        operatorId: session.userId,
        shift: shift || 'Turno 1',
        workOrder: workOrder || '',
        status: quality.calculatedStatus,
        checklistPayload: checklistPayload || {},
        incidentsCount: Number(incidentsCount) || incidents.length,
        evidenceUrls: photos,
      })
      .returning();

    // Disparar alerta automática de webhook si el estado es crítico (no bloqueante)
    if (quality.calculatedStatus === 'critical') {
      sendCriticalAlert({
        organizationId: targetOrgId,
        snapshot,
        machine: {
          id: machine.id,
          code: machine.code,
          name: machine.name,
        },
        operator: {
          id: session.userId,
          name: session.name,
        },
      }).catch((alertErr) => {
        console.error('Error al disparar alerta de webhook:', alertErr);
      });
    }

    // Limpiar o reiniciar el borrador en vivo en reviews para esta máquina
    try {
      await db
        .update(reviews)
        .set({
          payload: {
            current: newInspection(),
            history: [],
          },
          status: 'ok',
          revision: sql`${reviews.revision} + 1`,
          updatedAt: new Date(),
          updatedById: session.userId,
          updatedByName: session.name,
        })
        .where(
          and(
            eq(reviews.organizationId, targetOrgId),
            eq(reviews.machineId, machine.code)
          )
        );
    } catch (cleanupErr) {
      console.warn('Aviso al reiniciar borrador de reviews:', cleanupErr);
    }

    return NextResponse.json(
      {
        snapshot,
        message: 'Turno cerrado y registrado exitosamente en el historial inmutable.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al cerrar y registrar el turno.';
    console.error('Error en POST /api/snapshots:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

