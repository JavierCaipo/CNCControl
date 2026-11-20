import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { organizations, machines, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL no está definida en las variables de entorno.');
    console.error('Ejemplo Local Docker: DATABASE_URL="postgresql://cnc_dev:cnc_dev_pass@localhost:5433/cnc_control_dev"');
    console.error('Ejemplo Supabase: DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"');
    process.exit(1);
  }

  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes(':5433');

  console.log(`🔄 Conectando a PostgreSQL (${isLocal ? 'Docker Local' : 'Supabase'})...`);
  const sql = postgres(connectionString, {
    prepare: false,
    ssl: isLocal ? false : undefined,
  });
  const db = drizzle(sql, { schema: { organizations, machines, users } });

  try {
    console.log('🌱 Iniciando siembra de datos de prueba SaaS Multi-Tenant (Seed)...');

    // --------------------------------------------------------------------------
    // 1. Super Administrador de la Plataforma (Sin organización asignada)
    // --------------------------------------------------------------------------
    const superAdminEmail = 'superadmin@tresapps.com';
    const superAdminPassword = 'superadmin1234';
    const superAdminPasswordHash = await bcrypt.hash(superAdminPassword, 10);

    const existingSuperAdmin = await db
      .select()
      .from(users)
      .where(eq(users.email, superAdminEmail))
      .limit(1);

    if (existingSuperAdmin.length === 0) {
      await db.insert(users).values({
        name: 'Super Administrador',
        role: 'superadmin',
        email: superAdminEmail,
        passwordHash: superAdminPasswordHash,
        pinHash: null,
        organizationId: null,
        active: true,
      });
      console.log(`✅ Super Admin creado: ${superAdminEmail} | Password: ${superAdminPassword}`);
    } else {
      console.log(`ℹ️  Super Admin ya existente: ${superAdminEmail}`);
    }

    // --------------------------------------------------------------------------
    // 2. Organización Inicial: IMAD 3D
    // --------------------------------------------------------------------------
    const orgSlug = 'imad3d';
    let [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, orgSlug))
      .limit(1);

    if (!org) {
      const [insertedOrg] = await db
        .insert(organizations)
        .values({
          name: 'IMAD 3D',
          slug: orgSlug,
          plan: 'pro',
          maxMachines: 10,
          active: true,
        })
        .returning();
      org = insertedOrg;
      console.log(`✅ Organización creada: ${org.name} (Slug: ${org.slug}, Plan: ${org.plan})`);
    } else {
      console.log(`ℹ️  Organización ya existente: ${org.name} (Slug: ${org.slug})`);
    }

    // --------------------------------------------------------------------------
    // 3. Máquina Inicial: Senfeng SF3015HM
    // --------------------------------------------------------------------------
    const machineCode = 'SF3015HM';
    const existingMachine = await db
      .select()
      .from(machines)
      .where(and(eq(machines.organizationId, org.id), eq(machines.code, machineCode)))
      .limit(1);

    if (existingMachine.length === 0) {
      await db.insert(machines).values({
        organizationId: org.id,
        code: machineCode,
        name: 'Senfeng SF3015HM',
        model: 'SF3015HM - 3000W Fiber Laser',
        serialNumber: 'SF-2026-001',
        active: true,
      });
      console.log(`✅ Máquina creada: Senfeng ${machineCode} vinculada a ${org.name}`);
    } else {
      console.log(`ℹ️  Máquina ya existente: ${machineCode} en ${org.name}`);
    }

    // --------------------------------------------------------------------------
    // 4. Gerente de Organización: Carlos Mendoza
    // --------------------------------------------------------------------------
    const gerenteEmail = 'gerente@imad3d.com';
    const gerentePassword = 'admin1234';
    const gerentePasswordHash = await bcrypt.hash(gerentePassword, 10);

    const existingGerente = await db
      .select()
      .from(users)
      .where(eq(users.email, gerenteEmail))
      .limit(1);

    if (existingGerente.length === 0) {
      await db.insert(users).values({
        organizationId: org.id,
        name: 'Carlos Mendoza (Gerente)',
        role: 'gerente',
        email: gerenteEmail,
        passwordHash: gerentePasswordHash,
        pinHash: null,
        active: true,
      });
      console.log(`✅ Gerente creado: ${gerenteEmail} | Password: ${gerentePassword}`);
    } else {
      // Aseguramos que tenga organizationId asignado
      if (!existingGerente[0].organizationId) {
        await db.update(users).set({ organizationId: org.id }).where(eq(users.id, existingGerente[0].id));
      }
      console.log(`ℹ️  Gerente ya existente: ${gerenteEmail} (Org: ${org.slug})`);
    }

    // --------------------------------------------------------------------------
    // 5. Supervisor de Planta: Santiago Caipo (PIN: 1234)
    // --------------------------------------------------------------------------
    const supervisorName = 'Santiago Caipo (Supervisor)';
    const supervisorPin = '1234';
    const supervisorPinHash = await bcrypt.hash(supervisorPin, 10);

    const existingSupervisor = await db
      .select()
      .from(users)
      .where(and(eq(users.name, supervisorName), eq(users.organizationId, org.id)))
      .limit(1);

    if (existingSupervisor.length === 0) {
      await db.insert(users).values({
        organizationId: org.id,
        name: supervisorName,
        role: 'supervisor',
        email: null,
        passwordHash: null,
        pinHash: supervisorPinHash,
        active: true,
      });
      console.log(`✅ Supervisor creado: ${supervisorName} | PIN: ${supervisorPin}`);
    } else {
      console.log(`ℹ️  Supervisor ya existente: ${supervisorName}`);
    }

    // --------------------------------------------------------------------------
    // 6. Operario de Planta: Juan Pérez (PIN: 5678)
    // --------------------------------------------------------------------------
    const operarioName = 'Juan Pérez (Operador)';
    const operarioPin = '5678';
    const operarioPinHash = await bcrypt.hash(operarioPin, 10);

    const existingOperario = await db
      .select()
      .from(users)
      .where(and(eq(users.name, operarioName), eq(users.organizationId, org.id)))
      .limit(1);

    if (existingOperario.length === 0) {
      await db.insert(users).values({
        organizationId: org.id,
        name: operarioName,
        role: 'operario',
        email: null,
        passwordHash: null,
        pinHash: operarioPinHash,
        active: true,
      });
      console.log(`✅ Operario creado: ${operarioName} | PIN: ${operarioPin}`);
    } else {
      console.log(`ℹ️  Operario ya existente: ${operarioName}`);
    }

    console.log('\n🎉 ¡Siembra de base de datos Multi-Tenant completada exitosamente!');
    console.log('==================================================');
    console.log('Credenciales generadas / disponibles:');
    console.log('1. Super Administrador:');
    console.log(`   - Email: ${superAdminEmail}`);
    console.log(`   - Contraseña: ${superAdminPassword}`);
    console.log('2. Organización Tenant:');
    console.log(`   - Nombre: ${org.name}`);
    console.log(`   - Slug: ${org.slug}`);
    console.log('3. Gerente:');
    console.log(`   - Email: ${gerenteEmail}`);
    console.log(`   - Contraseña: ${gerentePassword}`);
    console.log('4. Supervisor:');
    console.log(`   - Nombre: ${supervisorName}`);
    console.log(`   - PIN: ${supervisorPin}`);
    console.log('5. Operario:');
    console.log(`   - Nombre: ${operarioName}`);
    console.log(`   - PIN: ${operarioPin}`);
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Error durante la siembra de datos:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
