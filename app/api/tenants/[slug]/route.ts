import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { organizations } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
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
        plan: organizations.plan,
        maxMachines: organizations.maxMachines,
        active: organizations.active,
      })
      .from(organizations)
      .where(eq(organizations.slug, cleanSlug))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: 'Organización no encontrada.' },
        { status: 404 }
      );
    }

    if (!org.active) {
      return NextResponse.json(
        {
          id: org.id,
          name: org.name,
          slug: org.slug,
          active: false,
          error: 'Esta organización se encuentra temporalmente suspendida.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ tenant: org });
  } catch (error) {
    console.error('Error al consultar inquilino:', error);
    return NextResponse.json(
      { error: 'Error al consultar la organización.' },
      { status: 500 }
    );
  }
}

