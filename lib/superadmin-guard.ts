import { NextResponse } from 'next/server';
import { getSession, AuthSession } from '@/lib/auth';

export type SuperAdminCheckResult = 
  | { authorized: false; response: NextResponse }
  | { authorized: true; session: AuthSession };

export async function requireSuperAdmin(): Promise<SuperAdminCheckResult> {
  const session = await getSession();

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'No autenticado.' },
        { status: 401 }
      ),
    };
  }

  if (session.role !== 'superadmin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Acceso no autorizado. Se requieren permisos de Super Admin.' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
  };
}

