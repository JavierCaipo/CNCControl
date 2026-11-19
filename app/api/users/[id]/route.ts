import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { users, UserRole } from '@/db/schema';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }
  if (session.role !== 'gerente') {
    return NextResponse.json({ error: 'Acceso restringido a gerentes.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'ID de usuario no proporcionado.' }, { status: 400 });
  }

  try {
    const db = getDb();
    const existingList = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const existing = existingList[0];

    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      role?: string;
      active?: boolean;
      pin?: string;
      password?: string;
    };

    const { name, role, active, pin, password } = body;
    const updates: Partial<typeof users.$inferInsert> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (role !== undefined) {
      if (!['gerente', 'supervisor', 'operario'].includes(role)) {
        return NextResponse.json({ error: "Rol no válido ('gerente', 'supervisor' o 'operario')." }, { status: 400 });
      }
      updates.role = role as UserRole;
    }

    if (active !== undefined) {
      updates.active = Boolean(active);
    }

    if (pin !== undefined && pin !== null) {
      const pinStr = String(pin).trim();
      if (pinStr.length > 0) {
        if (pinStr.length < 4) {
          return NextResponse.json({ error: 'El PIN debe tener al menos 4 dígitos.' }, { status: 400 });
        }
        updates.pinHash = await bcrypt.hash(pinStr, 10);
      }
    }

    if (password !== undefined && password !== null) {
      const pwdStr = String(password).trim();
      if (pwdStr.length > 0) {
        if (pwdStr.length < 6) {
          return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
        }
        updates.passwordHash = await bcrypt.hash(pwdStr, 10);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No se enviaron campos válidos para actualizar.' }, { status: 400 });
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        role: users.role,
        email: users.email,
        active: users.active,
        createdAt: users.createdAt,
      });

    return NextResponse.json({ ok: true, user: updatedUser });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return NextResponse.json({ error: 'Error al actualizar el usuario.' }, { status: 500 });
  }
}

