"use client";

import { useEffect, useState } from "react";
import { Activity, Download, Eye, FileUp, Loader2, Pencil, PlusCircle, RefreshCw, Trash2 } from "lucide-react";
import { getPdfHistory, getProjectHistory } from "@/app/actions/projects";
import { pdfUrlFor, type PdfVersion, type ProjectHistoryLog } from "@/lib/projects";

export function formatDateTime(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-BO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ACTIONS: Record<string, { icon: typeof Activity; className: string; label: string }> = {
  CREATE: { icon: PlusCircle, className: "bg-success/10 text-success", label: "Creación" },
  UPDATE: { icon: Pencil, className: "bg-chart-3/10 text-chart-3", label: "Edición" },
  PDF_UPLOAD: { icon: FileUp, className: "bg-gold/15 text-gold-dark dark:text-gold", label: "PDF" },
  DELETE: { icon: Trash2, className: "bg-destructive/10 text-destructive", label: "Papelera" },
  RESTORE: { icon: RefreshCw, className: "bg-chart-4/15 text-chart-4", label: "Restaurado" },
};

/** Versiones del PDF + línea de tiempo de cambios de un proyecto (solo admins). */
export function ProjectHistoryList({ projectId, onViewVersion }: { projectId: string; onViewVersion?: (url: string, label: string) => void }) {
  const [logs, setLogs] = useState<ProjectHistoryLog[] | null>(null);
  const [versions, setVersions] = useState<PdfVersion[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([getProjectHistory(projectId), getPdfHistory(projectId)]).then(([l, v]) => {
      if (!alive) return;
      setLogs(l);
      setVersions(v);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  if (!logs) {
    return (
      <div className="flex justify-center p-8 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Versiones del PDF</h3>
        {versions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Este proyecto no tiene PDF.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {versions.map((v) => {
              const vid = v.id === "actual" ? undefined : v.id;
              const label = `Versión ${v.version}${v.id === "actual" ? " (vigente)" : ""}`;
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      v.id === "actual" ? "bg-gold text-teal-dark" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    v{v.version}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Subida {formatDateTime(v.uploadedAt)}
                      {v.replacedAt && ` · reemplazada ${formatDateTime(v.replacedAt)}`}
                      {v.fileName && ` · ${v.fileName}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {onViewVersion && (
                      <button
                        type="button"
                        onClick={() => onViewVersion(pdfUrlFor(projectId, vid), label)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-secondary dark:text-gold"
                      >
                        <Eye className="size-3.5" /> Ver
                      </button>
                    )}
                    <a
                      href={pdfUrlFor(projectId, vid, { download: true })}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="size-3.5" /> Descargar
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Historial de cambios</h3>
        {logs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Sin registros.</p>
        ) : (
          <ol className="relative flex flex-col gap-4 before:absolute before:inset-y-2 before:left-[17px] before:w-px before:bg-border">
            {logs.map((log) => {
              const a = ACTIONS[log.action] ?? { icon: Activity, className: "bg-muted text-muted-foreground", label: log.action };
              const Icon = a.icon;
              return (
                <li key={log.id} className="relative flex gap-3">
                  <span className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${a.className}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-sm text-foreground">{log.details}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(log.timestamp)} · {log.actorName || log.actorEmail || (log.userRole === "anonymous" ? "invitado" : "administrador")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
