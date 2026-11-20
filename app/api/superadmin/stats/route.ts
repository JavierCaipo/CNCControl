import { NextResponse } from 'next/server';
import { count, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { organizations, machines, users, reviewSnapshots } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/superadmin-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const db = getDb();

    const [
      [totalOrgsRes],
      [activeOrgsRes],
      [totalMachinesRes],
      [totalUsersRes],
      [totalSnapshotsRes],
    ] = await Promise.all([
      db.select({ value: count() }).from(organizations),
      db.select({ value: count() }).from(organizations).where(eq(organizations.active, true)),
      db.select({ value: count() }).from(machines),
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(reviewSnapshots),
    ]);

    return NextResponse.json({
      totalOrganizations: Number(totalOrgsRes?.value || 0),
      activeOrganizations: Number(activeOrgsRes?.value || 0),
      totalMachines: Number(totalMachinesRes?.value || 0),
      totalUsers: Number(totalUsersRes?.value || 0),
      totalSnapshots: Number(totalSnapshotsRes?.value || 0),
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de superadmin:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del sistema.' },
      { status: 500 }
    );
  }
}

