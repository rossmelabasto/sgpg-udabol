"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenText, Calendar, Check, Download, Link2, Maximize2, Tag, User } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PdfViewer } from "@/components/pdf-viewer";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { CareerBadge } from "@/components/career-badge";
import { pdfUrlFor, type ThesisProject } from "@/lib/projects";

export function ProjectDetail({ project, related = [] }: { project: ThesisProject; related?: ThesisProject[] }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pdfUrl = pdfUrlFor(project.id);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <>
      {project.hasPdf && <PdfViewerDialog url={pdfUrl} open={fullscreen} onOpenChange={setFullscreen} title={project.title} />}

      {/* Encabezado */}
      <section className="border-b border-border bg-card/70">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
          <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Volver al repositorio
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <CareerBadge career={project.career} />
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="size-4" aria-hidden="true" /> {project.year}
            </span>
          </div>

          <h1 className="mt-4 font-heading text-2xl font-semibold leading-tight text-foreground sm:text-4xl">{project.title}</h1>

          <p className="mt-4 flex items-center gap-2 text-base text-foreground">
            <User className="size-5 text-gold-dark dark:text-gold" aria-hidden="true" />
            <span className="font-medium">{project.studentName}</span>
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {project.hasPdf && (
              <>
                <a href="#documento" className={buttonVariants({ variant: "gold", size: "lg", className: "h-10 rounded-lg px-4" })}>
                  <BookOpenText className="size-4" /> Leer documento
                </a>
                <a href={pdfUrlFor(project.id, undefined, { download: true })} className={buttonVariants({ variant: "outline", size: "lg", className: "h-10 rounded-lg px-4" })}>
                  <Download className="size-4" /> Descargar PDF
                </a>
              </>
            )}
            <Button variant="outline" size="lg" onClick={copyLink} className="h-10 rounded-lg px-4">
              {copied ? <Check className="size-4 text-success" /> : <Link2 className="size-4" />}
              {copied ? "Enlace copiado" : "Copiar enlace"}
            </Button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">Resumen</h2>
            {project.abstract ? (
              <p className="whitespace-pre-line rounded-xl border border-border bg-card p-5 text-[15px] leading-relaxed text-card-foreground shadow-card">
                {project.abstract}
              </p>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-5 text-sm italic text-muted-foreground">
                Este proyecto todavía no tiene resumen registrado.
              </p>
            )}
          </section>

          <section id="documento" className="scroll-mt-24">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-heading text-xl font-semibold text-foreground">Documento</h2>
              {project.hasPdf && (
                <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)}>
                  <Maximize2 className="size-4" /> Pantalla completa
                </Button>
              )}
            </div>
            {project.hasPdf ? (
              <div className="h-[75vh] min-h-[420px] overflow-hidden rounded-xl border border-border shadow-card">
                <PdfViewer key={pdfUrl} url={pdfUrl} title={project.title} />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-5 text-sm italic text-muted-foreground">
                El documento digital de este proyecto aún no fue cargado al repositorio.
              </p>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          {project.tags && project.tags.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Tag className="size-3.5" /> Palabras clave
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((t) => (
                  <Link
                    key={t}
                    href={`/?tag=${encodeURIComponent(t)}`}
                    className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-secondary-foreground hover:border-gold/60 hover:bg-gold/10"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proyectos relacionados</h2>
              <ul className="flex flex-col gap-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/proyecto/${r.id}`} className="block rounded-lg border border-border bg-card p-3 text-sm shadow-card transition-colors hover:border-gold/50">
                      <span className="line-clamp-3 font-medium leading-snug text-foreground">{r.title}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {r.studentName} · {r.year}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
