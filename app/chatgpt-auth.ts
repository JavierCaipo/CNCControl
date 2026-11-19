import { getSession, AuthSession } from '@/lib/auth';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  role?: 'operario' | 'gerente';
};

/**
 * Reemplazo de compatibilidad: en lugar de headers de OpenAI,
 * ahora obtiene el usuario desde la cookie de sesión JWT segura de Supabase.
 */
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const session = await getSession();
  if (!session) return null;

  return {
    userId: session.userId,
    displayName: session.name,
    email: session.email || `${session.name.toLowerCase().replace(/\s+/g, '')}@imad3d.local`,
    fullName: session.name,
    role: session.role,
  };
}

export async function getCurrentUser(): Promise<AuthSession | null> {
  return await getSession();
}
