"use client";

import { useEffect, useMemo, useState } from "react";
import { getProjectHistory } from "@/app/actions/projects";
import type { ProjectHistoryLog, PdfVersion } from "@/lib/projects";
import {
  Activity,
  PlusCircle,
  Pencil,
  Trash2,
  FileUp,
  RefreshCw,
  Loader2,
} from "lucide-react";

type Props = {
  projectId: string;
  pdfVersions?: PdfVersion[];
  onViewVersion?: (versionId: string) => void;
  downloadUrlFor?: (versionId: string) => string;
};

// Formato de fecha/hora consistente (12h con a. m./p. m.)
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("es-BO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const actionStyles = {
  CREATE: {
    icon: PlusCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  UPDATE: { icon: Pencil, color: "text-blue-500", bg: "bg-blue-500/10" },
  RESTORE: {
    icon: RefreshCw,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  DELETE: {
    icon: Trash2,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  PDF_UPLOAD: {
    icon: FileUp,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
};

type TimelineItem =
  | { type: "log"; time: string; data: ProjectHistoryLog }
  | { type: "pdf"; time: string; data: PdfVersion };

export function ProjectHistoryList({ projectId, pdfVersions = [], onViewVersion, downloadUrlFor }: Props) {
  const [logs, setLogs] = useState<ProjectHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      const data = await getProjectHistory(projectId);
      setLogs(data);
      setLoading(false);
    }

    if (projectId) fetchHistory();
  }, [projectId]);

  // Fusiona los registros de cambios con las versiones de PDF en un solo
  // timeline ordenado por fecha, para que cada PDF aparezca en su momento.
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...logs.map((l) => ({ type: "log" as const, time: l.timestamp, data: l })),
      ...pdfVersions.map((v) => ({ type: "pdf" as const, time: v.uploadedAt, data: v })),
    ];
    return items.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );
  }, [logs, pdfVersions]);

  if (loading) {
    return (
      <div className="flex justify-center p-8 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No hay registros en el historial para este proyecto.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="flex items-center text-lg font-semibold text-foreground">
        <Activity className="mr-2 size-5" />
        Historial de Cambios
      </h3>

      <div className="relative space-y-4 before:absolute before:inset-y-0 before:left-4.75 before:w-px before:bg-border">
        {timeline.map((item) => {
          if (item.type === "pdf") {
            const v = item.data;
            return (
              <div key={`pdf-${v.id}`} className="relative flex items-start gap-4">
                <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-background bg-purple-500/10 text-purple-500">
                  <FileUp className="size-4" />
                </div>
                <div className="flex flex-col gap-1 pt-1.5">
                  <p className="text-sm font-medium text-foreground">
                    PDF versión {v.version}{v.id === "actual" ? " (vigente)" : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatTime(v.uploadedAt)}</span>
                    <span>•</span>
                    {onViewVersion && (
                      <button
                        type="button"
                        onClick={() => onViewVersion(v.id)}
                        className="font-medium text-primary hover:underline"
                      >
                        Ver
                      </button>
                    )}
                    <a
                      href={downloadUrlFor ? downloadUrlFor(v.id) : "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      Descargar
                    </a>
                  </div>
                </div>
              </div>
            );
          }

          const log = item.data;
          const Style = actionStyles[log.action as keyof typeof actionStyles] || {
            icon: Activity,
            color: "text-muted-foreground",
            bg: "bg-muted",
          };
          const Icon = Style.icon;

          return (
            <div key={log.id} className="relative flex items-start gap-4">
              <div
                className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-background ${Style.bg} ${Style.color}`}
              >
                <Icon className="size-4" />
              </div>

              <div className="flex flex-col gap-1 pt-1.5">
                <p className="text-sm font-medium text-foreground">{log.details}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatTime(log.timestamp)}</span>
                  <span>•</span>
                  <span>Por: {log.actorName || log.actorEmail || log.userRole}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
