import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.AUTH_SECRET || process.env.JWT_SECRET || 'cnc-imad3d-super-secure-production-secret-key-32chars';
const secretKey = new TextEncoder().encode(JWT_SECRET);
export const AUTH_COOKIE_NAME = 'cnc_session';

export type UserRole = 'superadmin' | 'gerente' | 'supervisor' | 'operario';

export interface AuthSession {
  userId: string;
  name: string;
  role: UserRole;
  email: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
}

/**
 * Emite un token JWT firmado con validez de 7 días.
 */
export async function createSessionToken(session: AuthSession): Promise<string> {
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

/**
 * Valida un token JWT y extrae los datos de la sesión.
 */
export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload.userId || !payload.role || !payload.name) return null;
    return {
      userId: String(payload.userId),
      name: String(payload.name),
      role: payload.role as UserRole,
      email: payload.email ? String(payload.email) : null,
      organizationId: payload.organizationId ? String(payload.organizationId) : null,
      organizationSlug: payload.organizationSlug ? String(payload.organizationSlug) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Obtiene la sesión activa actual leyendo la Cookie HTTP-only.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Configura la Cookie HTTP-only segura en el navegador.
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 días
  });
}

/**
 * Elimina la Cookie HTTP-only para cerrar la sesión.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

