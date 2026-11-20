import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface SaveEvidenceOptions {
  buffer: Buffer;
  mimeType: string;
  organizationId: string;
  machineCode?: string;
  originalFilename?: string;
}

/**
 * Adaptador dual de almacenamiento para evidencias fotográficas:
 * - Producción: Supabase Storage bucket 'cnc-evidence' si existen SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 * - Desarrollo Local: Archivos locales en 'public/uploads/evidence/{organizationId}/'
 */
export async function saveEvidenceFile(options: SaveEvidenceOptions): Promise<string> {
  const { buffer, mimeType, organizationId, machineCode, originalFilename } = options;

  let ext = path.extname(originalFilename || '').toLowerCase();
  if (!ext || ext === '.') {
    ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
  }

  const cleanOrg = (organizationId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanCode = (machineCode || 'GENERAL').replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const fileUuid = crypto.randomUUID();
  const fileName = `${timestamp}-${fileUuid}${ext}`;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    const objectPath = `${cleanOrg}/${cleanCode}/${fileName}`;
    const uploadEndpoint = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/cnc-evidence/${objectPath}`;

    const res = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: new Uint8Array(buffer),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error al subir a Supabase Storage: ${res.status} ${errText}`);
    }

    return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/cnc-evidence/${objectPath}`;
  }

  // Fallback Local: public/uploads/evidence/{organizationId}/
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'evidence', cleanOrg);
  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, fileName);
  await fs.writeFile(filePath, buffer);

  return `/uploads/evidence/${cleanOrg}/${fileName}`;
}

