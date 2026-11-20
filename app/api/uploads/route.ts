import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { saveEvidenceFile } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'No autorizado. Inicie sesión.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const machineCode = (formData.get('machineCode') as string) || 'GENERAL';

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo de imagen.' }, { status: 400 });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato no permitido. Solo se aceptan imágenes JPEG, PNG o WebP.' },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'El archivo excede el tamaño máximo permitido de 5 MB.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const url = await saveEvidenceFile({
      buffer,
      mimeType: file.type,
      organizationId: session.organizationId || 'default',
      machineCode,
      originalFilename: file.name,
    });

    return NextResponse.json({ url, success: true }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al procesar la subida del archivo.';
    console.error('Error en /api/uploads:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

