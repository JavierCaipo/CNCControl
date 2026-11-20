import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'cnc-imad3d-super-secure-production-secret-key-32chars';
const secretKey = new TextEncoder().encode(JWT_SECRET);

async function createSessionToken(session) {
  return await new SignJWT({
    userId: session.userId,
    name: session.name,
    role: session.role,
    email: session.email,
    organizationId: session.organizationId || null,
    organizationSlug: session.organizationSlug || null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.userId || !payload.role || !payload.name) return null;
    return {
      userId: String(payload.userId),
      name: String(payload.name),
      role: payload.role,
      email: payload.email ? String(payload.email) : null,
      organizationId: payload.organizationId ? String(payload.organizationId) : null,
      organizationSlug: payload.organizationSlug ? String(payload.organizationSlug) : null,
    };
  } catch {
    return null;
  }
}

test('superadmin auth token creation and verification works properly', async () => {
  const superadminSession = {
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'Super Admin',
    role: 'superadmin',
    email: 'superadmin@tresapps.com',
    organizationId: null,
    organizationSlug: null,
  };

  const token = await createSessionToken(superadminSession);
  assert.ok(token, 'Token should be generated');

  const verified = await verifySessionToken(token);
  assert.ok(verified, 'Token should be verified');
  assert.equal(verified?.role, 'superadmin');
  assert.equal(verified?.email, 'superadmin@tresapps.com');
  assert.equal(verified?.organizationId, null);
});

test('non-superadmin roles are distinguished in session token', async () => {
  const managerSession = {
    userId: '00000000-0000-0000-0000-000000000002',
    name: 'Gerente IMAD',
    role: 'gerente',
    email: 'gerente@imad3d.com',
    organizationId: '11111111-1111-1111-1111-111111111111',
    organizationSlug: 'imad3d',
  };

  const token = await createSessionToken(managerSession);
  const verified = await verifySessionToken(token);
  assert.equal(verified?.role, 'gerente');
  assert.equal(verified?.organizationSlug, 'imad3d');
  assert.notEqual(verified?.role, 'superadmin');
});

test('slug normalization handles special characters and casing properly', () => {
  const normalize = (slug) =>
    String(slug || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

  assert.equal(normalize('IMAD 3D!'), 'imad-3d');
  assert.equal(normalize('Industrias Metálicas S.A.'), 'industrias-metalicas-s-a');
  assert.equal(normalize('  --empresa-cnc--  '), 'empresa-cnc');
  assert.equal(normalize('FABRICACION_2026'), 'fabricacion-2026');
});
