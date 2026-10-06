// POST /api/upload-pdf — sube un PDF a Storage (solo administradores).
// Devuelve la ruta interna; el PDF queda asociado al proyecto recién cuando se
// guarda el formulario (createProject/updateProject), que es quien versiona.
import { NextResponse } from "next/server";
import { adminStorage } from "@/lib/firebase/admin";
import { getSession, isAdminRole } from "@/lib/auth";
import { buildStoragePath, looksLikePdf } from "@/lib/pdf-storage";
import { MAX_PDF_BYTES } from "@/lib/projects";

export const runtime = "nodejs";

const MB = (n: number) => `${(n / 1024 / 1024).toFixed(0)} MB`;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isAdminRole(session.role)) {
    return NextResponse.json({ error: "Solo los administradores pueden subir PDFs." }, { status: 403 });
  }

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_PDF_BYTES + 64 * 1024) {
    return NextResponse.json({ error: `El PDF pesa más de ${MB(MAX_PDF_BYTES)}. Comprímelo y vuelve a intentarlo.` }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el archivo." }, { status: 400 });
  }
  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No se recibió un archivo PDF válido." }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: `El PDF pesa más de ${MB(MAX_PDF_BYTES)}. Comprímelo y vuelve a intentarlo.` }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksLikePdf(buffer)) {
    return NextResponse.json({ error: "El archivo no es un PDF válido." }, { status: 415 });
  }

  const path = buildStoragePath(file.name);
  await adminStorage.bucket().file(path).save(buffer, {
    metadata: {
      contentType: "application/pdf",
      metadata: { uploadedBy: session.email ?? session.uid, originalName: file.name.slice(0, 200) },
    },
    resumable: false,
  });

  return NextResponse.json({ ok: true, path, fileName: file.name, size: file.size });
}
