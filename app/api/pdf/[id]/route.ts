// GET /api/pdf/<projectId>[?v=<versionId>][&download=1]
// GET /api/pdf/_subida?path=projects/...   (vista previa de un PDF recién subido; solo admin)
//
// Sirve el PDF desde Storage con la sesión verificada. Soporta peticiones por
// rango (pdf.js descarga el documento por partes), así que no hay límite
// práctico de tamaño ni hace falta exponer URLs públicas o firmadas.
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { getSession, isAdminRole } from "@/lib/auth";
import { isValidPdfPath, resolvePdfPath } from "@/lib/pdf-storage";

export const runtime = "nodejs";

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function asciiFileName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._ -]+/g, "").slice(0, 120) || "proyecto.pdf";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return error(401, "Inicia sesión para ver el PDF.");

  const { id } = await params;
  const url = new URL(request.url);
  const versionId = url.searchParams.get("v");
  const download = url.searchParams.get("download") === "1";

  let path: string | null = null;
  let fileName = "proyecto.pdf";

  if (id === "_subida") {
    if (!isAdminRole(session.role)) return error(403, "Solo administradores.");
    const p = url.searchParams.get("path");
    if (!isValidPdfPath(p)) return error(400, "Ruta no válida.");
    path = p;
  } else {
    const ref = adminDb.collection("projects").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return error(404, "Proyecto no encontrado.");
    const data = doc.data()!;
    const admin = isAdminRole(session.role);
    if (data.deleted && !admin) return error(404, "Proyecto no encontrado.");
    fileName = `${(data.title as string).slice(0, 80)}.pdf`;

    if (versionId && versionId !== "actual") {
      // Las versiones anteriores solo las ven los administradores.
      if (!admin) return error(403, "Solo administradores.");
      const v = await ref.collection("pdfHistory").doc(versionId).get();
      if (!v.exists) return error(404, "Versión no encontrada.");
      path = resolvePdfPath(v.data()!);
      fileName = `${(data.title as string).slice(0, 70)} (v${v.data()!.version ?? "ant"}).pdf`;
    } else {
      path = resolvePdfPath(data);
    }
  }

  if (!path || !isValidPdfPath(path)) return error(404, "Este proyecto no tiene PDF.");

  const file = adminStorage.bucket().file(path);
  let size: number;
  try {
    const [meta] = await file.getMetadata();
    size = Number(meta.size);
  } catch {
    return error(404, "El archivo PDF no se encontró en el almacenamiento.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${asciiFileName(fileName)}"`,
  };

  const range = request.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    const stream = file.createReadStream({ start, end });
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new NextResponse(Readable.toWeb(file.createReadStream()) as ReadableStream, {
    status: 200,
    headers: { ...headers, "Content-Length": String(size) },
  });
}
