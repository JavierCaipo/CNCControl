import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { organizations } from '@/db/schema';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ error: 'Slug no proporcionado.' }, { status: 400 });
    }

    const cleanSlug = String(slug).toLowerCase().trim();
    const db = getDb();

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        logoUrl: organizations.logoUrl,
      })
      .from(organizations)
      .where(eq(organizations.slug, cleanSlug))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 });
    }

    return NextResponse.json({
      name: org.name,
      slug: org.slug,
      logoUrl: org.logoUrl || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al consultar branding.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!['gerente', 'superadmin'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Solo gerentes o administradores pueden modificar la identidad de la planta.' },
        { status: 403 }
      );
    }

    const { slug } = await params;
    const cleanSlug = String(slug).toLowerCase().trim();
    const db = getDb();

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.slug, cleanSlug))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: 'Organización no encontrada.' }, { status: 404 });
    }

    if (session.role !== 'superadmin' && session.organizationId !== org.id) {
      return NextResponse.json({ error: 'No autorizado para esta organización.' }, { status: 403 });
    }

    const body = await req.json();
    const rawLogoUrl = body.logoUrl;
    let logoUrl: string | null = null;

    if (typeof rawLogoUrl === 'string' && rawLogoUrl.trim().length > 0) {
      logoUrl = rawLogoUrl.trim();
    }

    await db
      .update(organizations)
      .set({
        logoUrl,
      })
      .where(eq(organizations.id, org.id));

    return NextResponse.json({
      success: true,
      logoUrl,
      message: logoUrl ? 'Logo actualizado correctamente.' : 'Logo eliminado correctamente.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar branding.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

