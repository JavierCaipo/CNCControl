import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizations } from '@/db/schema';

export interface CriticalAlertPayload {
  organizationId: string;
  snapshot: {
    id: string;
    shift: string;
    workOrder: string;
    status: string;
    incidentsCount: number;
    evidenceUrls?: unknown;
    createdAt?: Date | string;
  };
  machine: {
    id: string;
    code: string;
    name: string;
  };
  operator: {
    id: string;
    name: string;
  };
}

/**
 * Dispara un webhook HTTP asíncrono y no bloqueante cuando se detecta un estado crítico en un turno.
 * Timeout de 5 segundos y manejo de errores silencioso para no interrumpir el registro del snapshot.
 */
export async function sendCriticalAlert(data: CriticalAlertPayload): Promise<void> {
  try {
    if (!db) return;

    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        alertWebhookUrl: organizations.alertWebhookUrl,
      })
      .from(organizations)
      .where(eq(organizations.id, data.organizationId))
      .limit(1);

    if (!org || !org.alertWebhookUrl) {
      return;
    }

    const webhookUrl = org.alertWebhookUrl.trim();
    if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
      console.warn(`[Alerts] URL de webhook inválida para organización ${org.slug}: ${webhookUrl}`);
      return;
    }

    const payload = {
      event: 'cnc.critical_alert',
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
      machine: {
        id: data.machine.id,
        code: data.machine.code,
        name: data.machine.name,
      },
      operator: {
        id: data.operator.id,
        name: data.operator.name,
      },
      shift: data.snapshot.shift,
      workOrder: data.snapshot.workOrder,
      incidentsCount: data.snapshot.incidentsCount,
      evidenceUrls: Array.isArray(data.snapshot.evidenceUrls) ? data.snapshot.evidenceUrls : [],
      timestamp: new Date().toISOString(),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CNC-Control-Alerts/1.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeoutId);
        if (!res.ok) {
          console.warn(`[Alerts] Webhook respondi\xF3 con c\xF3digo ${res.status} para ${org.slug}`);
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.error(`[Alerts] Fallo al enviar alerta de webhook para ${org.slug}:`, err.message);
      });
  } catch (error) {
    console.error('[Alerts] Excepci\xF3n general en sendCriticalAlert:', error);
  }
}

/**
 * Funci\xF3n de prueba para validar la conectividad de un webhook desde el panel de configuraci\xF3n.
 */
export async function testWebhook(webhookUrl: string, tenantInfo: { id: string; name: string; slug: string }): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const url = webhookUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, error: 'La URL debe comenzar con http:// o https://' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const testPayload = {
      event: 'cnc.test_alert',
      message: 'Prueba de conexi\xF3n exitosa desde CNC-Control SaaS.',
      organization: tenantInfo,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CNC-Control-Alerts/1.0',
      },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok || response.status === 200 || response.status === 201 || response.status === 204) {
      return { success: true, status: response.status };
    }

    return { success: false, status: response.status, error: `El servidor respondi\xF3 con c\xF3digo HTTP ${response.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido al probar webhook';
    return { success: false, error: msg };
  }
}

