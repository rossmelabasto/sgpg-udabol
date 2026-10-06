"use client";

import { useState, useEffect } from "react";
import { getProjects, getTopContributors, type TopContributor } from "@/app/actions/projects";
import type { SearchResult } from "@/lib/projects";
import {
  BarChart3, BookOpen, FileText,
  Calendar, FolderOpen, FileX2, Hash, Users,
  Medal,
} from "lucide-react";

export function Dashboard() {
  const [projects, setProjects] = useState<SearchResult[]>([]);
  const [contributors, setContributors] = useState<TopContributor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getProjects(),
      getTopContributors(3),
    ]).then(([rows, top]) => {
      setProjects(rows.map((r) => ({ ...r, score: 0 })));
      setContributors(top);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-16 text-muted-foreground"><BarChart3 className="size-8 animate-pulse" /></div>;
  }

  const total = projects.length;
  const conPdf = projects.filter((p) => p.hasPdf).length;
  const sinPdf = total - conPdf;

  const carreras: Record<string, number> = {};
  const anos: Record<string, number> = {};
  const tagsFreq: Record<string, number> = {};
  let totalTags = 0;

  for (const p of projects) {
    carreras[p.career] = (carreras[p.career] || 0) + 1;
    const key = String(p.year);
    anos[key] = (anos[key] || 0) + 1;
    if (p.tags) {
      for (const tag of p.tags) {
        tagsFreq[tag.toLowerCase()] = (tagsFreq[tag.toLowerCase()] || 0) + 1;
        totalTags++;
      }
    }
  }

  const topCarreras = Object.entries(carreras).sort((a, b) => b[1] - a[1]);
  const topTags = Object.entries(tagsFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const anosList = Object.entries(anos).sort((a, b) => Number(b[0]) - Number(a[0]));

  return (
    <div className="flex flex-col gap-6">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={<BookOpen className="size-6" />} label="Total Proyectos" value={total} color="text-primary" bg="bg-primary/10" />
        <StatCard icon={<FileText className="size-6" />} label="Con PDF" value={conPdf} color="text-[oklch(0.55_0.15_150)]" bg="bg-[oklch(0.55_0.15_150)]/10" />
        <StatCard icon={<Users className="size-6" />} label="Tags distintas" value={Object.keys(tagsFreq).length} color="text-[oklch(0.55_0.15_280)]" bg="bg-[oklch(0.55_0.15_280)]/10" />
      </div>

      {/* Proyectos por carrera */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-card-foreground">
          <FolderOpen className="size-5 text-primary" /> Proyectos por Carrera
        </h3>
        <div className="space-y-3">
          {topCarreras.map(([carrera, count]) => (
            <BarRow key={carrera} label={carrera} count={count} max={topCarreras[0]?.[1] || 1} />
          ))}
        </div>
      </div>

      {/* Tags más frecuentes */}
      {topTags.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-card-foreground">
            <Hash className="size-5 text-primary" /> Temas más recurrentes
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {totalTags} tags en total · {Object.keys(tagsFreq).length} tags únicas
          </p>
          <div className="flex flex-wrap gap-2">
            {topTags.map(([tag, count]) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
              >
                {tag}
                <span className="text-xs text-muted-foreground">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Evolución por año */}
      {anosList.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-card-foreground">
            <Calendar className="size-5 text-primary" /> Proyectos por Año
          </h3>
          <div className="space-y-3">
            {anosList.map(([ano, count]) => {
              const maxVal = Math.max(...Object.values(anos));
              return (
                <BarRow key={ano} label={ano} count={count} max={maxVal} total={total} />
              );
            })}
          </div>
        </div>
      )}
      {/* Top contribuidores */}
      {contributors.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-card-foreground">
            <Medal className="size-5 text-primary" /> Top usuarios con más cambios
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Usuarios que más modificaciones han hecho en el sistema (creación, edición, eliminación de proyectos).
          </p>
          <div className="space-y-3">
            {contributors.map((c, i) => {
              const maxCount = contributors[0]?.count || 1;
              const medals = ["text-amber-500", "text-slate-400", "text-orange-700"];
              return (
                <div key={c.name} className="flex items-center gap-3">
                  <span className={`text-lg font-bold w-6 ${medals[i] || "text-muted-foreground"}`}>
                    #{i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium text-foreground ">{c.name}</span>
                  <div className="flex-1 h-4 rounded-lg bg-muted overflow-hidden max-w-[200px]">
                    <div
                      className="h-full rounded-lg bg-chart-2 transition-all duration-500"
                      style={{ width: `${Math.round((c.count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-semibold text-card-foreground">{c.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Proyectos sin PDF */}
      {sinPdf > 0 && (
        <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-5">
          <h3 className="flex items-center gap-2 text-lg font-bold text-amber-700 dark:text-amber-400">
            <FileX2 className="size-5" /> {sinPdf} proyecto{sinPdf !== 1 ? "s" : ""} sin PDF adjunto
          </h3>
          <p className="mt-1 text-sm text-amber-600/80 dark:text-amber-300/80">
            Considera subir los PDFs faltantes para completar el repositorio.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className={`flex size-12 items-center justify-center rounded-xl ${bg}`}>
        <span className={color}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-card-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function BarRow({ label, count, max, total }: { label: string; count: number; max: number; total?: number }) {
  const pct = Math.round((count / max) * 100);
  const totalPct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-48 truncate text-sm font-medium text-foreground">{label}</span>
      <div className="flex-1 h-5 rounded-lg bg-muted overflow-hidden">
        <div className="h-full rounded-lg bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-36 text-right text-sm font-semibold text-card-foreground">
        {total !== undefined
          ? `${count} proyectos (${totalPct}% del total)`
          : `${count} (${pct}%)`}
      </span>
    </div>
  );
}
