"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Search, SearchX, SlidersHorizontal, Tag, X } from "lucide-react";
import { searchProjects } from "@/app/actions/projects";
import { CARRERAS, type SearchResult } from "@/lib/projects";
import { ProjectCard } from "@/components/project-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationControls } from "@/components/pagination-controls";
import { significantTokens } from "@/lib/search";

type SortKey = "relevancia" | "year" | "createdAt" | "title" | "studentName";

const SORT_LABELS: Record<SortKey, string> = {
  relevancia: "Más relevantes",
  year: "Año (más reciente)",
  createdAt: "Agregados recientemente",
  title: "Título (A-Z)",
  studentName: "Alumno (A-Z)",
};

function readUrl() {
  if (typeof window === "undefined") return { q: "", carrera: "", desde: "", hasta: "", tag: "" };
  const p = new URLSearchParams(window.location.search);
  return { q: p.get("q") ?? "", carrera: p.get("carrera") ?? "", desde: p.get("desde") ?? "", hasta: p.get("hasta") ?? "", tag: p.get("tag") ?? "" };
}

export function ProjectSearch({ initial }: { initial: SearchResult[] }) {
  const [initialUrl] = useState(readUrl);
  const [query, setQuery] = useState(initialUrl.q);
  const [career, setCareer] = useState(initialUrl.carrera);
  const [yearFrom, setYearFrom] = useState(initialUrl.desde);
  const [yearTo, setYearTo] = useState(initialUrl.hasta);
  const [tag, setTag] = useState(initialUrl.tag);
  const [results, setResults] = useState<SearchResult[]>(initial);
  const [isPending, startTransition] = useTransition();
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  // null = orden automático: relevancia si hay consulta, año si no.
  const [chosenSort, setSortKey] = useState<SortKey | null>(null);
  const [showFilters, setShowFilters] = useState(!!(initialUrl.carrera || initialUrl.desde || initialUrl.hasta));
  const topRef = useRef<HTMLDivElement>(null);
  const hasQuery = significantTokens(query).length > 0;

  const from = parseInt(yearFrom, 10);
  const to = parseInt(yearTo, 10);
  const yearError = Number.isFinite(from) && Number.isFinite(to) && from > to ? 'El año "desde" es mayor que el año "hasta".' : null;

  // Buscar en el servidor (con pausa de 250 ms mientras se escribe) y reflejar los filtros en la URL.
  useEffect(() => {
    if (yearError) return;
    const handle = setTimeout(() => {
      const filters = {
        career: career || undefined,
        yearFrom: Number.isFinite(from) ? from : undefined,
        yearTo: Number.isFinite(to) ? to : undefined,
        tag: tag || undefined,
      };
      startTransition(async () => {
        setResults(await searchProjects(query, filters));
        setCurrentPage(1);
      });
      const p = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries({ q: query.trim(), carrera: career, desde: yearFrom, hasta: yearTo, tag })) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      const qs = p.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, career, yearFrom, yearTo, tag]);

  const sortKey: SortKey =
    chosenSort === "relevancia" && !hasQuery ? "year" : chosenSort ?? (hasQuery ? "relevancia" : "year");

  const sorted = useMemo(() => {
    if (sortKey === "relevancia") return results; // ya vienen ordenados por puntaje
    return [...results].sort((a, b) => {
      if (sortKey === "year") return b.year - a.year || b.createdAt.localeCompare(a.createdAt);
      if (sortKey === "createdAt") return b.createdAt.localeCompare(a.createdAt);
      return String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), "es");
    });
  }, [results, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const filtersActive = !!(career || yearFrom || yearTo || tag);

  function clearAll() {
    setQuery("");
    setCareer("");
    setYearFrom("");
    setYearTo("");
    setTag("");
  }

  function changePage(p: number) {
    setCurrentPage(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-5" ref={topRef}>
      {/* Buscador */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
        <form onSubmit={(e) => e.preventDefault()} className="flex gap-2" role="search">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por tema, título, palabra clave o alumno…"
              aria-label="Buscar proyectos de grado"
              className="h-12 rounded-xl pl-12 pr-10 text-base"
              autoFocus
            />
            {isPending && <Loader2 className="absolute right-3.5 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            className={`h-12 rounded-xl px-3 sm:px-4 ${filtersActive ? "border-gold text-foreground" : ""}`}
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filtros</span>
            {filtersActive && <span className="size-2 rounded-full bg-gold" />}
          </Button>
        </form>

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto] sm:items-end">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-career" className="text-xs font-semibold text-muted-foreground">
                Carrera
              </label>
              <Select value={career || "all"} onValueChange={(v) => setCareer(!v || v === "all" ? "" : v)}>
                <SelectTrigger id="filter-career" className="!h-10 w-full">
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
            </div>
            <div className="grid grid-cols-2 gap-3 sm:contents">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filter-year-from" className="text-xs font-semibold text-muted-foreground">
                  Año desde
                </label>
                <Input id="filter-year-from" inputMode="numeric" value={yearFrom} onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2020" className="h-10" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filter-year-to" className="text-xs font-semibold text-muted-foreground">
                  Año hasta
                </label>
                <Input id="filter-year-to" inputMode="numeric" value={yearTo} onChange={(e) => setYearTo(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2026" className="h-10" />
              </div>
            </div>
            <Button type="button" variant="ghost" onClick={clearAll} disabled={!filtersActive && !query} className="h-10">
              <X className="size-4" /> Limpiar
            </Button>
            {yearError && <p className="text-xs font-medium text-destructive sm:col-span-4">{yearError}</p>}
          </div>
        )}
      </div>

      {/* Resumen y orden */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span>
            <strong className="font-semibold text-foreground">{sorted.length}</strong>{" "}
            {hasQuery || filtersActive ? (sorted.length === 1 ? "resultado" : "resultados") : sorted.length === 1 ? "proyecto" : "proyectos"}
          </span>
          {tag && (
            <button
              type="button"
              onClick={() => setTag("")}
              className="inline-flex items-center gap-1 rounded-full border border-gold bg-gold/15 px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              <Tag className="size-3" /> {tag} <X className="size-3" />
            </button>
          )}
        </div>
        <Select value={sortKey} onValueChange={(v) => v && setSortKey(v as SortKey)}>
          <SelectTrigger className="!h-9 w-auto min-w-48 text-sm" aria-label="Ordenar resultados">
            <SelectValue>{(v: string) => SORT_LABELS[v as SortKey] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortKey[])
              .filter((k) => k !== "relevancia" || hasQuery)
              .map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resultados */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <SearchX className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="font-heading text-lg font-semibold text-foreground">No se encontraron proyectos</p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Prueba con otras palabras, revisa la ortografía o quita algún filtro.
          </p>
          {(hasQuery || filtersActive) && (
            <Button variant="outline" size="sm" onClick={clearAll}>
              Limpiar búsqueda
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${isPending ? "opacity-70 transition-opacity" : ""}`}>
            {pageItems.map((p) => (
              <ProjectCard key={p.id} project={p} activeTag={tag} onTagClick={(t) => setTag((cur) => (cur.toLowerCase() === t.toLowerCase() ? "" : t))} />
            ))}
          </div>
          <PaginationControls
            pageSize={pageSize}
            currentPage={safePage}
            totalItems={sorted.length}
            pageSizeOptions={[12, 24, 48]}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setCurrentPage(1);
            }}
            onPageChange={changePage}
          />
        </>
      )}
    </div>
  );
}
