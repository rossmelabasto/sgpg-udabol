"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { pdfUrlFor, type SearchResult } from "@/lib/projects"
import { User, Calendar, GraduationCap, FileText, Tag } from "lucide-react"
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog"

const CAREER_STYLES: Record<string, string> = {
  "Ingeniería en Sistemas": "bg-chart-1/10 text-chart-1 border-chart-1/20",
  "Ingeniería en Telecomunicaciones": "bg-chart-4/15 text-chart-4 border-chart-4/25",
  "Ingeniería Petrolera": "bg-chart-5/15 text-chart-5 border-chart-5/25",
}

export function ProjectCard({ project }: { project: SearchResult }) {
  const [showPdf, setShowPdf] = useState(false)
  
  const careerStyle =
    CAREER_STYLES[project.career] ?? "bg-secondary text-secondary-foreground border-border"

  return (
    <>
      <PdfViewerDialog
        url={project.hasPdf ? pdfUrlFor(project.id) : null}
        open={showPdf}
        onOpenChange={setShowPdf}
        title={project.title}
      />
      
      <article className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`font-medium ${careerStyle}`}>
              <GraduationCap className="size-3.5 mr-1" aria-hidden="true" />
              {project.career}
            </Badge>
            <Badge variant="outline" className="gap-1 font-medium text-muted-foreground">
              <Calendar className="size-3.5" aria-hidden="true" />
              {project.year}
            </Badge>
          </div>

          <Link
            href={`/proyecto/${project.id}`}
            className="text-pretty text-lg font-bold leading-snug text-card-foreground hover:text-primary transition-colors"
          >
            {project.title}
          </Link>

          {project.abstract && (
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {project.abstract}
            </p>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {project.tags.slice(0, 5).map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px] font-medium px-1.5 py-0">
                  {t}
                </Badge>
              ))}
              {project.tags.length > 5 && (
                <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 text-muted-foreground">
                  +{project.tags.length - 5}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <User className="size-4" aria-hidden="true" />
            {project.studentName}
          </span>
          {project.hasPdf && (
            <button
              onClick={() => setShowPdf(true)}
              type="button"
              className="flex items-center gap-1.5 font-medium text-primary hover:underline cursor-pointer"
            >
              <FileText className="size-4" aria-hidden="true" />
              Ver PDF
            </button>
          )}
        </div>
      </article>
    </>
  )
}
