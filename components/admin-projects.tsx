"use client";

import { useState, useMemo, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, PencilLine, History, Search, ArrowUpDown, Download, FileText, X } from "lucide-react";
import { PaginationControls } from "@/components/pagination-controls";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARRERAS, pdfUrlFor, type SearchResult, type PdfVersion } from "@/lib/projects";
import { ProjectHistoryList } from "@/components/project-history"
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { getPdfHistory } from "@/app/actions/projects";

type SortKey = "title" | "year" | "career" | "studentName" | "createdAt";
type SortDir = "asc" | "desc";

type Props = {
  projects: SearchResult[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (project: SearchResult) => void;
};

export function AdminProjects({ projects, onDelete, onEdit }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyProject, setHistoryProject] = useState<SearchResult | null>(null);
  const [pdfHistory, setPdfHistory] = useState<PdfVersion[]>([]);
  const [viewVersionUrl, setViewVersionUrl] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [career, setCareer] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch PDF history when a project's history modal is opened
  useEffect(() => {
    if (historyProject) {
      getPdfHistory(historyProject.id).then(setPdfHistory);
    } else {
      setPdfHistory([]);
    }
  }, [historyProject]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const from = parseInt(yearFrom, 10);
    const to = parseInt(yearTo, 10);
    const fromNum = isFinite(from) ? from : null;
    const toNum = isFinite(to) ? to : null;
    let list = projects;
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.studentName.toLowerCase().includes(q) ||
          p.career.toLowerCase().includes(q)
      );
    }
    if (career) {
      list = list.filter((p) => p.career === career);
    }
    if (fromNum !== null) {
      list = list.filter((p) => p.year >= fromNum);
    }
    if (toNum !== null) {
      list = list.filter((p) => p.year <= toNum);
    }
    return [...list].sort((a, b) => {
      const aVal = String(a[sortKey] ?? "");
      const bVal = String(b[sortKey] ?? "");
      const cmp = aVal.localeCompare(bVal, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [projects, search, career, yearFrom, yearTo, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "createdAt" ? "desc" : "asc"); }
  }

  function clearFilters() {
    setCareer("");
    setYearFrom("");
    setYearTo("");
    setCurrentPage(1);
  }

  const hasFilters = !!career || !!yearFrom || !!yearTo;

  function exportCSV() {
    const headers = ["Título", "Alumno", "Carrera", "Año", "Resumen", "Tiene PDF"];
    const rows = filtered.map((p) => [
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.studentName.replace(/"/g, '""')}"`,
      `"${p.career}"`,
      p.year,
      `"${(p.abstract || "").replace(/"/g, '""')}"`,
      p.hasPdf ? "Sí" : "No",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proyectos-udabol-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`¿Eliminar "${title}"?`)) return;
    setBusyId(id);
    try { await onDelete(id); } finally { setBusyId(null); }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por título, alumno o carrera..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="h-10 pl-9 text-sm"
          />
        </div>
        <div className="flex gap-1 text-xs">
          {(["title", "year", "career", "studentName", "createdAt"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleSort(key)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                sortKey === key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {key === "title" ? "Título" : key === "year" ? "Año" : key === "career" ? "Carrera" : key === "studentName" ? "Alumno" : "Fecha de subida"}
              {sortKey === key && <ArrowUpDown className="size-3" />}
            </button>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-filter-career" className="text-xs font-semibold text-muted-foreground">Carrera</label>
          <Select value={career} onValueChange={(val) => { setCareer(val === "all" || !val ? "" : val); setCurrentPage(1); }}>
            <SelectTrigger id="admin-filter-career" className="!h-10 w-[240px] text-sm items-center">
              <SelectValue placeholder="Todas las carreras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-sm">Todas las carreras</SelectItem>
              {CARRERAS.map((c) => (<SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-filter-year-from" className="text-xs font-semibold text-muted-foreground">Año desde</label>
          <Input
            id="admin-filter-year-from" type="number" min={1980} max={2100}
            value={yearFrom} onChange={(e) => { setYearFrom(e.target.value); setCurrentPage(1); }}
            placeholder="Ej. 2020" className="h-10 w-[120px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-filter-year-to" className="text-xs font-semibold text-muted-foreground">Año hasta</label>
          <Input
            id="admin-filter-year-to" type="number" min={1980} max={2100}
            value={yearTo} onChange={(e) => { setYearTo(e.target.value); setCurrentPage(1); }}
            placeholder="Ej. 2025" className="h-10 w-[120px] text-sm"
          />
        </div>

        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-10 gap-1.5 text-xs cursor-pointer">
            <X className="size-3.5" /> Limpiar filtros
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "proyecto" : "proyectos"}
          </p>
          <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs">
            <Download className="size-3.5 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {search || hasFilters ? "Sin resultados para esa búsqueda." : "No hay proyectos aún."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {paginated.map((project) => (
              <Card key={project.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between min-h-[100px]">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{project.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {project.studentName} · {project.career} · {project.year}
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {project.abstract}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" onClick={() => setHistoryProject(project)}>
                    <History className="mr-1 size-3.5" /> Historial
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onEdit(project)}>
                    <PencilLine className="mr-1 size-3.5" /> Editar
                  </Button>
                  <Button type="button" variant="destructive" size="sm" disabled={busyId === project.id} onClick={() => handleDelete(project.id, project.title)}>
                    <Trash2 className="mr-1 size-3.5" /> Eliminar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <PaginationControls
            pageSize={pageSize}
            currentPage={safePage}
            totalItems={filtered.length}
            onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      <Dialog open={!!historyProject} onOpenChange={(open) => !open && setHistoryProject(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-150">
          <DialogHeader>
            <DialogTitle className="text-xl">Auditoría del Proyecto</DialogTitle>
            <p className="text-sm text-muted-foreground">{historyProject?.title}</p>
          </DialogHeader>
          {historyProject?.hasPdf && (
            <div className="mb-4">
              <a
                href={pdfUrlFor(historyProject.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <FileText className="mr-1 size-3.5" /> Ver PDF
              </a>
            </div>
          )}

          {historyProject && (
            <ProjectHistoryList
              projectId={historyProject.id}
              pdfVersions={pdfHistory}
              onViewVersion={(versionId) => setViewVersionUrl(pdfUrlFor(historyProject.id, versionId))}
              downloadUrlFor={(versionId) => pdfUrlFor(historyProject.id, versionId, { download: true })}
            />
          )}
        </DialogContent>
      </Dialog>

      <PdfViewerDialog
        url={viewVersionUrl}
        open={!!viewVersionUrl}
        onOpenChange={(o) => !o && setViewVersionUrl(null)}
        title="VERSION DE PDF"
      />
    </div>
  );
}
