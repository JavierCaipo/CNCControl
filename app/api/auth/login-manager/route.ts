import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq, and, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, organizations } from '@/db/schema';
import { createSessionToken, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Ingresa tu correo y contraseña.' },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const db = getDb();
    const foundUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.email, cleanEmail), inArray(users.role, ['gerente', 'superadmin']), eq(users.active, true)))
      .limit(1);

    const user = foundUsers[0];
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Credenciales inválidas o acceso no autorizado.' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Credenciales inválidas.' },
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
      if (user.role !== 'superadmin' && org && !org.active) {
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
        email: user.email,
        organizationId: user.organizationId,
        organizationSlug,
      },
    });
  } catch (error) {
    console.error('Error en login-manager:', error);
    return NextResponse.json(
      { error: 'Error al procesar el inicio de sesión del gerente.' },
      { status: 500 }
    );
  }
}
