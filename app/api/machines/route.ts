import { NextResponse } from 'next/server';
import { eq, and, asc, count } from 'drizzle-orm';
import { getDb } from '@/db';
import { machines, organizations } from '@/db/schema';
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
        .where(eq(organizations.slug, orgSlug.toLowerCase().trim()))
        .limit(1);
      targetOrgId = org[0]?.id || null;
    }

    if (!targetOrgId) {
      return NextResponse.json(
        { error: 'Se requiere especificar la organización.' },
        { status: 400 }
      );
    }

    const conditions = [eq(machines.organizationId, targetOrgId)];

    // Si el usuario no es gerente ni superadmin (ej. pantalla pública o planta sin auth de gestión),
    // solo mostramos las máquinas activas a menos que explícitamente se pida
    const isManagerOrSuperAdmin =
      session && (session.role === 'gerente' || session.role === 'superadmin');

    if (!isManagerOrSuperAdmin) {
      conditions.push(eq(machines.active, true));
    }

    const machineList = await db
      .select({
        id: machines.id,
        organizationId: machines.organizationId,
        code: machines.code,
        name: machines.name,
        model: machines.model,
        serialNumber: machines.serialNumber,
        active: machines.active,
        createdAt: machines.createdAt,
      })
      .from(machines)
      .where(and(...conditions))
      .orderBy(asc(machines.code));

    return NextResponse.json({ machines: machineList });
  } catch (error) {
    console.error('Error al obtener máquinas:', error);
    return NextResponse.json(
      { error: 'Error al consultar las máquinas.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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
    const body = await request.json().catch(() => ({}));
    const { code, name, model, serialNumber, organizationId } = body;

    const targetOrgId =
      session.role === 'superadmin' && organizationId
        ? organizationId
        : session.organizationId;

    if (!targetOrgId) {
      return NextResponse.json(
        { error: 'Organización no identificada.' },
        { status: 400 }
      );
    }

    const cleanCode = String(code || '').trim().toUpperCase();
    const cleanName = String(name || '').trim();
    const cleanModel = model ? String(model).trim() : null;
    const cleanSerial = serialNumber ? String(serialNumber).trim() : null;

    if (!cleanCode) {
      return NextResponse.json(
        { error: 'El código de la máquina es obligatorio (ej. SF3015HM).' },
        { status: 400 }
      );
    }
    if (!cleanName) {
      return NextResponse.json(
        { error: 'El nombre de la máquina es obligatorio.' },
        { status: 400 }
      );
    }

    const db = getDb();

    // 1. Obtener la organización y su límite de máquinas
    const [org] = await db
      .select({ maxMachines: organizations.maxMachines, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, targetOrgId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: 'Organización no encontrada.' },
        { status: 404 }
      );
    }

    // 2. Validación de cuota del plan: contar máquinas activas actuales
    const [countResult] = await db
      .select({ value: count() })
      .from(machines)
      .where(and(eq(machines.organizationId, targetOrgId), eq(machines.active, true)));

    const activeCount = Number(countResult?.value || 0);

    if (activeCount >= org.maxMachines) {
      return NextResponse.json(
        {
          error: `Has alcanzado el límite de ${org.maxMachines} máquina(s) permitido para tu plan. Contacta al administrador para ampliar tu cuota.`,
          maxMachines: org.maxMachines,
          activeCount,
        },
        { status: 403 }
      );
    }

    // 3. Validar unicidad del código dentro de la misma organización
    const existing = await db
      .select({ id: machines.id })
      .from(machines)
      .where(and(eq(machines.organizationId, targetOrgId), eq(machines.code, cleanCode)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Ya existe una máquina con el código '${cleanCode}' en esta organización.` },
        { status: 400 }
      );
    }

    // 4. Insertar máquina
    const [newMachine] = await db
      .insert(machines)
      .values({
        organizationId: targetOrgId,
        code: cleanCode,
        name: cleanName,
        model: cleanModel,
        serialNumber: cleanSerial,
        active: true,
      })
      .returning();

    return NextResponse.json({ machine: newMachine }, { status: 201 });
  } catch (error) {
    console.error('Error al crear máquina:', error);
    return NextResponse.json(
      { error: 'Error al registrar la máquina.' },
      { status: 500 }
    );
  }
}

