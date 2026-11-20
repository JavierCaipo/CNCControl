import { eq, isNull, and, ne } from 'drizzle-orm';
import { db } from '../db';
import { organizations, machines, users, reviews } from '../db/schema';

/**
 * Script de Cutover Seguro e Idempotente a Producción (Supabase).
 *
 * Ejecución segura:
 * 1. Verifica o crea la organización base 'IMAD 3D' (slug: 'imad3d').
 * 2. Verifica o crea la máquina base 'SF3015HM' (Senfeng SF3015HM).
 * 3. Asigna 'organizationId' de IMAD 3D a todos los usuarios que tengan 'organizationId IS NULL' (excepto superadmin).
 * 4. Asigna 'organizationId' de IMAD 3D a todas las filas de reviews activas que tengan 'organizationId IS NULL'.
 * 5. Conserva el 100% de los datos históricos y registros sin sobrescribir ni borrar información.
 */
async function runCutoverMigration() {
  console.log('🚀 Iniciando script de migración segura de Cutover a SaaS Multi-Tenant...');

  if (!db) {
    throw new Error('No se pudo conectar a la base de datos. Verifique DATABASE_URL.');
  }

  // 1. Verificar o crear organización base 'IMAD 3D'
  let [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, 'imad3d'))
    .limit(1);

  if (!org) {
    console.log('📦 Creando organización base IMAD 3D (slug: imad3d)...');
    const [created] = await db
      .insert(organizations)
      .values({
        name: 'IMAD 3D',
        slug: 'imad3d',
        plan: 'pro',
        maxMachines: 5,
        active: true,
      })
      .returning();
    org = created;
    console.log(`✓ Organización IMAD 3D creada con ID: ${org.id}`);
  } else {
    console.log(`✓ Organización base encontrada: ${org.name} (${org.id})`);
  }

  // 2. Verificar o crear máquina base 'SF3015HM'
  const [machine] = await db
    .select()
    .from(machines)
    .where(and(eq(machines.organizationId, org.id), eq(machines.code, 'SF3015HM')))
    .limit(1);

  if (!machine) {
    console.log('🔧 Vinculando máquina base SF3015HM a IMAD 3D...');
    const [createdMachine] = await db
      .insert(machines)
      .values({
        organizationId: org.id,
        code: 'SF3015HM',
        name: 'Senfeng SF3015HM',
        model: 'SF3015HM Fiber Laser',
        active: true,
      })
      .returning();
    console.log(`✓ Máquina SF3015HM creada con ID: ${createdMachine.id}`);
  } else {
    console.log(`✓ Máquina SF3015HM ya existente: ${machine.name} (${machine.id})`);
  }

  // 3. Asignar organización a usuarios huérfanos (excepto superadmin)
  const unassignedUsers = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(isNull(users.organizationId), ne(users.role, 'superadmin')));

  if (unassignedUsers.length > 0) {
    console.log(`👥 Asignando ${unassignedUsers.length} usuario(s) heredados a IMAD 3D...`);
    await db
      .update(users)
      .set({ organizationId: org.id })
      .where(and(isNull(users.organizationId), ne(users.role, 'superadmin')));
    console.log(`✓ ${unassignedUsers.length} usuarios actualizados con éxito.`);
  } else {
    console.log('✓ No hay usuarios huérfanos pendientes de asignación.');
  }

  // 4. Asignar organización a revisiones activas huérfanas
  const unassignedReviews = await db
    .select({ id: reviews.id, machineId: reviews.machineId })
    .from(reviews)
    .where(isNull(reviews.organizationId));

  if (unassignedReviews.length > 0) {
    console.log(`📋 Asignando ${unassignedReviews.length} revisión(es) huérfana(s) a IMAD 3D...`);
    await db
      .update(reviews)
      .set({ organizationId: org.id })
      .where(isNull(reviews.organizationId));
    console.log(`✓ ${unassignedReviews.length} revisiones actualizadas con éxito.`);
  } else {
    console.log('✓ No hay revisiones huérfanas pendientes de asignación.');
  }

  console.log('\n======================================================');
  console.log('🎉 Migración de Cutover a SaaS Multi-Tenant completada.');
  console.log('======================================================\n');
}

runCutoverMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error durante la migración de cutover:', err);
    process.exit(1);
  });

