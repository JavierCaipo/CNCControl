import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL no está definida en las variables de entorno.');
    console.error('Ejemplo: DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres"');
    process.exit(1);
  }

  console.log('🔄 Conectando a Supabase PostgreSQL...');
  const sql = postgres(connectionString, { prepare: false });
  const db = drizzle(sql, { schema: { users } });

  try {
    console.log('🌱 Iniciando siembra de datos de prueba (Seed)...');

    // 1 Gerente de prueba
    const gerenteEmail = 'gerente@imad3d.com';
    const gerentePassword = 'admin1234';
    const gerentePasswordHash = await bcrypt.hash(gerentePassword, 10);

    const existingGerente = await db.select().from(users).where(eq(users.email, gerenteEmail)).limit(1);

    if (existingGerente.length === 0) {
      await db.insert(users).values({
        name: 'Carlos Mendoza (Gerente)',
        role: 'gerente',
        email: gerenteEmail,
        passwordHash: gerentePasswordHash,
        pinHash: null,
        active: true,
      });
      console.log(`✅ Gerente creado: ${gerenteEmail} | Password: ${gerentePassword}`);
    } else {
      console.log(`ℹ️  Gerente ya existente: ${gerenteEmail}`);
    }

    // 1 Supervisor de prueba
    const supervisorName = 'Santiago Caipo (Supervisor)';
    const supervisorPin = '1234';
    const supervisorPinHash = await bcrypt.hash(supervisorPin, 10);
    const existingSupervisor = await db
      .select()
      .from(users)
      .where(eq(users.name, supervisorName))
      .limit(1);

    if (existingSupervisor.length === 0) {
      await db.insert(users).values({
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

    // 1 Operario de prueba
    const operarioName = 'Juan Pérez (Operador)';
    const operarioPin = '5678';
    const operarioPinHash = await bcrypt.hash(operarioPin, 10);
    const existingOperario = await db
      .select()
      .from(users)
      .where(eq(users.name, operarioName))
      .limit(1);

    if (existingOperario.length === 0) {
      await db.insert(users).values({
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

    console.log('\n🎉 ¡Siembra de base de datos completada exitosamente!');
    console.log('--------------------------------------------------');
    console.log('Credenciales de prueba generadas:');
    console.log('1. Gerente:');
    console.log(`   - Email: ${gerenteEmail}`);
    console.log(`   - Contraseña: ${gerentePassword}`);
    console.log('2. Supervisor:');
    console.log(`   - Nombre: ${supervisorName}`);
    console.log(`   - PIN: ${supervisorPin}`);
    console.log('3. Operario:');
    console.log(`   - Nombre: ${operarioName}`);
    console.log(`   - PIN: ${operarioPin}`);
    console.log('--------------------------------------------------\n');
  } catch (error) {
    console.error('❌ Error durante la siembra de datos:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
