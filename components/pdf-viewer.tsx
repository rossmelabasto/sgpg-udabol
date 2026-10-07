"use client";

// Visor de PDF único para todos los navegadores (Chrome, Firefox, Safari, móvil),
// basado en el componente oficial PDFViewer de pdf.js:
// - renderiza solo las páginas visibles (memoria acotada en tesis largas);
// - descarga el documento por rangos desde /api/pdf/<id> (no hace falta bajar todo);
// - capa de texto: se puede seleccionar, copiar y buscar dentro del PDF.
import "pdfjs-dist/web/pdf_viewer.css";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";

// Los padres le ponen key={url}: cada documento monta un visor nuevo.
type Props = { url: string; title?: string; onClose?: () => void };

type Viewer = {
  currentPageNumber: number;
  currentScale: number;
  currentScaleValue: string;
  pagesCount: number;
  setDocument(doc: unknown): void;
  cleanup?: () => void;
};

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export function PdfViewer({ url, title = "PDF", onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const eventBusRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<{ current: number; total: number } | null>(null);

  const downloadUrl = url + (url.includes("?") ? "&" : "?") + "download=1";

  useEffect(() => {
    let cancelled = false;
    let doc: any = null;

    (async () => {
      try {
        const pdfjs: any = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // pdf_viewer.mjs toma pdf.js de globalThis.pdfjsLib.
        (globalThis as any).pdfjsLib = pdfjs;
        const { EventBus, PDFLinkService, PDFFindController, PDFViewer } = await import("pdfjs-dist/web/pdf_viewer.mjs");
        if (cancelled || !containerRef.current) return;

        const eventBus = new EventBus();
        const linkService = new PDFLinkService({ eventBus });
        const findController = new PDFFindController({ eventBus, linkService });
        const viewer = new PDFViewer({
          container: containerRef.current,
          eventBus,
          linkService,
          findController,
          removePageBorders: false,
        });
        linkService.setViewer(viewer);
        viewerRef.current = viewer;
        eventBusRef.current = eventBus;

        eventBus.on("pagesinit", () => {
          viewer.currentScaleValue = window.innerWidth < 640 ? "page-width" : "auto";
        });
        eventBus.on("pagechanging", (e: { pageNumber: number }) => {
          setPage(e.pageNumber);
          setPageInput(String(e.pageNumber));
        });
        eventBus.on("scalechanging", (e: { scale: number }) => setScale(e.scale));
        eventBus.on("updatefindmatchescount", (e: { matchesCount: { current: number; total: number } }) =>
          setMatches(e.matchesCount),
        );
        eventBus.on("updatefindcontrolstate", (e: { matchesCount?: { current: number; total: number } }) => {
          if (e.matchesCount) setMatches(e.matchesCount);
        });

        const task = pdfjs.getDocument({
          url,
          rangeChunkSize: 128 * 1024,
          disableAutoFetch: true,
          withCredentials: true,
        });
        task.onProgress = (p: { loaded: number; total: number }) => {
          if (p.total) setProgress(Math.min(99, Math.round((p.loaded / p.total) * 100)));
        };
        doc = await task.promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        viewer.setDocument(doc);
        linkService.setDocument(doc, null);
        setPages(doc.numPages);
        setStatus("ready");
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e?.message || "");
        setError(
          /401|403/.test(msg)
            ? "Tu sesión expiró. Vuelve a ingresar para ver el PDF."
            : /404/.test(msg)
              ? "El PDF de este proyecto no se encontró."
              : /Invalid PDF|InvalidPDF/i.test(msg)
                ? "El archivo está dañado o no es un PDF válido."
                : "No se pudo cargar el PDF.",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      try {
        viewerRef.current?.cleanup?.();
      } catch {}
      viewerRef.current = null;
      eventBusRef.current = null;
      if (doc) doc.destroy();
    };
  }, [url]);

  const goTo = useCallback(
    (n: number) => {
      const v = viewerRef.current;
      if (!v || !pages) return;
      v.currentPageNumber = Math.min(Math.max(1, n), pages);
    },
    [pages],
  );

  function zoom(dir: 1 | -1) {
    const v = viewerRef.current;
    if (!v) return;
    const cur = v.currentScale;
    const next =
      dir > 0
        ? ZOOM_STEPS.find((s) => s > cur + 0.01) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
        : [...ZOOM_STEPS].reverse().find((s) => s < cur - 0.01) ?? ZOOM_STEPS[0];
    v.currentScaleValue = String(next);
  }

  function fitWidth() {
    if (viewerRef.current) viewerRef.current.currentScaleValue = "page-width";
  }

  function find(again = false, previous = false) {
    const bus = eventBusRef.current;
    if (!bus) return;
    bus.dispatch("find", {
      source: null,
      type: again ? "again" : "",
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: previous,
      matchDiacritics: false,
    });
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) find(matches !== null, false);
  }

  // Ctrl/Cmd+F abre la búsqueda dentro del PDF.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => document.getElementById("pdf-search")?.focus(), 0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const btn =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex h-full w-full flex-col bg-muted">
      {/* Barra superior */}
      <div className="flex items-center gap-1 border-b border-border bg-card px-2 py-1.5 sm:gap-2 sm:px-3">
        <span className="hidden min-w-0 flex-1 truncate text-sm font-medium text-foreground md:block" title={title}>
          {title}
        </span>

        <div className="flex items-center gap-0.5">
          <button type="button" className={btn} onClick={() => goTo(page - 1)} disabled={status !== "ready" || page <= 1} aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goTo(Number(pageInput) || 1);
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <input
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
              onBlur={() => goTo(Number(pageInput) || page)}
              inputMode="numeric"
              aria-label="Número de página"
              className="h-7 w-10 rounded-md border border-input bg-background text-center text-xs text-foreground"
            />
            <span className="whitespace-nowrap">/ {pages || "–"}</span>
          </form>
          <button type="button" className={btn} onClick={() => goTo(page + 1)} disabled={status !== "ready" || page >= pages} aria-label="Página siguiente">
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <div className="flex items-center gap-0.5">
          <button type="button" className={btn} onClick={() => zoom(-1)} disabled={status !== "ready"} aria-label="Alejar">
            <Minus className="size-4" />
          </button>
          <span className="hidden w-11 text-center text-xs tabular-nums text-muted-foreground sm:inline">{Math.round(scale * 100)}%</span>
          <button type="button" className={btn} onClick={() => zoom(1)} disabled={status !== "ready"} aria-label="Acercar">
            <Plus className="size-4" />
          </button>
          <button type="button" className={`${btn} hidden sm:inline-flex`} onClick={fitWidth} disabled={status !== "ready"} aria-label="Ajustar al ancho" title="Ajustar al ancho">
            <Maximize2 className="size-4" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className={`${btn} ${searchOpen ? "bg-accent text-foreground" : ""}`}
            onClick={() => {
              setSearchOpen((o) => !o);
              setTimeout(() => document.getElementById("pdf-search")?.focus(), 0);
            }}
            disabled={status !== "ready"}
            aria-label="Buscar en el PDF"
            title="Buscar (Ctrl+F)"
          >
            <Search className="size-4" />
          </button>
          <a href={url} target="_blank" rel="noreferrer" className={`${btn} hidden sm:inline-flex`} aria-label="Abrir en una pestaña nueva" title="Abrir en una pestaña nueva">
            <ExternalLink className="size-4" />
          </a>
          <a href={downloadUrl} className={btn} aria-label="Descargar PDF" title="Descargar">
            <Download className="size-4" />
          </a>
          {onClose && (
            <button type="button" onClick={onClose} className={btn} aria-label="Cerrar visor" title="Cerrar">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={onSearch} className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            id="pdf-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMatches(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                find(true, true);
              } else if (e.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Buscar en el documento…"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          />
          <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {matches ? (matches.total ? `${matches.current} de ${matches.total}` : "Sin resultados") : ""}
          </span>
          <button type="button" className={btn} onClick={() => find(true, true)} disabled={!query.trim()} aria-label="Coincidencia anterior">
            <ChevronUp className="size-4" />
          </button>
          <button type="submit" className={btn} disabled={!query.trim()} aria-label="Coincidencia siguiente">
            <ChevronDown className="size-4" />
          </button>
        </form>
      )}

      {/* Área del documento: PDFViewer exige un contenedor con position:absolute */}
      <div className="relative flex-1">
        <div ref={containerRef} className="pdf-viewer-container absolute inset-0 overflow-auto">
          <div className="pdfViewer" />
        </div>

        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span>Cargando PDF{progress ? ` · ${progress}%` : "…"}</span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            <a href={downloadUrl} className="text-sm font-medium text-primary hover:underline">
              Intentar descargarlo
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
