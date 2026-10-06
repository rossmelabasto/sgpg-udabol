"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Calendar,
  GraduationCap,
  FileText,
  Download,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { pdfUrlFor, type ThesisProject } from "@/lib/projects";

const CAREER_STYLES: Record<string, string> = {
  "Ingeniería en Sistemas": "bg-chart-1/10 text-chart-1 border-chart-1/20",
  "Ingeniería en Telecomunicaciones":
    "bg-chart-4/15 text-chart-4 border-chart-4/25",
  "Ingeniería Petrolera": "bg-chart-5/15 text-chart-5 border-chart-5/25",
};

export function ProjectDetail({
  project,
}: {
  project: ThesisProject;
}) {
  const [showPdf, setShowPdf] = useState(false);

  const careerStyle =
    CAREER_STYLES[project.career] ??
    "bg-secondary text-secondary-foreground border-border";

  return (
    <>
      <PdfViewerDialog
        url={project.hasPdf ? pdfUrlFor(project.id) : null}
        open={showPdf}
        onOpenChange={setShowPdf}
        title={project.title}
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Botón Volver */}
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 -ml-2 gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            Volver a proyectos
          </Button>
        </Link>

        {/* Encabezado */}
        <div className="mb-8 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={`font-medium ${careerStyle}`}
            >
              <GraduationCap className="size-3.5 mr-1" aria-hidden="true" />
              {project.career}
            </Badge>
            <Badge
              variant="outline"
              className="gap-1 font-medium text-muted-foreground"
            >
              <Calendar className="size-3.5" aria-hidden="true" />
              {project.year}
            </Badge>
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            {project.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <User className="size-4" aria-hidden="true" />
              {project.studentName}
            </span>
          </div>

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="size-4 text-muted-foreground" aria-hidden="true" />
              {project.tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="text-xs font-medium"
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Botones de acción */}
        <div className="mb-8 flex flex-wrap gap-3">
          {project.hasPdf && (
            <>
              <Button
                onClick={() => setShowPdf(true)}
                variant="default"
                size="lg"
                className="gap-2 font-semibold cursor-pointer"
              >
                <FileText className="size-5" aria-hidden="true" />
                Ver PDF
              </Button>
              <a href={pdfUrlFor(project.id, undefined, { download: true })} target="_blank" rel="noreferrer" download>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 font-semibold cursor-pointer"
                >
                  <Download className="size-5" aria-hidden="true" />
                  Descargar PDF
                </Button>
              </a>
            </>
          )}
          {!project.hasPdf && (
            <p className="text-sm italic text-muted-foreground">
              Este proyecto no tiene un PDF adjunto.
            </p>
          )}
        </div>

        {/* Resumen */}
        <section className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-foreground">Resumen</h2>
          {project.abstract ? (
            <div className="prose prose-neutral dark:prose-invert max-w-none rounded-xl border border-border bg-card p-6 text-base leading-relaxed text-card-foreground">
              {project.abstract}
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No se ha registrado un resumen para este proyecto.
            </p>
          )}
        </section>

        {/* Historial de versiones de PDF y de cambios:
            solo visibles en la vista Administrar (admin-projects.tsx),
            no en la búsqueda pública. */}
      </div>
    </>
  );
}
