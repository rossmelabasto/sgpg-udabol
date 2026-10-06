"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Calendar, FileText, User } from "lucide-react";
import type { SearchResult } from "@/lib/projects";
import { pdfUrlFor } from "@/lib/projects";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { CareerBadge } from "@/components/career-badge";

export function ProjectCard({
  project,
  onTagClick,
  activeTag,
}: {
  project: SearchResult;
  onTagClick?: (tag: string) => void;
  activeTag?: string;
}) {
  const [showPdf, setShowPdf] = useState(false);
  const tags = project.tags ?? [];

  return (
    <>
      {project.hasPdf && (
        <PdfViewerDialog url={pdfUrlFor(project.id)} open={showPdf} onOpenChange={setShowPdf} title={project.title} />
      )}

      <article className="hover-lift group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-card hover:border-gold/50">
        <div className="flex flex-wrap items-center gap-2">
          <CareerBadge career={project.career} />
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden="true" />
            {project.year}
          </span>
          {project.hasPdf && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
              <FileText className="size-3" /> PDF
            </span>
          )}
        </div>

        <h3 className="font-heading text-lg font-semibold leading-snug text-card-foreground">
          <Link href={`/proyecto/${project.id}`} className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none group-hover:text-primary dark:group-hover:text-gold">
            {project.title}
          </Link>
        </h3>

        {project.abstract && <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{project.abstract}</p>}

        {tags.length > 0 && (
          <div className="relative z-10 flex flex-wrap gap-1.5">
            {tags.slice(0, 5).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTagClick?.(t)}
                disabled={!onTagClick}
                title={onTagClick ? `Ver proyectos con «${t}»` : undefined}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  activeTag && activeTag.toLowerCase() === t.toLowerCase()
                    ? "border-gold bg-gold/15 text-foreground"
                    : "border-border bg-secondary/60 text-secondary-foreground hover:border-gold/60 hover:bg-gold/10"
                }`}
              >
                {t}
              </button>
            ))}
            {tags.length > 5 && <span className="px-1 py-0.5 text-[11px] text-muted-foreground">+{tags.length - 5}</span>}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
            <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{project.studentName}</span>
          </span>
          {project.hasPdf ? (
            <button
              type="button"
              onClick={() => setShowPdf(true)}
              className="relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-medium text-primary hover:bg-secondary dark:text-gold"
            >
              <FileText className="size-4" aria-hidden="true" /> Leer
            </button>
          ) : (
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          )}
        </div>
      </article>
    </>
  );
}
