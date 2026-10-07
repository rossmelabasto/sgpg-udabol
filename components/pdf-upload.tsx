"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import { extractPdfData, type PdfExtraction } from "@/lib/pdf";
import { uploadPdf, MAX_PDF_MB, type UploadedPdf } from "@/lib/upload-client";
import { discardUpload } from "@/app/actions/projects";

type Props = {
  onExtracted: (data: PdfExtraction & { pdfPath: string; pdfFileName: string }) => void;
  onUploadComplete: (upload: { path: string; fileName: string }) => void;
  /** URL para ver el PDF actual o recién subido. */
  existingPdfUrl?: string | null;
  onLoadingChange?: (loading: boolean) => void;
};

export function PdfUpload({ onExtracted, onUploadComplete, existingPdfUrl = null, onLoadingChange }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const lastUpload = useRef<UploadedPdf | null>(null);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsLoading(true);
    setError(null);
    try {
      const uploaded = await uploadPdf(file);
      // Si ya se había subido otro PDF en este formulario sin guardar, se descarta.
      if (lastUpload.current) discardUpload(lastUpload.current.path).catch(() => {});
      lastUpload.current = uploaded;
      setFileName(uploaded.fileName);
      onUploadComplete({ path: uploaded.path, fileName: uploaded.fileName });

      const data = await extractPdfData(file);
      onExtracted({ ...data, pdfPath: uploaded.path, pdfFileName: uploaded.fileName });
      if (data.scanned) setError("El PDF casi no tiene texto (¿escaneado?): completa los datos a mano.");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo procesar el PDF. Completa los campos a mano.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-5">
      <Label className="text-sm font-semibold">PDF del proyecto (opcional)</Label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent/15 has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50">
          <input type="file" accept="application/pdf" className="sr-only" onChange={handleChange} disabled={isLoading} />
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {isLoading ? "Subiendo y analizando…" : existingPdfUrl ? "Reemplazar PDF" : "Elegir PDF"}
        </label>

        {existingPdfUrl && !isLoading && (
          <a href={existingPdfUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            {fileName ? `${fileName} (sin guardar aún)` : "Ver PDF actual"}
          </a>
        )}
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <FileText className="mt-0.5 size-3.5 shrink-0" />
        Al subir el PDF se detectan título, autor, carrera, año, resumen y palabras clave (con IA). Máximo {MAX_PDF_MB} MB.
        Si reemplazas el PDF de un proyecto, la versión anterior queda en su historial.
      </p>
    </div>
  );
}
