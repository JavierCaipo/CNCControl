import { NextResponse } from 'next/server';
import { and, asc, inArray, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, organizations } from '@/db/schema';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const url = new URL(request.url);
    const orgSlug = url.searchParams.get('org');
    const orgIdParam = url.searchParams.get('orgId');

    const db = getDb();
    let targetOrgId: string | null = session?.organizationId || orgIdParam || null;

    if (!targetOrgId && orgSlug) {
      const org = await db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, orgSlug))
        .limit(1);
      targetOrgId = org[0]?.id || null;
    }

    const conditions = [
      inArray(users.role, ['operario', 'supervisor']),
      eq(users.active, true),
    ];

    if (targetOrgId) {
      conditions.push(eq(users.organizationId, targetOrgId));
    }

    const operators = await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        organizationId: users.organizationId,
      })
      .from(users)
      .where(and(...conditions))
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
