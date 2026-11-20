import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, lte, or, desc } from 'drizzle-orm';
import { db } from '@/db';
import { reviewSnapshots, machines } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { CHECKS } from '@/lib/cnc-model';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
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

    // Filtros de fecha (por defecto últimos 30 días)
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const machineParam = searchParams.get('machineId');

    const fromDate = fromParam ? new Date(fromParam) : defaultFrom;
    const toDate = toParam ? new Date(toParam) : now;

    const conditions = [];

    if (orgId) {
      conditions.push(eq(reviewSnapshots.organizationId, orgId));
    }

    if (!isNaN(fromDate.getTime())) {
      conditions.push(gte(reviewSnapshots.createdAt, fromDate));
    }
    if (!isNaN(toDate.getTime())) {
      conditions.push(lte(reviewSnapshots.createdAt, toDate));
    }

    if (machineParam && machineParam !== 'all') {
      conditions.push(
        or(
          eq(reviewSnapshots.machineId, machineParam),
          eq(machines.code, machineParam)
        )
      );
    }

    const rows = await db
      .select({
        id: reviewSnapshots.id,
        shift: reviewSnapshots.shift,
        workOrder: reviewSnapshots.workOrder,
        status: reviewSnapshots.status,
        checklistPayload: reviewSnapshots.checklistPayload,
        incidentsCount: reviewSnapshots.incidentsCount,
        evidenceUrls: reviewSnapshots.evidenceUrls,
        supervisorApprovedAt: reviewSnapshots.supervisorApprovedAt,
        createdAt: reviewSnapshots.createdAt,
        machineId: machines.id,
        machineCode: machines.code,
        machineName: machines.name,
      })
      .from(reviewSnapshots)
      .innerJoin(machines, eq(reviewSnapshots.machineId, machines.id))
      .where(and(...conditions))
      .orderBy(desc(reviewSnapshots.createdAt));

    // Cálculos de KPIs
    const totalSnapshots = rows.length;
    const okCount = rows.filter((r) => r.status === 'ok').length;
    const warningCount = rows.filter((r) => r.status === 'warning').length;
    const criticalCount = rows.filter((r) => r.status === 'critical').length;
    const complianceRate =
      totalSnapshots > 0
        ? Math.round(((totalSnapshots - criticalCount) / totalSnapshots) * 1000) / 10
        : 100;
    const pendingApprovals = rows.filter((r) => !r.supervisorApprovedAt).length;

    // 1. Tendencia diaria (Daily Trend)
    const dailyMap = new Map<string, { date: string; total: number; ok: number; warning: number; critical: number }>();

    for (const r of rows) {
      const dStr = new Date(r.createdAt).toISOString().slice(0, 10);
      let day = dailyMap.get(dStr);
      if (!day) {
        day = { date: dStr, total: 0, ok: 0, warning: 0, critical: 0 };
        dailyMap.set(dStr, day);
      }
      day.total += 1;
      if (r.status === 'ok') day.ok += 1;
      else if (r.status === 'warning') day.warning += 1;
      else if (r.status === 'critical') day.critical += 1;
    }

    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 2. Top 5 Fallas Recurrentes (Checklist)
    const faultCounts: Record<string, number> = {};
    for (const r of rows) {
      const payload = r.checklistPayload as { checks?: Record<string, { value?: string }> };
      const checks = payload?.checks || {};
      for (const [key, check] of Object.entries(checks)) {
        if (check?.value === 'fault') {
          faultCounts[key] = (faultCounts[key] || 0) + 1;
        }
      }
    }

    const topRecurringFaults = Object.entries(faultCounts)
      .map(([id, count]) => {
        const itemDef = CHECKS.find((c) => c.id === id);
        return {
          id,
          title: itemDef?.title || id,
          group: itemDef?.group || 'General',
          count,
          percentage: totalSnapshots > 0 ? Math.round((count / totalSnapshots) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 3. Desglose por máquina (Machine Breakdown)
    const machineMap = new Map<
      string,
      {
        machineId: string;
        code: string;
        name: string;
        totalSnapshots: number;
        okCount: number;
        warningCount: number;
        criticalCount: number;
      }
    >();

    for (const r of rows) {
      let m = machineMap.get(r.machineId);
      if (!m) {
        m = {
          machineId: r.machineId,
          code: r.machineCode,
          name: r.machineName,
          totalSnapshots: 0,
          okCount: 0,
          warningCount: 0,
          criticalCount: 0,
        };
        machineMap.set(r.machineId, m);
      }
      m.totalSnapshots += 1;
      if (r.status === 'ok') m.okCount += 1;
      else if (r.status === 'warning') m.warningCount += 1;
      else if (r.status === 'critical') m.criticalCount += 1;
    }

    const machineBreakdown = Array.from(machineMap.values()).map((m) => ({
      ...m,
      complianceRate:
        m.totalSnapshots > 0
          ? Math.round(((m.totalSnapshots - m.criticalCount) / m.totalSnapshots) * 1000) / 10
          : 100,
    }));

    return NextResponse.json({
      summary: {
        totalSnapshots,
        okCount,
        warningCount,
        criticalCount,
        complianceRate,
        pendingApprovals,
        dailyTrend,
        topRecurringFaults,
        machineBreakdown,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al calcular analítica.';
    console.error('Error en GET /api/analytics/summary:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

