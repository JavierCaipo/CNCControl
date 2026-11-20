import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { getSession } from '@/lib/auth';
import { testWebhook } from '@/lib/alerts';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!['gerente', 'superadmin'].includes(session.role)) {
      return NextResponse.json({ error: 'Solo gerentes pueden configurar alertas.' }, { status: 403 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Base de datos no disponible.' }, { status: 503 });
    }

    const { slug } = await params;
    const cleanSlug = String(slug).toLowerCase().trim();

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        alertWebhookUrl: organizations.alertWebhookUrl,
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

    return NextResponse.json({ alertWebhookUrl: org.alertWebhookUrl || '' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al consultar alertas.';
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
      return NextResponse.json({ error: 'Solo gerentes pueden configurar alertas.' }, { status: 403 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Base de datos no disponible.' }, { status: 503 });
    }

    const { slug } = await params;
    const cleanSlug = String(slug).toLowerCase().trim();

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
    const alertWebhookUrl = typeof body.alertWebhookUrl === 'string' ? body.alertWebhookUrl.trim() : null;

    if (alertWebhookUrl && !alertWebhookUrl.startsWith('http://') && !alertWebhookUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'La URL del webhook debe comenzar con http:// o https://' },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(organizations)
      .set({
        alertWebhookUrl: alertWebhookUrl || null,
      })
      .where(eq(organizations.id, org.id))
      .returning({
        id: organizations.id,
        alertWebhookUrl: organizations.alertWebhookUrl,
      });

    return NextResponse.json({
      message: 'Configuración de alertas guardada exitosamente.',
      alertWebhookUrl: updated.alertWebhookUrl || '',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al guardar configuración.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!['gerente', 'superadmin'].includes(session.role)) {
      return NextResponse.json({ error: 'Solo gerentes pueden probar alertas.' }, { status: 403 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Base de datos no disponible.' }, { status: 503 });
    }

    const { slug } = await params;
    const cleanSlug = String(slug).toLowerCase().trim();

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

    const body = await req.json();
    const webhookUrl = String(body.webhookUrl || '').trim();

    const result = await testWebhook(webhookUrl, {
      id: org.id,
      name: org.name,
      slug: org.slug,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'La prueba de webhook falló.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      message: 'Prueba de webhook enviada y confirmada exitosamente.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al probar webhook.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

