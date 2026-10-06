"use client";

import { useState, useCallback, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UploadCloud, FileText, XCircle, Play, Loader2, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import { extractPdfData } from "@/lib/pdf";
import { createProject } from "@/app/actions/projects";

type BulkFile = {
  id: string;
  file: File;
  status: "pending" | "extracting" | "uploading" | "done" | "error";
  timestamp?: string;
  errorMsg?: string;
};

export function BulkPdfUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const newBulkFiles: BulkFile[] = selectedFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: "pending",
    }));

    setFiles((prev) => [...prev, ...newBulkFiles]);
    event.target.value = "";
  }

  function removeFile(idToRemove: string) {
    setFiles((prev) => prev.filter((f) => f.id !== idToRemove));
  }

  const updateFileStatus = useCallback((id: string, status: BulkFile["status"], extra?: Partial<BulkFile>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status, ...extra } : f))
    );
  }, []);

  async function processSingleFile(bulkFile: BulkFile): Promise<void> {
    const { id, file } = bulkFile;
    try {
      updateFileStatus(id, "extracting");
      const metadata = await extractPdfData(file);

      updateFileStatus(id, "uploading");
      const formData = new FormData();
      formData.append("pdf", file);
      const uploadRes = await fetch("/api/upload-pdf", { method: "POST", body: formData });
      const uploaded = await uploadRes.json();
      if (!uploadRes.ok || !uploaded.path) throw new Error(uploaded.error || `Error al subir el PDF (${uploadRes.status})`);

      const result = await createProject({
        title: metadata.title,
        studentName: metadata.studentName,
        career: metadata.career,
        year: parseInt(metadata.year, 10) || new Date().getFullYear(),
        abstract: metadata.abstract,
        pdfPath: uploaded.path,
        pdfFileName: file.name,
        tags: metadata.keywords ?? [],
      });
      if (!result.ok) throw new Error(result.error || "Error al crear el proyecto");

      updateFileStatus(id, "done", { timestamp: new Date().toLocaleString("es-BO") });
    } catch (error: any) {
      console.error(`Error procesando "${file.name}":`, error);
      updateFileStatus(id, "error", {
        errorMsg: error?.message || "Error desconocido",
        timestamp: new Date().toLocaleString("es-BO"),
      });
    } finally {
      setCompletedCount((prev) => prev + 1);
    }
  }

  async function startBulkProcess() {
    setIsProcessing(true);
    setCompletedCount(0);
    const CONCURRENCY = 3;
    const pendingFiles = files.filter((f) => f.status === "pending" || f.status === "error");
    // Reset errores a pending
    setFiles((prev) => prev.map((f) => (f.status === "error" ? { ...f, status: "pending", errorMsg: undefined } : f)));

    for (let i = 0; i < pendingFiles.length; i += CONCURRENCY) {
      const batch = pendingFiles.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((bf) => processSingleFile(bf)));
    }

    setIsProcessing(false);
    onSuccess?.();
  }

  const pendingCount = files.filter((f) => f.status === "pending" || f.status === "error").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-10 transition-colors hover:bg-muted/40 hover:border-primary/50">
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0"
          onChange={handleFileSelect}
          disabled={isProcessing}
          title=""
        />
        <UploadCloud className="mb-4 size-10 text-muted-foreground" />
        <p className="text-center text-sm font-medium text-foreground">
          Haz clic o arrastra múltiples PDFs aquí
        </p>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="font-semibold">
              Archivos en cola ({files.length})
              {pendingCount > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({pendingCount} pendientes)
                </span>
              )}
            </h3>
            <Button
              onClick={startBulkProcess}
              disabled={isProcessing || pendingCount === 0}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              Procesar todo
            </Button>
          </div>

          {isProcessing && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Procesando {completedCount} de {files.length}</span>
                <span>{Math.round((completedCount / files.length) * 100)}%</span>
              </div>
              <div className="w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${Math.round((completedCount / files.length) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {files.map((item) => (
              <Card key={item.id} className="flex items-center justify-between p-3">
                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                  {item.status === "extracting" || item.status === "uploading" ? (
                    <Loader2 className="size-5 shrink-0 animate-spin text-blue-500" />
                  ) : item.status === "done" ? (
                    <CheckCircle2 className="size-5 shrink-0 text-green-500" />
                  ) : item.status === "error" ? (
                    <AlertTriangle className="size-5 shrink-0 text-destructive" />
                  ) : (
                    <FileText className="size-5 shrink-0 text-primary" />
                  )}

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.file.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.status === "extracting" && "Extrayendo datos..."}
                      {item.status === "uploading" && "Subiendo PDF..."}
                      {item.status === "done" && (item.timestamp ? `Completado ${item.timestamp}` : "Completado")}
                      {item.status === "error" && (item.errorMsg ? `Error: ${item.errorMsg}` : "Error")}
                      {item.status === "pending" && "Pendiente"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {item.status === "error" && !isProcessing && (
                    <button
                      type="button"
                      onClick={() => {
                        updateFileStatus(item.id, "pending", { errorMsg: undefined });
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                      title="Reintentar"
                    >
                      <RotateCcw className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    disabled={isProcessing}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-30"
                  >
                    <XCircle className="size-5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
