import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, organizations } from '@/db/schema';
import { createSessionToken, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { userId?: string; pin?: string };
    const { userId, pin } = body;

    if (!userId || !pin) {
      return NextResponse.json(
        { error: 'Debes seleccionar tu usuario e ingresar el PIN.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const foundUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), inArray(users.role, ['operario', 'supervisor']), eq(users.active, true)))
      .limit(1);

    const user = foundUsers[0];
    if (!user || !user.pinHash) {
      return NextResponse.json(
        { error: 'Usuario no encontrado o sin PIN configurado.' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(String(pin), user.pinHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'PIN incorrecto. Inténtalo de nuevo.' },
        { status: 401 }
      );
    }

    let organizationSlug: string | null = null;
    if (user.organizationId) {
      const orgs = await db
        .select({ slug: organizations.slug, active: organizations.active })
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);
      const org = orgs[0];
      if (org && !org.active) {
        return NextResponse.json(
          { error: 'La organización se encuentra suspendida. Contacta al administrador.' },
          { status: 403 }
        );
      }
      organizationSlug = org?.slug ?? null;
    }

    const token = await createSessionToken({
      userId: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      organizationId: user.organizationId,
      organizationSlug,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationSlug,
      },
    });
  } catch (error) {
    console.error('Error en login-pin:', error);
    return NextResponse.json(
      { error: 'Error al procesar el inicio de sesión con PIN.' },
      { status: 500 }
    );
  }
}
