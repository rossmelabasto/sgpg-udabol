"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, X, Loader2, AlertTriangle } from "lucide-react";

type Props = { url: string; title?: string; onClose?: () => void };

/**
 * Visor de PDF cross-browser y con memoria acotada:
 * - Chrome/Edge/Safari: <iframe> con blob URL (visos nativo, carga páginas a demanda).
 * - Firefox: pdf.js con renderizado perezoso (IntersectionObserver): solo dibuja
 *   las páginas visibles y libera las que salen del viewport, para NO explotar
 *   la RAM en PDFs grandes (el enfoque anterior renderizaba todas de golpe).
 */
export function PdfViewer({ url, title = "PDF", onClose }: Props) {
  const proxyUrl = url;
  const [browser, setBrowser] = useState<"unknown" | "firefox" | "other">("unknown");

  useEffect(() => {
    setBrowser(/firefox/i.test(navigator.userAgent) ? "firefox" : "other");
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-muted">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-3 py-2">
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{title}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={proxyUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <ExternalLink className="size-3.5" />
            Abrir en pestaña
          </a>
          <a
            href={proxyUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
          >
            <Download className="size-3.5" />
            Descargar
          </a>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {browser === "unknown" ? (
        <LoadingView />
      ) : browser === "firefox" ? (
        <PdfjsLazyViewer proxyUrl={proxyUrl} />
      ) : (
        <NativeIframeViewer proxyUrl={proxyUrl} />
      )}
    </div>
  );
}

function NativeIframeViewer({ proxyUrl }: { proxyUrl: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    setBlobUrl(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error("No se pudo cargar el PDF");
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "No se pudo cargar el PDF");
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proxyUrl]);

  if (blobUrl) {
    return (
      <iframe src={blobUrl} title="PDF" className="w-full flex-1" style={{ border: "none" }} />
    );
  }
  if (error) return <ErrorView error={error} proxyUrl={proxyUrl} />;
  return <LoadingView />;
}

function PdfjsLazyViewer({ proxyUrl }: { proxyUrl: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<any>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar el documento
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMsg(null);
    (async () => {
      try {
        // @ts-ignore — el build .mjs de pdfjs-dist no trae tipos
        const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url: proxyUrl }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current = doc;
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) {
          setErrorMsg(e?.message || "No se pudo cargar el PDF");
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (docRef.current) {
        try {
          docRef.current.destroy();
        } catch {}
        docRef.current = null;
      }
    };
  }, [proxyUrl]);

  // Construir placeholders y renderizar perezosamente
  useEffect(() => {
    if (status !== "ready") return;
    const scroll = scrollRef.current;
    const pages = pagesRef.current;
    const doc = docRef.current;
    if (!scroll || !pages || !doc) return;

    const numPages = doc.numPages;
    const width = scroll.clientWidth || 800;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const rendered = new Set<number>();
    const inFlight = new Set<number>();
    const phs: HTMLDivElement[] = [];

    const frag = document.createDocumentFragment();
    for (let i = 1; i <= numPages; i++) {
      const ph = document.createElement("div");
      ph.dataset.page = String(i);
      ph.style.width = "100%";
      ph.style.aspectRatio = "0.7727"; // carta (612x792)
      ph.style.marginBottom = "12px";
      ph.style.background = "#fff";
      ph.style.boxShadow = "0 1px 3px rgba(0,0,0,0.15)";
      frag.appendChild(ph);
      phs.push(ph);
    }
    pages.appendChild(frag);

    const renderPage = async (pageNum: number, ph: HTMLDivElement) => {
      if (rendered.has(pageNum) || inFlight.has(pageNum)) return;
      inFlight.add(pageNum);
      try {
        const page = await doc.getPage(pageNum);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = "block";
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        ph.replaceChildren(canvas);
        ph.style.aspectRatio = String(viewport.width / viewport.height);
        rendered.add(pageNum);
      } catch {}
      inFlight.delete(pageNum);
    };

    const clearPage = (pageNum: number, ph: HTMLDivElement) => {
      if (rendered.has(pageNum)) {
        ph.replaceChildren();
        rendered.delete(pageNum);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const ph = e.target as HTMLDivElement;
          const n = Number(ph.dataset.page);
          if (e.isIntersecting) renderPage(n, ph);
          else clearPage(n, ph);
        }
      },
      { root: scroll, rootMargin: "600px 0px" }
    );

    phs.forEach((ph) => observer.observe(ph));

    return () => {
      observer.disconnect();
      pages.replaceChildren();
    };
  }, [status]);

  return (
    <div ref={scrollRef} className="relative flex-1 w-full overflow-auto">
      <div ref={pagesRef} className="px-4 py-4" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Cargando PDF…
        </div>
      )}
      {status === "error" && <ErrorView error={errorMsg} proxyUrl={proxyUrl} />}
    </div>
  );
}

function LoadingView() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      Cargando PDF…
    </div>
  );
}

function ErrorView({ error, proxyUrl }: { error: string | null; proxyUrl: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="size-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{error}</p>
      <a
        href={proxyUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium text-primary hover:underline"
      >
        Abrir en una pestaña nueva
      </a>
    </div>
  );
}
