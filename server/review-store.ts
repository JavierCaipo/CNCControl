import { eq, sql } from 'drizzle-orm';
import { reviews } from '../db/schema';
import type { AppDatabase } from '../db';
import { restore, serialize, getStatus } from '../public/model.mjs';

const MAX_BYTES = 1500000;
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };

export interface ReviewCheck {
  value: 'pending' | 'fault' | 'ok';
  note: string;
}

export interface ReviewIncident {
  id: string;
  guideId: string;
  text: string;
  context: string;
  createdAt: string;
  resolvedAt?: string | null;
  responsible?: string | null;
  resolution?: string | null;
}

export interface ReviewState {
  id: string;
  date: string;
  startedAt: string;
  operator: string;
  ot: string;
  shift: string;
  notes: string;
  checks: Record<string, ReviewCheck>;
  incidents: ReviewIncident[];
  alarmReviewed: boolean;
  verifiedAt?: string | null;
}

export interface ReviewData {
  version: number;
  current: ReviewState;
  history: ReviewState[];
}

export interface ReviewRow {
  payload: unknown;
  revision: number;
  updated_at?: string;
  updatedAt?: Date | string;
  updated_by_name?: string;
  updatedByName?: string;
  [key: string]: unknown;
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}

function rowData(row: ReviewRow | null) {
  if (!row) return { data: null, revision: 0, updatedAt: null, updatedBy: null };
  const rawPayload = row.payload;
  const data = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
  const updatedAt = row.updated_at ?? (row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt);
  const updatedBy = row.updated_by_name ?? row.updatedByName;
  return {
    data,
    revision: row.revision,
    updatedAt,
    updatedBy,
  };
}

function validState(value: unknown): value is ReviewData {
  if (!value || typeof value !== 'object') return false;
  const val = value as Partial<ReviewData>;
  if (val.version !== 1 || !val.current || !Array.isArray(val.history) || val.history.length > 50) return false;
  const records = [val.current, ...val.history];
  return records.every((s) =>
    s &&
    typeof s.id === 'string' &&
    s.id.length <= 150 &&
    typeof s.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.date) &&
    typeof s.startedAt === 'string' &&
    !isNaN(Date.parse(s.startedAt)) &&
    ['operator', 'ot', 'shift', 'notes'].every((k) => typeof (s as unknown as Record<string, unknown>)[k] === 'string') &&
    s.operator.length <= 120 &&
    s.ot.length <= 120 &&
    s.shift.length <= 120 &&
    s.notes.length <= 4000 &&
    s.checks &&
    typeof s.checks === 'object' &&
    Object.values(s.checks).every((c) => c && ['pending', 'fault', 'ok'].includes(c.value) && typeof c.note === 'string' && c.note.length <= 2000) &&
    Array.isArray(s.incidents) &&
    s.incidents.length <= 100 &&
    s.incidents.every((i) =>
      i &&
      typeof i.id === 'string' &&
      typeof i.guideId === 'string' &&
      typeof i.text === 'string' &&
      i.text.trim() &&
      i.text.length <= 500 &&
      typeof i.context === 'string' &&
      i.context.length <= 2000 &&
      typeof i.createdAt === 'string' &&
      !isNaN(Date.parse(i.createdAt)) &&
      (!i.resolvedAt || (
        typeof i.resolvedAt === 'string' &&
        !isNaN(Date.parse(i.resolvedAt)) &&
        typeof i.responsible === 'string' &&
        i.responsible.trim() &&
        i.responsible.length <= 120 &&
        typeof i.resolution === 'string' &&
        i.resolution.trim().length >= 10 &&
        i.resolution.length <= 2000
      ))
    ) &&
    typeof s.alarmReviewed === 'boolean' &&
    (!s.verifiedAt || (typeof s.verifiedAt === 'string' && !isNaN(Date.parse(s.verifiedAt))))
  );
}

function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

export interface LegacySqliteDb {
  prepare: (sql: string) => { bind: (...args: unknown[]) => { first: () => Promise<ReviewRow | null> } };
}

export type ReviewHandlerDb = AppDatabase | LegacySqliteDb;

export interface ReviewHandlerUser {
  userId?: string;
  id?: string;
  email?: string | null;
  displayName?: string | null;
  name?: string | null;
  role?: string;
}

export async function handleReviews(
  request: Request,
  { db, user, now = new Date() }: { db: ReviewHandlerDb | null; user: ReviewHandlerUser | null; now?: Date }
) {
  const userId = user?.userId || user?.id;
  const userEmail = user?.email;
  if (!userId) {
    return json({ error: 'Inicia sesión con la cuenta autorizada para acceder al registro compartido.' }, 401);
  }
  if (!db) {
    return json({ error: 'El registro compartido no está disponible. Conserva una copia local y vuelve a intentar.' }, 503);
  }

  const isDrizzle = 'select' in db && typeof db.select === 'function';

  try {
    if (request.method === 'GET') {
      let row: ReviewRow | null = null;
      if (isDrizzle) {
        const drizzleDb = db as AppDatabase;
        const rows = await drizzleDb.select().from(reviews).where(eq(reviews.id, 'cnc')).limit(1);
        row = (rows[0] as unknown as ReviewRow) || null;
      } else {
        const legacyDb = db as LegacySqliteDb;
        row = await legacyDb.prepare('SELECT payload, revision, updated_at, updated_by_name FROM shared_reviews WHERE id = ?').bind('cnc').first();
      }
      return json({
        ...rowData(row),
        user: { displayName: user.displayName || user.name || userEmail || 'Operador', email: userEmail ?? null },
      });
    }

    if (request.method !== 'PUT' && request.method !== 'POST') {
      return json({ error: 'Método no permitido.' }, 405);
    }

    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return json({ error: 'Origen no permitido.' }, 403);
    }

    if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
      return json({ error: 'Usa formato JSON.' }, 415);
    }

    if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES) {
      return json({ error: 'El registro excede el tamaño permitido.' }, 413);
    }

    const raw = await request.text();
    if (raw.length > MAX_BYTES) {
      return json({ error: 'El registro excede el tamaño permitido.' }, 413);
    }

    let input: { revision?: unknown; data?: unknown; machineId?: unknown };
    try {
      input = JSON.parse(raw);
    } catch {
      return json({ error: 'El registro no tiene un formato válido.' }, 400);
    }

    if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 0 || !validState(input.data)) {
      return json({ error: 'Datos incompletos o inválidos. Conserva una copia y revisa la información.' }, 400);
    }

    const revisionNumber = Number(input.revision);
    const validData = input.data;
    const targetMachineId = (typeof input.machineId === 'string' && input.machineId.trim())
      ? input.machineId.trim()
      : 'SF3015HM';
    const targetMachineName = targetMachineId === 'SF3015HM' ? 'Senfeng SF3015HM' : `CNC ${targetMachineId}`;

    let existing: ReviewRow | null = null;
    if (isDrizzle) {
      const drizzleDb = db as AppDatabase;
      const rows = await drizzleDb.select().from(reviews).where(eq(reviews.id, 'cnc')).limit(1);
      existing = (rows[0] as unknown as ReviewRow) || null;
    } else {
      const legacyDb = db as LegacySqliteDb;
      existing = await legacyDb.prepare('SELECT payload, revision, updated_at, updated_by_name FROM shared_reviews WHERE id = ?').bind('cnc').first();
    }

    const currentRevision = existing?.revision ?? 0;
    if (currentRevision !== revisionNumber) {
      return json({
        error: 'Otra persona actualizó esta revisión. Carga la versión compartida antes de continuar.',
        conflict: true,
        ...rowData(existing),
      }, 409);
    }

    const normalized = restore(JSON.stringify(validData), now) as { current: ReviewState; history: ReviewState[] };
    const normalizedData = { version: 1, ...normalized };

    if (validData.current.verifiedAt && !getStatus(validData.current, now).eligible) {
      return json({ error: 'No se puede validar una revisión incompleta, vencida o con incidencias abiertas.' }, 422);
    }

    // Preservar incidencias abiertas
    const previousPayload = existing ? (typeof existing.payload === 'string' ? JSON.parse(existing.payload) : existing.payload) as { current?: { incidents?: ReviewIncident[] } } : null;
    for (const incident of previousPayload?.current?.incidents || []) {
      if (!incident.resolvedAt && !normalized.current.incidents.some((i) => i.id === incident.id)) {
        return json({ error: 'Hay una incidencia abierta que debe conservarse hasta registrar su solución.' }, 422);
      }
    }

    const updatedAtStr = now.toISOString();
    const updatedBy = String(user.displayName || user.name || userEmail || 'Operador').slice(0, 200);
    const payloadStr = serialize(normalized.current, normalized.history);
    const payloadObj = JSON.parse(payloadStr);

    let status: 'ok' | 'warning' | 'critical' = 'ok';
    const hasOpenIncidents = normalized.current.incidents?.some((i) => !i.resolvedAt);
    const hasFaults = Object.values(normalized.current.checks || {}).some((c) => c?.value === 'fault');
    if (hasOpenIncidents) {
      status = 'critical';
    } else if (hasFaults) {
      status = 'warning';
    } else {
      status = 'ok';
    }

    if (isDrizzle) {
      const drizzleDb = db as AppDatabase;
      const userIdFk = isValidUuid(userId) ? userId : null;
      const result = await drizzleDb
        .insert(reviews)
        .values({
          id: 'cnc',
          userId: userIdFk,
          machineId: targetMachineId,
          machineName: targetMachineName,
          status,
          payload: payloadObj,
          revision: 1,
          updatedAt: now,
          updatedById: userId,
          updatedByName: updatedBy,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: reviews.id,
          set: {
            userId: userIdFk ?? undefined,
            machineId: targetMachineId,
            machineName: targetMachineName,
            status,
            payload: payloadObj,
            revision: sql`${reviews.revision} + 1`,
            updatedAt: now,
            updatedById: userId,
            updatedByName: updatedBy,
          },
          where: eq(reviews.revision, revisionNumber),
        })
        .returning({ revision: reviews.revision });

      const updatedRow = result[0];
      if (!updatedRow) {
        return json({ error: 'La revisión cambió mientras guardabas. Carga la versión compartida.', conflict: true }, 409);
      }

      return json({
        revision: updatedRow.revision,
        updatedAt: updatedAtStr,
        updatedBy,
        data: normalizedData,
      });
    } else {
      const legacyDb = db as LegacySqliteDb;
      const result = await legacyDb.prepare(
        'INSERT INTO shared_reviews (id, payload, revision, updated_at, updated_by_id, updated_by_name) VALUES (?, ?, 1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, revision=shared_reviews.revision+1, updated_at=excluded.updated_at, updated_by_id=excluded.updated_by_id, updated_by_name=excluded.updated_by_name WHERE shared_reviews.revision = ? RETURNING revision'
      ).bind('cnc', payloadStr, updatedAtStr, userId, updatedBy, revisionNumber).first();

      if (!result) {
        return json({ error: 'La revisión cambió mientras guardabas. Carga la versión compartida.', conflict: true }, 409);
      }

      return json({
        revision: result.revision,
        updatedAt: updatedAtStr,
        updatedBy,
        data: normalizedData,
      });
    }
  } catch {
    return json({ error: 'No se pudo guardar o cargar el registro compartido. Conserva una copia y vuelve a intentar.' }, 503);
  }
}
