import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { reviewSnapshots } from '@/db/schema';
import { getSession } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
    }

    // Solo supervisores, gerentes o superadmin pueden validar
    if (!['supervisor', 'gerente', 'superadmin'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Solo supervisores o gerentes pueden validar una revisión.' },
        { status: 403 }
      );
    }

    if (!db) {
      return NextResponse.json({ error: 'Base de datos no disponible.' }, { status: 503 });
    }

    const { id } = await params;

    // Buscar el snapshot
    const [snapshot] = await db
      .select()
      .from(reviewSnapshots)
      .where(eq(reviewSnapshots.id, id));

    if (!snapshot) {
      return NextResponse.json({ error: 'Registro de revisión no encontrado.' }, { status: 404 });
    }

    // Aislamiento por organización
    if (session.role !== 'superadmin' && snapshot.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'No autorizado para validar revisiones de otra organización.' },
        { status: 403 }
      );
    }

    // Prevenir doble aprobación
    if (snapshot.supervisorApprovedAt) {
      return NextResponse.json(
        { error: 'Esta revisión ya ha sido aprobada y validada formalmente.' },
        { status: 400 }
      );
    }

    // Registrar validación formal
    const [updated] = await db
      .update(reviewSnapshots)
      .set({
        supervisorId: session.userId,
        supervisorApprovedAt: new Date(),
      })
      .where(eq(reviewSnapshots.id, id))
      .returning();

    return NextResponse.json({
      snapshot: updated,
      message: 'Revisión validada y firmada exitosamente.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al validar la revisión.';
    console.error('Error en PATCH /api/snapshots/[id]/approve:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

