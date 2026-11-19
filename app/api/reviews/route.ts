import { NextResponse } from 'next/server';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { reviews } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { handleReviews } from '../../../server/review-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Inicia sesión con la cuenta autorizada para acceder al registro compartido.' },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const isHistoryQuery =
    url.searchParams.has('history') ||
    url.searchParams.has('machine') ||
    url.searchParams.has('status') ||
    url.searchParams.has('date') ||
    url.searchParams.has('all');

  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    db = null;
  }

  if (isHistoryQuery && db) {
    try {
      const conditions = [];

      // Filtro de rol: el operario solo puede ver sus propios registros
      if (session.role === 'operario') {
        conditions.push(eq(reviews.userId, session.userId));
      }

      // Filtro por máquina
      const machine = url.searchParams.get('machine') || url.searchParams.get('machineId');
      if (machine) {
        conditions.push(eq(reviews.machineId, machine));
      }

      // Filtro por estado ('ok' | 'warning' | 'critical')
      const status = url.searchParams.get('status');
      if (status) {
        conditions.push(eq(reviews.status, status as 'ok' | 'warning' | 'critical'));
      }

      // Filtro por fecha (YYYY-MM-DD)
      const dateStr = url.searchParams.get('date');
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const startOfDay = new Date(`${dateStr}T00:00:00Z`);
        const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
        conditions.push(gte(reviews.createdAt, startOfDay));
        conditions.push(lte(reviews.createdAt, endOfDay));
      }

      const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);

      const rows = await db
        .select({
          id: reviews.id,
          userId: reviews.userId,
          machineId: reviews.machineId,
          machineName: reviews.machineName,
          status: reviews.status,
          revision: reviews.revision,
          updatedAt: reviews.updatedAt,
          updatedByName: reviews.updatedByName,
          createdAt: reviews.createdAt,
          payload: reviews.payload,
        })
        .from(reviews)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(reviews.createdAt))
        .limit(limit);

      return NextResponse.json({
        reviews: rows,
        user: {
          id: session.userId,
          name: session.name,
          role: session.role,
        },
      });
    } catch (err) {
      console.error('Error al consultar historial de revisiones:', err);
      return NextResponse.json(
        { error: 'Error al consultar el historial de revisiones.' },
        { status: 500 }
      );
    }
  }

  // Petición estándar del checklist en vivo
  return handleReviews(request, { db, user: session });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Inicia sesión con la cuenta autorizada para registrar la revisión.' },
      { status: 401 }
    );
  }

  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    db = null;
  }

  return handleReviews(request, { db, user: session });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Inicia sesión con la cuenta autorizada para actualizar la revisión.' },
      { status: 401 }
    );
  }

  let db: ReturnType<typeof getDb> | null = null;
  try {
    db = getDb();
  } catch {
    db = null;
  }

  return handleReviews(request, { db, user: session });
}
