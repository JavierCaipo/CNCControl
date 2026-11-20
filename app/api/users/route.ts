import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { desc, eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, UserRole } from '@/db/schema';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  if (session.role !== 'gerente' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Acceso restringido a gerentes y administradores.' }, { status: 403 });
  }

  try {
    const db = getDb();
    const conditions = [];

    // Si no es superadmin, aislamos por organización
    if (session.role !== 'superadmin' && session.organizationId) {
      conditions.push(eq(users.organizationId, session.organizationId));
    }

    const allUsers = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        name: users.name,
        role: users.role,
        email: users.email,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ users: allUsers });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return NextResponse.json({ error: 'Error al consultar los usuarios.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  if (session.role !== 'gerente' && session.role !== 'superadmin') {
    return NextResponse.json({ error: 'Acceso restringido a gerentes y administradores.' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      role?: string;
      email?: string;
      password?: string;
      pin?: string;
      active?: boolean;
      organizationId?: string;
    };

    const { name, role, email, password, pin, active } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }

    if (!role || !['superadmin', 'gerente', 'supervisor', 'operario'].includes(role)) {
      return NextResponse.json({ error: "El rol debe ser 'gerente', 'supervisor', 'operario' o 'superadmin'." }, { status: 400 });
    }

    const cleanName = name.trim();
    const userRole = role as UserRole;
    let cleanEmail: string | null = null;
    let passwordHash: string | null = null;
    let pinHash: string | null = null;

    if (userRole === 'gerente' || userRole === 'superadmin') {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return NextResponse.json({ error: 'El correo electrónico es obligatorio para gerentes y administradores.' }, { status: 400 });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
      }

      cleanEmail = email.trim().toLowerCase();
      const db = getDb();
      const existing = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      if (existing.length > 0) {
        return NextResponse.json({ error: 'El correo electrónico ya se encuentra registrado.' }, { status: 409 });
      }

      passwordHash = await bcrypt.hash(password, 10);
    } else {
      // operario o supervisor
      if (!pin || String(pin).trim().length < 4) {
        return NextResponse.json({ error: 'El PIN numérico debe tener al menos 4 dígitos.' }, { status: 400 });
      }

      pinHash = await bcrypt.hash(String(pin).trim(), 10);
      if (email && typeof email === 'string' && email.includes('@')) {
        cleanEmail = email.trim().toLowerCase();
      }
    }

    const targetOrgId =
      session.role === 'superadmin' && body.organizationId !== undefined
        ? body.organizationId || null
        : session.organizationId || null;

    const db = getDb();
    const [newUser] = await db
      .insert(users)
      .values({
        organizationId: targetOrgId,
        name: cleanName,
        role: userRole,
        email: cleanEmail,
        passwordHash,
        pinHash,
        active: active !== undefined ? Boolean(active) : true,
      })
      .returning({
        id: users.id,
        organizationId: users.organizationId,
        name: users.name,
        role: users.role,
        email: users.email,
        active: users.active,
        createdAt: users.createdAt,
      });

    return NextResponse.json({ ok: true, user: newUser }, { status: 201 });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return NextResponse.json({ error: 'Error al crear el usuario.' }, { status: 500 });
  }
}
