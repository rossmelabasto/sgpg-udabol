"use client";

// Subida masiva en tres pasos: 1) se analizan los PDFs (IA + heurística),
// 2) el administrador revisa y corrige los datos detectados (con avisos de
// duplicados y PDFs escaneados), 3) se guardan solo los seleccionados.
// Si un guardado falla después de subir el PDF, el PDF se descarta para no
// dejar archivos huérfanos en Storage.
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Save,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { extractPdfData } from "@/lib/pdf";
import { fileHash, uploadPdf, validatePdfFile, MAX_PDF_MB } from "@/lib/upload-client";
import { checkDuplicates, createProject, discardUpload, type DuplicateMatch } from "@/app/actions/projects";
import { CARRERAS } from "@/lib/projects";

type Status = "analizando" | "listo" | "guardando" | "guardado" | "error";

type Item = {
  id: string;
  file: File;
  status: Status;
  include: boolean;
  open: boolean;
  title: string;
  studentName: string;
  career: string;
  year: string;
  abstract: string;
  tags: string;
  scanned?: boolean;
  aiUsed?: boolean;
  hash?: string;
  sameFileAs?: string;
  duplicates: DuplicateMatch[];
  error?: string;
  savedId?: string;
};

const maxYear = new Date().getFullYear() + 1;

function problems(it: Item): string[] {
  const p: string[] = [];
  if (!it.title.trim()) p.push("falta el título");
  if (!it.studentName.trim()) p.push("falta el alumno");
  if (!CARRERAS.includes(it.career as (typeof CARRERAS)[number])) p.push("elige la carrera");
  const y = Number(it.year);
  if (!Number.isInteger(y) || y < 1990 || y > maxYear) p.push("año inválido");
  return p;
}

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift()!);
    }),
  );
}

export function BulkPdfUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = (id: string, p: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  async function addFiles(files: File[]) {
    const fresh: Item[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "analizando",
      include: true,
      open: false,
      title: "",
      studentName: "",
      career: "",
      year: "",
      abstract: "",
      tags: "",
      duplicates: [],
    }));
    setItems((prev) => [...prev, ...fresh]);

    const analyzed: Item[] = [];
    await pool(fresh, 2, async (it) => {
      const invalid = await validatePdfFile(it.file);
      if (invalid) {
        patch(it.id, { status: "error", include: false, error: invalid });
        return;
      }
      try {
        const [data, hash] = await Promise.all([extractPdfData(it.file), fileHash(it.file)]);
        const result: Partial<Item> = {
          status: "listo",
          title: data.title,
          studentName: data.studentName,
          career: data.career,
          year: data.year,
          abstract: data.abstract,
          tags: data.keywords.join(", "),
          scanned: data.scanned,
          aiUsed: data.aiUsed,
          hash,
        };
        analyzed.push({ ...it, ...result } as Item);
        patch(it.id, result);
      } catch {
        patch(it.id, { status: "listo", scanned: true, open: true, error: undefined });
        analyzed.push({ ...it, status: "listo" });
      }
    });

    // Duplicados: mismo archivo dentro del lote y títulos parecidos a proyectos existentes.
    const dupes = await checkDuplicates(analyzed.map((a) => ({ title: a.title, studentName: a.studentName })));
    setItems((prev) => {
      const seen = new Map<string, string>();
      return prev.map((it) => {
        let next = it;
        if (it.hash) {
          const first = seen.get(it.hash);
          if (first && first !== it.id) next = { ...next, sameFileAs: first, include: false };
          else seen.set(it.hash, it.id);
        }
        const idx = analyzed.findIndex((a) => a.id === it.id);
        if (idx >= 0) {
          const d = dupes.filter((x) => x.index === idx);
          if (d.length) next = { ...next, duplicates: d, include: false };
        }
        if (next.status === "listo" && problems(next).length) next = { ...next, open: true };
        return next;
      });
    });
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) addFiles(files);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (files.length) addFiles(files);
  }

  async function saveSelected() {
    const toSave = items.filter((it) => it.include && it.status === "listo" && problems(it).length === 0);
    if (!toSave.length) return;
    setSaving(true);
    await pool(toSave, 2, async (it) => {
      patch(it.id, { status: "guardando", error: undefined });
      let uploadedPath: string | null = null;
      try {
        const up = await uploadPdf(it.file);
        uploadedPath = up.path;
        const res = await createProject({
          title: it.title,
          studentName: it.studentName,
          career: it.career,
          year: Number(it.year),
          abstract: it.abstract,
          tags: it.tags.split(",").map((t) => t.trim()).filter(Boolean),
          pdfPath: up.path,
          pdfFileName: up.fileName,
        });
        if (!res.ok) throw new Error(res.error);
        patch(it.id, { status: "guardado", include: false, open: false, savedId: res.id });
      } catch (err) {
        if (uploadedPath) await discardUpload(uploadedPath).catch(() => {});
        patch(it.id, { status: "listo", open: true, error: err instanceof Error ? err.message : "Error desconocido" });
      }
    });
    setSaving(false);
    onSuccess?.();
  }

  const analyzing = items.some((it) => it.status === "analizando");
  const ready = items.filter((it) => it.include && it.status === "listo" && problems(it).length === 0);
  const saved = items.filter((it) => it.status === "guardado").length;

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-accent bg-accent/10" : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
        } ${saving ? "pointer-events-none opacity-60" : ""}`}
      >
        <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onPick} />
        <UploadCloud className="size-9 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Arrastra los PDFs aquí o haz clic para elegirlos</p>
        <p className="text-xs text-muted-foreground">
          Hasta {MAX_PDF_MB} MB por archivo. Primero revisas los datos detectados; nada se guarda hasta que confirmes.
        </p>
      </div>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {items.length} archivo{items.length !== 1 && "s"} · {ready.length} listo{ready.length !== 1 && "s"} para guardar
              {saved > 0 && <> · <span className="font-medium text-emerald-600 dark:text-emerald-400">{saved} guardado{saved !== 1 && "s"}</span></>}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setItems([])} disabled={saving || analyzing}>
                Limpiar lista
              </Button>
              <Button size="sm" onClick={saveSelected} disabled={saving || analyzing || ready.length === 0}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar {ready.length || ""} proyecto{ready.length !== 1 && "s"}
              </Button>
            </div>
          </div>

          <ul className="flex flex-col gap-2">
            {items.map((it) => {
              const p = problems(it);
              const warn = it.scanned || it.duplicates.length > 0 || !!it.sameFileAs;
              return (
                <li key={it.id} className="rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={it.include}
                      disabled={it.status !== "listo"}
                      onChange={(e) => patch(it.id, { include: e.target.checked })}
                      aria-label="Incluir al guardar"
                    />
                    <StatusIcon status={it.status} warn={warn} invalid={p.length > 0 && it.status === "listo"} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => patch(it.id, { open: !it.open })}>
                      <p className="truncate text-sm font-medium text-foreground">{it.title || it.file.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {it.status === "analizando"
                          ? "Analizando…"
                          : it.status === "guardando"
                            ? "Guardando…"
                            : it.status === "guardado"
                              ? "Guardado"
                              : it.error
                                ? it.error
                                : p.length && it.status === "listo"
                                  ? `Revisa: ${p.join(", ")}`
                                  : [it.studentName, it.career, it.year].filter(Boolean).join(" · ") || it.file.name}
                      </p>
                    </button>
                    {it.status !== "guardando" && it.status !== "guardado" && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label="Quitar de la lista"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                    <ChevronDown className={`size-4 text-muted-foreground transition-transform ${it.open ? "rotate-180" : ""}`} />
                  </div>

                  {(it.sameFileAs || it.duplicates.length > 0 || it.scanned) && it.status !== "guardado" && (
                    <div className="space-y-1 border-t border-border bg-amber-500/5 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
                      {it.sameFileAs && <p>⚠ Es el mismo archivo que otro de esta lista; no se guardará salvo que lo marques.</p>}
                      {it.duplicates.map((d) => (
                        <p key={d.id}>
                          ⚠ Parece repetido: ya existe «{d.title}» de {d.studentName} ({Math.round(d.similarity * 100)}% parecido).{" "}
                          <a href={`/proyecto/${d.id}`} target="_blank" rel="noreferrer" className="underline">
                            Ver
                          </a>
                        </p>
                      ))}
                      {it.scanned && <p>⚠ El PDF casi no tiene texto (¿escaneado?): completa los datos a mano.</p>}
                    </div>
                  )}

                  {it.open && it.status === "listo" && (
                    <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-2">
                      <Field label="Título" className="sm:col-span-2">
                        <Input value={it.title} onChange={(e) => patch(it.id, { title: e.target.value })} />
                      </Field>
                      <Field label="Alumno">
                        <Input value={it.studentName} onChange={(e) => patch(it.id, { studentName: e.target.value })} />
                      </Field>
                      <div className="grid grid-cols-[1fr_6rem] gap-3">
                        <Field label="Carrera">
                          <Select value={it.career} onValueChange={(v) => patch(it.id, { career: v ?? "" })}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Elige…" />
                            </SelectTrigger>
                            <SelectContent>
                              {CARRERAS.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Año">
                          <Input inputMode="numeric" value={it.year} onChange={(e) => patch(it.id, { year: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                        </Field>
                      </div>
                      <Field label="Palabras clave (separadas por coma)" className="sm:col-span-2">
                        <Input value={it.tags} onChange={(e) => patch(it.id, { tags: e.target.value })} />
                      </Field>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
                        <FileText className="size-3.5" /> {it.file.name} · {(it.file.size / 1024 / 1024).toFixed(1)} MB
                        {it.aiUsed === false && !it.scanned && " · la IA no respondió: datos por heurística"}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 text-xs font-semibold text-muted-foreground ${className}`}>
      {label}
      {children}
    </label>
  );
}

function StatusIcon({ status, warn, invalid }: { status: Status; warn: boolean; invalid: boolean }) {
  if (status === "analizando" || status === "guardando") return <Loader2 className="size-5 shrink-0 animate-spin text-primary" />;
  if (status === "guardado") return <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  if (status === "error") return <XCircle className="size-5 shrink-0 text-destructive" />;
  if (invalid || warn) return <AlertTriangle className="size-5 shrink-0 text-amber-500" />;
  return <CheckCircle2 className="size-5 shrink-0 text-muted-foreground" />;
}
