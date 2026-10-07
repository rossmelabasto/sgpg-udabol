"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

type Props = {
  pageSize: number;
  currentPage: number;
  totalItems: number;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function PaginationControls({
  pageSize,
  currentPage,
  totalItems,
  onPageSizeChange,
  onPageChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.max(1, Math.min(currentPage, totalPages));

  // Generar páginas visibles (mostrar máximo 7 botones numerados)
  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [];

    if (safePage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    } else if (safePage >= totalPages - 3) {
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("...");
      for (let i = safePage - 1; i <= safePage + 1; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }

  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  return (
    <nav aria-label="Paginación" className="flex flex-col items-center gap-3 pt-2">
      {/* Info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Mostrando {from}–{to} de {totalItems}
        </span>
        <div className="flex items-center gap-1.5">
          <span>Por página:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="!h-7 w-[60px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botones de página */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
          title="Primera página"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          title="Página anterior"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        {getPageNumbers().map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === safePage ? "default" : "outline"}
              size="sm"
              className="h-8 min-w-[2rem] px-0 text-xs"
              aria-current={p === safePage ? "page" : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          title="Página siguiente"
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Última página"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
}
