import { NextResponse } from 'next/server';
import { eq, and, count } from 'drizzle-orm';
import { getDb } from '@/db';
import { machines, organizations } from '@/db/schema';
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

  if (session.role !== 'gerente' && session.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'Acceso restringido a gerentes y administradores.' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID de máquina no proporcionado.' }, { status: 400 });
    }

    const db = getDb();

    // 1. Obtener la máquina existente
    const [existingMachine] = await db
      .select()
      .from(machines)
      .where(eq(machines.id, id))
      .limit(1);

    if (!existingMachine) {
      return NextResponse.json({ error: 'Máquina no encontrada.' }, { status: 404 });
    }

    // 2. Validar que pertenezca a la misma organización del usuario (salvo superadmin)
    if (session.role !== 'superadmin' && existingMachine.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'No tienes permiso para modificar máquinas de otra organización.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const updateData: Partial<typeof machines.$inferInsert> = {};

    if (body.name !== undefined) {
      const cleanName = String(body.name).trim();
      if (!cleanName) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 });
      }
      updateData.name = cleanName;
    }

    if (body.model !== undefined) {
      updateData.model = body.model ? String(body.model).trim() : null;
    }

    if (body.serialNumber !== undefined) {
      updateData.serialNumber = body.serialNumber ? String(body.serialNumber).trim() : null;
    }

    if (body.active !== undefined) {
      const nextActive = Boolean(body.active);

      // Si se está reactivando una máquina que estaba inactiva, verificar límite del plan
      if (nextActive && !existingMachine.active) {
        const [org] = await db
          .select({ maxMachines: organizations.maxMachines })
          .from(organizations)
          .where(eq(organizations.id, existingMachine.organizationId))
          .limit(1);

        if (org) {
          const [activeCountRes] = await db
            .select({ value: count() })
            .from(machines)
            .where(
              and(
                eq(machines.organizationId, existingMachine.organizationId),
                eq(machines.active, true)
              )
            );
          const activeCount = Number(activeCountRes?.value || 0);

          if (activeCount >= org.maxMachines) {
            return NextResponse.json(
              {
                error: `No puedes reactivar esta máquina porque alcanzaste el límite de ${org.maxMachines} máquinas de tu plan.`,
              },
              { status: 403 }
            );
          }
        }
      }

      updateData.active = nextActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ machine: existingMachine });
    }

    const [updatedMachine] = await db
      .update(machines)
      .set(updateData)
      .where(eq(machines.id, id))
      .returning();

    return NextResponse.json({ machine: updatedMachine });
  } catch (error) {
    console.error('Error al actualizar máquina:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la máquina.' },
      { status: 500 }
    );
  }
}

