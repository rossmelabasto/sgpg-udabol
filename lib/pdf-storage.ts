// lib/pdf-storage.ts — utilidades de Storage para PDFs (solo servidor).
import { adminStorage } from "@/lib/firebase/admin";

export const PDF_PREFIX = "projects/";

/**
 * Ruta del PDF en el bucket. Los proyectos nuevos guardan `pdfPath`; los
 * antiguos solo tenían `pdfUrl` (una URL firmada que caduca), de la que se
 * extrae la ruta.
 */
export function resolvePdfPath(data: { pdfPath?: string | null; pdfUrl?: string | null; url?: string | null; path?: string | null }): string | null {
  const direct = data.pdfPath ?? data.path;
  if (direct) return direct;
  const url = data.pdfUrl ?? data.url;
  if (!url) return null;
  try {
    const u = new URL(url);
    // Formatos: /<bucket>/projects/xxx  o  /v0/b/<bucket>/o/projects%2Fxxx
    const decoded = decodeURIComponent(u.pathname);
    const m = decoded.match(/\/(projects\/.+)$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function isValidPdfPath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith(PDF_PREFIX) && !path.includes("..") && path.length < 512;
}

export async function pdfExists(path: string) {
  const [exists] = await adminStorage.bucket().file(path).exists();
  return exists;
}

export async function deletePdf(path: string | null | undefined) {
  if (!isValidPdfPath(path)) return;
  await adminStorage.bucket().file(path).delete({ ignoreNotFound: true });
}

export function buildStoragePath(fileName: string) {
  const safe = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-120);
  return `${PDF_PREFIX}${crypto.randomUUID()}-${safe || "documento.pdf"}`;
}

/** Un PDF real empieza con "%PDF-" (no basta con la extensión). */
export function looksLikePdf(bytes: Uint8Array) {
  return bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}
