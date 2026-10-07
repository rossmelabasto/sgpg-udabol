import { describe, expect, it, vi } from "vitest";
import { resolvePdfPath, isValidPdfPath, looksLikePdf, buildStoragePath } from "@/lib/pdf-storage";

// vi.mock se eleva al inicio del archivo: Firebase Admin no se inicializa en las pruebas.
vi.mock("@/lib/firebase/admin", () => ({ adminStorage: {}, adminDb: {}, adminAuth: {} }));

describe("rutas de PDF", () => {
  it("usa pdfPath si existe", () => {
    expect(resolvePdfPath({ pdfPath: "projects/a.pdf", pdfUrl: "https://x/projects/b.pdf" })).toBe("projects/a.pdf");
  });
  it("extrae la ruta de URLs firmadas antiguas (con nombres codificados)", () => {
    const url = "https://storage.googleapis.com/udabol.firebasestorage.app/projects/abc-Proyecto%2520de%2520Grado.pdf?X-Goog-Signature=1";
    expect(resolvePdfPath({ pdfUrl: url })).toBe("projects/abc-Proyecto%20de%20Grado.pdf");
    const fb = "https://firebasestorage.googleapis.com/v0/b/bucket/o/projects%2Fxyz.pdf?alt=media";
    expect(resolvePdfPath({ pdfUrl: fb })).toBe("projects/xyz.pdf");
  });
  it("sin PDF devuelve null", () => {
    expect(resolvePdfPath({})).toBeNull();
    expect(resolvePdfPath({ pdfUrl: "no es url" })).toBeNull();
  });
  it("solo acepta rutas dentro de projects/ y sin '..'", () => {
    expect(isValidPdfPath("projects/a.pdf")).toBe(true);
    expect(isValidPdfPath("otros/a.pdf")).toBe(false);
    expect(isValidPdfPath("projects/../secreto")).toBe(false);
    expect(isValidPdfPath(undefined)).toBe(false);
  });
  it("reconoce la firma %PDF-", () => {
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode("Esto no es un PDF"))).toBe(false);
  });
  it("arma nombres seguros", () => {
    const p = buildStoragePath("Tésis final (v2)?.pdf");
    expect(p.startsWith("projects/")).toBe(true);
    expect(p).toMatch(/Tesis-final-v2-\.pdf$/);
  });
});
