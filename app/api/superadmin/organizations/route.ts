import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { desc, eq, sql, isNotNull } from 'drizzle-orm';
import { getDb } from '@/db';
import { organizations, machines, users, reviewSnapshots, PlanType } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/superadmin-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const db = getDb();
    const orgs = await db
      .select()
      .from(organizations)
      .orderBy(desc(organizations.createdAt));

    const [machineCounts, userCounts, snapshotCounts] = await Promise.all([
      db
        .select({
          organizationId: machines.organizationId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(machines)
        .groupBy(machines.organizationId),
      db
        .select({
          organizationId: users.organizationId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(users)
        .where(isNotNull(users.organizationId))
        .groupBy(users.organizationId),
      db
        .select({
          organizationId: reviewSnapshots.organizationId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(reviewSnapshots)
        .groupBy(reviewSnapshots.organizationId),
    ]);

    const machineMap = new Map(machineCounts.map((m) => [m.organizationId, Number(m.count) || 0]));
    const userMap = new Map(userCounts.map((u) => [u.organizationId!, Number(u.count) || 0]));
    const snapshotMap = new Map(snapshotCounts.map((s) => [s.organizationId, Number(s.count) || 0]));

    const result = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl,
      plan: org.plan,
      maxMachines: org.maxMachines,
      active: org.active,
      createdAt: org.createdAt,
      machinesCount: machineMap.get(org.id) ?? 0,
      usersCount: userMap.get(org.id) ?? 0,
      snapshotsCount: snapshotMap.get(org.id) ?? 0,
    }));

    return NextResponse.json({ organizations: result });
  } catch (error) {
    console.error('Error al listar organizaciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener la lista de organizaciones.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      name,
      slug,
      plan = 'starter',
      maxMachines = 5,
      managerName,
      managerEmail,
      managerPassword,
    } = body;

    const cleanName = String(name || '').trim();
    const cleanSlug = String(slug || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    const cleanPlan = (['starter', 'pro', 'enterprise'].includes(plan) ? plan : 'starter') as PlanType;
    const cleanMaxMachines = Math.max(1, parseInt(String(maxMachines), 10) || 5);
    const cleanManagerName = String(managerName || '').trim();
    const cleanManagerEmail = String(managerEmail || '').trim().toLowerCase();
    const rawPassword = String(managerPassword || '');

    if (!cleanName) {
      return NextResponse.json({ error: 'El nombre de la organización es obligatorio.' }, { status: 400 });
    }
    if (!cleanSlug || cleanSlug.length < 2) {
      return NextResponse.json(
        { error: 'El identificador (slug) debe contener al menos 2 caracteres alfanuméricos.' },
        { status: 400 }
      );
    }
    if (!cleanManagerName) {
      return NextResponse.json({ error: 'El nombre del gerente es obligatorio.' }, { status: 400 });
    }
    if (!cleanManagerEmail || !cleanManagerEmail.includes('@')) {
      return NextResponse.json({ error: 'Ingresa un correo electrónico válido para el gerente.' }, { status: 400 });
    }
    if (!rawPassword || rawPassword.length < 6) {
      return NextResponse.json({ error: 'La contraseña del gerente debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    const db = getDb();

    // Check slug uniqueness
    const existingOrg = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, cleanSlug))
      .limit(1);

    if (existingOrg.length > 0) {
      return NextResponse.json({ error: `El slug '${cleanSlug}' ya se encuentra en uso.` }, { status: 400 });
    }

    // Check email uniqueness
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanManagerEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json({ error: `El correo '${cleanManagerEmail}' ya está registrado.` }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const transactionResult = await db.transaction(async (tx) => {
      const [newOrg] = await tx
        .insert(organizations)
        .values({
          name: cleanName,
          slug: cleanSlug,
          plan: cleanPlan,
          maxMachines: cleanMaxMachines,
          active: true,
        })
        .returning();

      const [newManager] = await tx
        .insert(users)
        .values({
          organizationId: newOrg.id,
          name: cleanManagerName,
          email: cleanManagerEmail,
          passwordHash,
          role: 'gerente',
          active: true,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        });

      return {
        organization: {
          ...newOrg,
          machinesCount: 0,
          usersCount: 1,
          snapshotsCount: 0,
        },
        manager: newManager,
      };
    });

    return NextResponse.json(transactionResult, { status: 201 });
  } catch (error) {
    console.error('Error al crear organización:', error);
    return NextResponse.json(
      { error: 'Error al registrar la organización y su gerente.' },
      { status: 500 }
    );
  }
}
