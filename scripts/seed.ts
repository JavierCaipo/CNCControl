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

    // 2 Operarios de prueba
    const operarios = [
      {
        name: 'Santiago Caipo (Operador)',
        role: 'operario' as const,
        pin: '1234',
      },
      {
        name: 'Juan Pérez (Operador)',
        role: 'operario' as const,
        pin: '5678',
      },
    ];

    for (const op of operarios) {
      const existingOp = await db.select().from(users).where(eq(users.name, op.name)).limit(1);
      if (existingOp.length === 0) {
        const pinHash = await bcrypt.hash(op.pin, 10);
        await db.insert(users).values({
          name: op.name,
          role: op.role,
          email: null,
          passwordHash: null,
          pinHash,
          active: true,
        });
        console.log(`✅ Operario creado: ${op.name} | PIN: ${op.pin}`);
      } else {
        console.log(`ℹ️  Operario ya existente: ${op.name}`);
      }
    }

    console.log('\n🎉 ¡Siembra de base de datos completada exitosamente!');
    console.log('--------------------------------------------------');
    console.log('Credenciales de prueba generadas:');
    console.log('1. Gerente:');
    console.log(`   - Email: ${gerenteEmail}`);
    console.log(`   - Contraseña: ${gerentePassword}`);
    console.log('2. Operario 1:');
    console.log('   - Nombre: Santiago Caipo (Operador)');
    console.log('   - PIN: 1234');
    console.log('3. Operario 2:');
    console.log('   - Nombre: Juan Pérez (Operador)');
    console.log('   - PIN: 5678');
    console.log('--------------------------------------------------\n');
  } catch (error) {
    console.error('❌ Error durante la siembra de datos:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();

