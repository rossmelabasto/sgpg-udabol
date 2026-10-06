"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { Label } from "@/components/ui/label";
import { extractPdfData } from "@/lib/pdf";
import { FileText, Loader2, Upload, CheckCircle2 } from "lucide-react";

type ExtractedPdfData = {
  title: string;
  studentName: string;
  career: string;
  year: string;
  abstract: string;
  pdfPath: string;
  pdfFileName: string;
  keywords: string[];
};

type Props = {
  onExtracted: (data: ExtractedPdfData) => void;
  onUploadComplete: (upload: { path: string; fileName: string }) => void;
  /** URL para ver el PDF actual o recién subido. */
  existingPdfUrl?: string | null;
  onLoadingChange?: (loading: boolean) => void;
  projectId?: string | null;
};

export function PdfUpload({
  onExtracted,
  onUploadComplete,
  existingPdfUrl = null,
  onLoadingChange,
  projectId = null,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { onLoadingChange?.(isLoading); }, [isLoading, onLoadingChange]);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("pdf", file);
      if (projectId) {
        formData.append("projectId", projectId);
      }

      const uploadResponse = await fetch("/api/upload-pdf", {
        method: "POST",
        body: formData,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadResult.ok) {
        throw new Error(uploadResult.error || "No se pudo subir el PDF.");
      }

      onUploadComplete({ path: uploadResult.path, fileName: file.name });
      const data = await extractPdfData(file);
      onExtracted({ ...data, pdfPath: uploadResult.path, pdfFileName: file.name });
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "No se pudo procesar el PDF automáticamente. Intenta con otro archivo o completa los campos manualmente.",
      );
      console.error(err);
    } finally {
      setIsLoading(false);
      event.target.value = ""; // Reset para evitar caché de archivo
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <Label className="text-sm font-semibold">
        PDF del proyecto (opcional)
      </Label>

      <div className="relative inline-flex h-10 w-fit cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-4 py-2 text-sm font-medium shadow-sm transition-all hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50">
        <input
          type="file"
          accept="application/pdf"
          className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0"
          onChange={handleChange}
          disabled={isLoading}
          title=""
        />
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {isLoading ? "Procesando..." : "Explorar PDF"}
      </div>

      {existingPdfUrl && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
          <CheckCircle2 className="size-4" />
          <a
            href={existingPdfUrl}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-emerald-700"
          >
            Ver PDF
          </a>
        </div>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        <FileText className="inline size-3 mr-1" />
        Al subir el PDF, extraemos título, autor y resumen automáticamente.
      </p>
    </div>
  );
}
