"use client";

import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, PencilLine, Plus, Sparkles, X } from "lucide-react";
import { createProject, updateProject } from "@/app/actions/projects";
import { CARRERAS, pdfUrlFor, type SearchResult } from "@/lib/projects";
import type { PdfExtraction } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PdfUpload } from "@/components/pdf-upload";
import { PdfComparisonDialog } from "@/components/pdf-comparison-dialog";

type ProjectFormProps = {
  mode?: "create" | "edit";
  project?: SearchResult | null;
  onSuccess?: (destinationTab?: string) => void;
  destinationTab?: string;
};

type Extracted = PdfExtraction & { pdfPath: string; pdfFileName: string };

const maxYear = new Date().getFullYear() + 1;

export function ProjectForm({ mode = "create", project = null, onSuccess, destinationTab }: ProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pdfLoading, setPdfLoading] = useState(false);
  // El padre le pone key={project.id}: al cambiar de proyecto se monta de nuevo.
  const [title, setTitle] = useState(project?.title ?? "");
  const [studentName, setStudentName] = useState(project?.studentName ?? "");
  const [career, setCareer] = useState(project?.career ?? "");
  const [year, setYear] = useState(project ? String(project.year) : "");
  const [abstract, setAbstract] = useState(project?.abstract ?? "");
  const [tags, setTags] = useState<string[]>(project?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  // PDF recién subido en este formulario (aún no guardado en el proyecto).
  const [newPdf, setNewPdf] = useState<{ path: string; fileName: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);

  const current = { title, studentName, career, year, abstract, tags: tags.join(", ") };

  function apply(data: Extracted) {
    if (data.title) setTitle(data.title);
    if (data.studentName) setStudentName(data.studentName);
    if (data.career) setCareer(data.career);
    if (data.year) setYear(data.year);
    if (data.abstract) setAbstract(data.abstract);
    if (data.keywords?.length) setTags(data.keywords);
    setAutoFilled(true);
  }

  function handlePdfExtracted(data: Extracted) {
    const formEmpty = !title.trim() && !studentName.trim() && !abstract.trim();
    if (formEmpty) {
      apply(data);
      return;
    }
    const differs =
      (data.title && data.title !== title) ||
      (data.studentName && data.studentName !== studentName) ||
      (data.abstract && data.abstract !== abstract);
    if (differs) setExtracted(data);
  }

  function addTag(raw: string) {
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (!parts.length) return;
    setTags((prev) => [...prev, ...parts.filter((t) => !prev.some((p) => p.toLowerCase() === t.toLowerCase()))].slice(0, 12));
    setTagDraft("");
  }

  function onTagKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === "Backspace" && !tagDraft && tags.length) {
      setTags((t) => t.slice(0, -1));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const y = Number(year);
    if (!career) return setFeedback({ type: "error", text: "Elige la carrera." });
    if (!Number.isInteger(y) || y < 1990 || y > maxYear) return setFeedback({ type: "error", text: `El año debe estar entre 1990 y ${maxYear}.` });

    const allTags = tagDraft.trim() ? [...tags, ...tagDraft.split(",").map((t) => t.trim()).filter(Boolean)] : tags;
    startTransition(async () => {
      const payload = {
        title,
        studentName,
        career,
        year: y,
        abstract,
        tags: allTags,
        ...(newPdf ? { pdfPath: newPdf.path, pdfFileName: newPdf.fileName } : {}),
      };
      const res = mode === "edit" && project ? await updateProject(project.id, payload) : await createProject(payload);
      if (!res.ok) return setFeedback({ type: "error", text: res.error });

      setFeedback({ type: "ok", text: mode === "edit" ? "Proyecto actualizado." : "Proyecto registrado. Puedes registrar otro." });
      if (mode !== "edit") {
        setTitle("");
        setStudentName("");
        setCareer("");
        setYear("");
        setAbstract("");
        setTags([]);
        setAutoFilled(false);
      }
      setNewPdf(null);
      setTagDraft("");
      router.refresh();
      onSuccess?.(destinationTab);
    });
  }

  const pdfLink = newPdf
    ? `${pdfUrlFor("_subida")}?path=${encodeURIComponent(newPdf.path)}`
    : project?.hasPdf
      ? pdfUrlFor(project.id)
      : null;

  return (
    <>
      <PdfComparisonDialog
        open={!!extracted}
        current={current}
        extracted={
          extracted
            ? { title: extracted.title, studentName: extracted.studentName, career: extracted.career, year: extracted.year, abstract: extracted.abstract, tags: extracted.keywords.join(", ") }
            : current
        }
        onUseExtracted={() => {
          if (extracted) apply(extracted);
          setExtracted(null);
        }}
        onKeepCurrent={() => setExtracted(null)}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <PdfUpload onExtracted={handlePdfExtracted} onUploadComplete={setNewPdf} existingPdfUrl={pdfLink} onLoadingChange={setPdfLoading} />

        {autoFilled && (
          <p className="flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-foreground">
            <Sparkles className="size-4 shrink-0 text-gold-dark dark:text-gold" />
            Completamos los campos con los datos del PDF. Revísalos antes de guardar.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="title">
            Título del proyecto <span className="text-destructive">*</span>
          </Label>
          <Textarea id="title" required rows={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Sistema de gestión de inventarios con predicción de demanda" className="min-h-0 resize-y text-base" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="studentName">
              Alumno/a <span className="text-destructive">*</span>
            </Label>
            <Input id="studentName" required value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Nombre completo" className="h-11 text-base" />
            <p className="text-xs text-muted-foreground">Si son dos, sepáralos con « / ».</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="career">
                Carrera <span className="text-destructive">*</span>
              </Label>
              <Select value={career} onValueChange={(v) => v && setCareer(v)}>
                <SelectTrigger id="career" className="!h-11 w-full text-base">
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="year">
                Año <span className="text-destructive">*</span>
              </Label>
              <Input id="year" required inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={String(maxYear - 1)} className="h-11 text-base" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="abstract">Resumen</Label>
          <Textarea id="abstract" rows={5} value={abstract} onChange={(e) => setAbstract(e.target.value)} placeholder="Objetivo, alcance y resultados principales del proyecto…" className="resize-y text-base leading-relaxed" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tags">Palabras clave</Label>
          <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {t}
                <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} aria-label={`Quitar ${t}`} className="rounded-full hover:text-destructive">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="tags"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={onTagKey}
              onBlur={() => addTag(tagDraft)}
              placeholder={tags.length ? "" : "Ej. IoT, monitoreo, fibra óptica"}
              className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">Escribe y presiona Enter o coma. Cortas (1 a 3 palabras), útiles para buscar.</p>
        </div>

        {feedback && (
          <div
            role="status"
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
              feedback.type === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}
          >
            {feedback.type === "ok" ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertCircle className="size-5 shrink-0" />}
            {feedback.text}
          </div>
        )}

        <Button type="submit" size="lg" disabled={isPending || pdfLoading} className="h-12 rounded-xl text-base font-semibold sm:w-fit sm:px-8">
          {isPending ? <Loader2 className="size-5 animate-spin" /> : mode === "edit" ? <PencilLine className="size-5" /> : <Plus className="size-5" />}
          {isPending ? "Guardando…" : mode === "edit" ? "Guardar cambios" : "Registrar proyecto"}
        </Button>
      </form>
    </>
  );
}
