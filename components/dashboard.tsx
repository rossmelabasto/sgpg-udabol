"use client";

import { useEffect, useState } from "react";
import { BookOpen, FileText, FileX2, Hash, Loader2, Medal, NotebookText } from "lucide-react";
import { getProjects, getTopContributors, type TopContributor } from "@/app/actions/projects";
import type { ThesisProject } from "@/lib/projects";
import { careerShort } from "@/components/career-badge";

const CAREER_COLORS: Record<string, string> = {
  "Ingeniería en Sistemas": "bg-chart-1",
  "Ingeniería en Telecomunicaciones": "bg-chart-3",
  "Ingeniería Petrolera": "bg-chart-2",
  "Ingeniería Civil": "bg-chart-5",
};

export function Dashboard() {
  const [projects, setProjects] = useState<ThesisProject[] | null>(null);
  const [contributors, setContributors] = useState<TopContributor[]>([]);

  useEffect(() => {
    Promise.all([getProjects(), getTopContributors(5)]).then(([rows, top]) => {
      setProjects(rows);
      setContributors(top);
    });
  }, []);

  if (!projects) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-7 animate-spin" />
      </div>
    );
  }

  const total = projects.length;
  const withPdf = projects.filter((p) => p.hasPdf).length;
  const withAbstract = projects.filter((p) => p.abstract?.trim()).length;
  const count = <K extends string>(keys: K[]) => keys.reduce<Record<string, number>>((acc, k) => ((acc[k] = (acc[k] || 0) + 1), acc), {});
  const byCareer = Object.entries(count(projects.map((p) => p.career))).sort((a, b) => b[1] - a[1]);
  const byYear = Object.entries(count(projects.map((p) => String(p.year)))).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxYear = Math.max(1, ...byYear.map(([, n]) => n));
  const tagCounts = count(projects.flatMap((p) => (p.tags ?? []).map((t) => t.toLowerCase())));
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<BookOpen className="size-5" />} label="Proyectos" value={total} />
        <Stat icon={<FileText className="size-5" />} label="Con PDF" value={withPdf} note={`${pct(withPdf)}%`} />
        <Stat icon={<NotebookText className="size-5" />} label="Con resumen" value={withAbstract} note={`${pct(withAbstract)}%`} />
        <Stat icon={<Hash className="size-5" />} label="Palabras clave distintas" value={Object.keys(tagCounts).length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Por carrera">
          <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {byCareer.map(([c, n]) => (
              <div key={c} className={CAREER_COLORS[c] ?? "bg-muted-foreground"} style={{ width: `${(n / total) * 100}%` }} title={`${c}: ${n}`} />
            ))}
          </div>
          <ul className="flex flex-col gap-2.5">
            {byCareer.map(([c, n]) => (
              <li key={c} className="flex items-center gap-3 text-sm">
                <span className={`size-3 shrink-0 rounded-sm ${CAREER_COLORS[c] ?? "bg-muted-foreground"}`} />
                <span className="flex-1 text-foreground">{careerShort(c)}</span>
                <span className="font-semibold tabular-nums text-foreground">{n}</span>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{pct(n)}%</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Por año">
          <div className="flex h-44 items-end gap-2" role="img" aria-label={`Proyectos por año: ${byYear.map(([y, n]) => `${y}: ${n}`).join(", ")}`}>
            {byYear.map(([y, n]) => (
              <div key={y} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-xs font-semibold tabular-nums text-foreground">{n}</span>
                <div className="w-full max-w-12 rounded-t-md bg-primary/85 dark:bg-gold/80" style={{ height: `${Math.max(4, (n / maxYear) * 120)}px` }} />
                <span className="text-[11px] tabular-nums text-muted-foreground">{y}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="Temas más frecuentes">
          {topTags.length ? (
            <div className="flex flex-wrap gap-2">
              {topTags.map(([tag, n]) => (
                <a
                  key={tag}
                  href={`/?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-sm text-secondary-foreground hover:border-gold/60"
                >
                  {tag} <span className="text-xs text-muted-foreground">×{n}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay palabras clave.</p>
          )}
        </Card>

        <Card title="Quién registró más cambios">
          {contributors.length ? (
            <ol className="flex flex-col gap-2.5">
              {contributors.map((c, i) => (
                <li key={c.name} className="flex items-center gap-3 text-sm">
                  <Medal className={`size-4 shrink-0 ${["text-gold", "text-muted-foreground", "text-chart-5"][i] ?? "text-muted-foreground/50"}`} />
                  <span className="min-w-0 flex-1 truncate text-foreground">{c.name}</span>
                  <span className="font-semibold tabular-nums">{c.count}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Los cambios nuevos se registran con el nombre de quien los hizo.</p>
          )}
        </Card>
      </div>

      {total - withPdf > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-gold/50 bg-gold/5 p-4">
          <FileX2 className="mt-0.5 size-5 shrink-0 text-gold-dark dark:text-gold" />
          <div>
            <p className="font-medium text-foreground">
              {total - withPdf} proyecto{total - withPdf !== 1 && "s"} sin documento digital
            </p>
            <p className="text-sm text-muted-foreground">En «Administrar» puedes filtrarlos con «sin PDF» y subirles el archivo con «Editar».</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        {icon}
        {note && <span className="text-xs font-medium">{note}</span>}
      </div>
      <p className="mt-3 font-heading text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}
