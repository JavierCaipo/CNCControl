import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { organizations, PlanType } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/superadmin-guard';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'ID de organización no proporcionado.' }, { status: 400 });
    }

    const db = getDb();
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!existingOrg) {
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const updateData: Partial<typeof organizations.$inferInsert> = {};

    if (body.name !== undefined) {
      const cleanName = String(body.name).trim();
      if (!cleanName) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 });
      }
      updateData.name = cleanName;
    }

    if (body.plan !== undefined) {
      if (!['starter', 'pro', 'enterprise'].includes(body.plan)) {
        return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
      }
      updateData.plan = body.plan as PlanType;
    }

    if (body.maxMachines !== undefined) {
      const parsedMax = parseInt(String(body.maxMachines), 10);
      if (isNaN(parsedMax) || parsedMax < 1) {
        return NextResponse.json({ error: 'El límite de máquinas debe ser mayor a 0.' }, { status: 400 });
      }
      updateData.maxMachines = parsedMax;
    }

    if (body.active !== undefined) {
      updateData.active = Boolean(body.active);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ organization: existingOrg });
    }

    const [updatedOrg] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, id))
      .returning();

    return NextResponse.json({ organization: updatedOrg });
  } catch (error) {
    console.error('Error al actualizar organización:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la organización.' },
      { status: 500 }
    );
  }
}

