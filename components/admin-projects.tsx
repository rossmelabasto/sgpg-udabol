"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileText, History, Loader2, PencilLine, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationControls } from "@/components/pagination-controls";
import { ProjectHistoryList, formatDateTime } from "@/components/project-history";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CareerBadge } from "@/components/career-badge";
import { getDeletedProjects, permanentlyDeleteProject, restoreProject } from "@/app/actions/projects";
import { CARRERAS, type SearchResult, type ThesisProject, type UserRole } from "@/lib/projects";
import { normalize } from "@/lib/search";

type SortKey = "createdAt" | "year" | "title" | "studentName";
const SORTS: Record<SortKey, string> = {
  createdAt: "Agregados recientemente",
  year: "Año (más reciente)",
  title: "Título (A-Z)",
  studentName: "Alumno (A-Z)",
};

type Props = {
  projects: SearchResult[];
  role: UserRole;
  onDelete: (id: string) => Promise<void>;
  onEdit: (project: SearchResult) => void;
  onChanged: () => Promise<void>;
};

export function AdminProjects({ projects, role, onDelete, onEdit, onChanged }: Props) {
  const [view, setView] = useState<"activos" | "papelera">("activos");
  const [trash, setTrash] = useState<ThesisProject[] | null>(null);
  const [search, setSearch] = useState("");
  const [career, setCareer] = useState("");
  const [onlyMissing, setOnlyMissing] = useState<"" | "pdf" | "resumen">("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [pageSize, setPageSize] = useState(10);
  const [historyOf, setHistoryOf] = useState<ThesisProject | null>(null);
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "purge"; project: ThesisProject } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadTrash() {
    setTrash(await getDeletedProjects());
  }

  function changeView(v: "activos" | "papelera") {
    setView(v);
    if (v === "papelera") {
      setTrash(null);
      loadTrash();
    }
  }

  const source = useMemo<ThesisProject[]>(() => (view === "activos" ? projects : trash ?? []), [view, projects, trash]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    let list = source;
    if (q) list = list.filter((p) => normalize(`${p.title} ${p.studentName} ${(p.tags ?? []).join(" ")}`).includes(q));
    if (career) list = list.filter((p) => p.career === career);
    if (onlyMissing === "pdf") list = list.filter((p) => !p.hasPdf);
    if (onlyMissing === "resumen") list = list.filter((p) => !p.abstract?.trim());
    return [...list].sort((a, b) => {
      if (sortKey === "createdAt") return (view === "papelera" ? (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "") : b.createdAt.localeCompare(a.createdAt));
      if (sortKey === "year") return b.year - a.year;
      return String(a[sortKey]).localeCompare(String(b[sortKey]), "es");
    });
  }, [source, search, career, onlyMissing, sortKey, view]);

  // La página vuelve a 1 cuando cambian los filtros (sin efecto: se compara la "firma").
  const filterKey = [search, career, onlyMissing, sortKey, view].join("|");
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function exportCSV() {
    const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Título", "Alumno", "Carrera", "Año", "Palabras clave", "Resumen", "Tiene PDF", "Registrado", "Enlace"];
    const rows = filtered.map((p) => [
      esc(p.title),
      esc(p.studentName),
      esc(p.career),
      p.year,
      esc((p.tags ?? []).join(", ")),
      esc(p.abstract || ""),
      p.hasPdf ? "Sí" : "No",
      esc(p.createdAt.slice(0, 10)),
      esc(`${window.location.origin}/proyecto/${p.id}`),
    ]);
    const csv = [headers.map(esc).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `proyectos-udabol-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doRestore(p: ThesisProject) {
    setBusyId(p.id);
    const r = await restoreProject(p.id);
    setBusyId(null);
    setMessage(r.ok ? `«${p.title.slice(0, 60)}» se restauró.` : r.error);
    await Promise.all([loadTrash(), onChanged()]);
  }

  const missingPdf = projects.filter((p) => !p.hasPdf).length;
  const missingAbstract = projects.filter((p) => !p.abstract?.trim()).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Activos / Papelera */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1 text-sm">
          {(["activos", "papelera"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => changeView(v)}
              className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {v === "activos" ? `Activos (${projects.length})` : `Papelera${trash ? ` (${trash.length})` : ""}`}
            </button>
          ))}
        </div>
        {view === "activos" && (
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-9">
            <Download className="size-4" /> Exportar CSV
          </Button>
        )}
      </div>

      {message && (
        <p role="status" className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          {message}
          <button type="button" onClick={() => setMessage(null)} aria-label="Cerrar aviso">
            <X className="size-4" />
          </button>
        </p>
      )}

      {/* Filtros */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_14rem_12rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Filtrar por título, alumno o palabra clave…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={career || "all"} onValueChange={(v) => setCareer(!v || v === "all" ? "" : v)}>
          <SelectTrigger className="!h-10 w-full" aria-label="Carrera">
            <SelectValue>{(v: string) => (v === "all" ? "Todas las carreras" : v)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las carreras</SelectItem>
            {CARRERAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortKey} onValueChange={(v) => v && setSortKey(v as SortKey)}>
          <SelectTrigger className="!h-10 w-full" aria-label="Ordenar">
            <SelectValue>{(v: string) => (view === "papelera" && v === "createdAt" ? "Enviados recientemente" : SORTS[v as SortKey])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {view === "papelera" && k === "createdAt" ? "Enviados recientemente" : SORTS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "activos" && (missingPdf > 0 || missingAbstract > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="py-1 text-muted-foreground">Pendientes:</span>
          {missingPdf > 0 && (
            <button
              type="button"
              onClick={() => setOnlyMissing((m) => (m === "pdf" ? "" : "pdf"))}
              className={`rounded-full border px-2.5 py-1 font-medium ${onlyMissing === "pdf" ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:border-gold/60"}`}
            >
              {missingPdf} sin PDF
            </button>
          )}
          {missingAbstract > 0 && (
            <button
              type="button"
              onClick={() => setOnlyMissing((m) => (m === "resumen" ? "" : "resumen"))}
              className={`rounded-full border px-2.5 py-1 font-medium ${onlyMissing === "resumen" ? "border-gold bg-gold/15 text-foreground" : "border-border text-muted-foreground hover:border-gold/60"}`}
            >
              {missingAbstract} sin resumen
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      {view === "papelera" && trash === null ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {view === "papelera" ? "La papelera está vacía." : search || career || onlyMissing ? "Sin resultados con esos filtros." : "No hay proyectos aún."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {pageItems.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <CareerBadge career={p.career} short />
                    <span className="text-xs text-muted-foreground">{p.year}</span>
                    {p.hasPdf ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                        <FileText className="size-3" /> PDF
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">sin PDF</span>
                    )}
                  </div>
                  <p className="line-clamp-2 font-medium leading-snug text-foreground">{p.title}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {p.studentName}
                    {view === "papelera" && p.deletedAt && ` · en la papelera desde ${formatDateTime(p.deletedAt)}`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {view === "activos" ? (
                    <>
                      <Link href={`/proyecto/${p.id}`} target="_blank" className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground" title="Abrir en una pestaña nueva">
                        <ExternalLink className="size-3.5" /> Ver
                      </Link>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => setHistoryOf(p)}>
                        <History className="size-3.5" /> Historial
                      </Button>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => onEdit(p)}>
                        <PencilLine className="size-3.5" /> Editar
                      </Button>
                      <Button variant="destructive" size="sm" className="h-8" disabled={busyId === p.id} onClick={() => setConfirm({ kind: "delete", project: p })}>
                        <Trash2 className="size-3.5" /> Papelera
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" className="h-8" disabled={busyId === p.id} onClick={() => doRestore(p)}>
                        {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Restaurar
                      </Button>
                      {role === "superadmin" && (
                        <Button variant="destructive" size="sm" className="h-8" onClick={() => setConfirm({ kind: "purge", project: p })}>
                          <Trash2 className="size-3.5" /> Eliminar definitivamente
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <PaginationControls pageSize={pageSize} currentPage={safePage} totalItems={filtered.length} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} onPageChange={setPage} />
        </>
      )}

      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Historial del proyecto</DialogTitle>
            <p className="line-clamp-2 text-sm text-muted-foreground">{historyOf?.title}</p>
          </DialogHeader>
          {historyOf && <ProjectHistoryList key={historyOf.id} projectId={historyOf.id} onViewVersion={(url, label) => setViewer({ url, title: `${historyOf.title} — ${label}` })} />}
        </DialogContent>
      </Dialog>

      <PdfViewerDialog url={viewer?.url ?? null} open={!!viewer} onOpenChange={(o) => !o && setViewer(null)} title={viewer?.title} />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === "purge" ? "¿Eliminar definitivamente?" : "¿Enviar a la papelera?"}
        description={
          confirm?.kind === "purge" ? (
            <>Se borrarán el proyecto, su historial y todas las versiones de su PDF. <strong>No se puede deshacer.</strong></>
          ) : (
            <>«{confirm?.project.title.slice(0, 90)}» dejará de verse en el repositorio. Podrás restaurarlo desde la papelera.</>
          )
        }
        confirmLabel={confirm?.kind === "purge" ? "Eliminar para siempre" : "Enviar a la papelera"}
        destructive
        onConfirm={async () => {
          if (!confirm) return;
          const p = confirm.project;
          if (confirm.kind === "delete") {
            await onDelete(p.id);
            setMessage(`«${p.title.slice(0, 60)}» se envió a la papelera.`);
          } else {
            const r = await permanentlyDeleteProject(p.id);
            setMessage(r.ok ? "Proyecto eliminado definitivamente." : r.error);
            await loadTrash();
          }
        }}
      />
    </div>
  );
}
