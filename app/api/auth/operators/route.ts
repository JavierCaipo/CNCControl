import { NextResponse } from 'next/server';
import { and, asc, inArray, eq } from 'drizzle-orm';
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
        role: users.role,
      })
      .from(users)
      .where(and(inArray(users.role, ['operario', 'supervisor']), eq(users.active, true)))
      .orderBy(asc(users.name));

    return NextResponse.json({ operators });
  } catch (error) {
    console.error('Error al obtener operarios y supervisores:', error);
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de operarios y supervisores activos.' },
      { status: 500 }
    );
  }
}

