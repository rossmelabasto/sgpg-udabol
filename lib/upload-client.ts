// lib/upload-client.ts — validación y subida de PDFs desde el navegador.
import { MAX_PDF_BYTES } from "@/lib/projects";

export type UploadedPdf = { path: string; fileName: string; size: number };

export const MAX_PDF_MB = Math.round(MAX_PDF_BYTES / 1024 / 1024);

/** Devuelve un mensaje de error si el archivo no sirve, o null si está bien. */
export async function validatePdfFile(file: File): Promise<string | null> {
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_PDF_BYTES) {
    return `Pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${MAX_PDF_MB} MB. Comprímelo (por ejemplo con ilovepdf.com) y vuelve a intentarlo.`;
  }
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== "%PDF-") return "El archivo no es un PDF válido.";
  return null;
}

export async function uploadPdf(file: File): Promise<UploadedPdf> {
  const problem = await validatePdfFile(file);
  if (problem) throw new Error(problem);
  const form = new FormData();
  form.append("pdf", file);
  const res = await fetch("/api/upload-pdf", { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.path) throw new Error(body.error || `No se pudo subir el PDF (${res.status}).`);
  return { path: body.path, fileName: body.fileName ?? file.name, size: body.size ?? file.size };
}

/** Huella SHA-256 del archivo (para detectar el mismo PDF dos veces en un lote). */
export async function fileHash(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
