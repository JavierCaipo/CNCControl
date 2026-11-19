import { NextResponse } from 'next/server';
import { eq, and, asc } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const operators = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(and(eq(users.role, 'operario'), eq(users.active, true)))
      .orderBy(asc(users.name));

    return NextResponse.json({ operators });
  } catch (error) {
    console.error('Error al obtener operarios:', error);
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de operarios activos.' },
      { status: 500 }
    );
  }
}

