import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { createSessionToken, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { userId?: string; pin?: string };
    const { userId, pin } = body;

    if (!userId || !pin) {
      return NextResponse.json(
        { error: 'Debes seleccionar un operario e ingresar el PIN.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const foundUsers = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.role, 'operario'), eq(users.active, true)))
      .limit(1);

    const user = foundUsers[0];
    if (!user || !user.pinHash) {
      return NextResponse.json(
        { error: 'Operario no encontrado o sin PIN configurado.' },
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

    const token = await createSessionToken({
      userId: user.id,
      name: user.name,
      role: 'operario',
      email: user.email,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error en login-pin:', error);
    return NextResponse.json(
      { error: 'Error al procesar el inicio de sesión del operario.' },
      { status: 500 }
    );
  }
}
