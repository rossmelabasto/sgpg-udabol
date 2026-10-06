"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Values = { title: string; studentName: string; career: string; year: string; abstract: string; tags: string };

type Props = {
  open: boolean;
  current: Values;
  extracted: Values;
  onUseExtracted: () => void;
  onKeepCurrent: () => void;
};

const FIELDS: [keyof Values, string][] = [
  ["title", "Título"],
  ["studentName", "Alumno"],
  ["career", "Carrera"],
  ["year", "Año"],
  ["tags", "Palabras clave"],
  ["abstract", "Resumen"],
];

const short = (v: string) => (v.length > 160 ? `${v.slice(0, 160)}…` : v) || "—";

/** Se muestra solo cuando el formulario ya tenía datos y el PDF detectó otros distintos. */
export function PdfComparisonDialog({ open, current, extracted, onUseExtracted, onKeepCurrent }: Props) {
  const rows = FIELDS.filter(([k]) => extracted[k] && extracted[k].trim() !== current[k].trim());
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onKeepCurrent()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Datos detectados en el PDF</DialogTitle>
          <DialogDescription>
            El PDF trae datos distintos a los del formulario. Elige con cuáles quedarte (luego puedes ajustar cualquier campo).
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[7rem_1fr_1fr] bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="px-3 py-2">Campo</span>
            <span className="px-3 py-2">Actual</span>
            <span className="px-3 py-2">Del PDF</span>
          </div>
          {rows.map(([k, label]) => (
            <div key={k} className="grid grid-cols-[7rem_1fr_1fr] border-t border-border text-sm">
              <span className="px-3 py-2 font-medium text-muted-foreground">{label}</span>
              <span className="px-3 py-2 text-foreground/80">{short(current[k])}</span>
              <span className="bg-gold/8 px-3 py-2 text-foreground">{short(extracted[k])}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onKeepCurrent}>
            Mantener los actuales
          </Button>
          <Button onClick={onUseExtracted}>Usar los del PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
