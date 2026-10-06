import { GraduationCap } from "lucide-react";

/** Sello institucional: birrete dorado sobre petróleo (no reemplaza al logo oficial). */
export function BrandMark({ className = "size-10" }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-xl bg-teal-dark text-gold ring-1 ring-gold/50 ${className}`}
      aria-hidden="true"
    >
      <GraduationCap className="size-[58%]" strokeWidth={1.8} />
    </span>
  );
}

export function BrandWordmark({ subtitle = "Repositorio de Proyectos de Grado" }: { subtitle?: string }) {
  return (
    <span className="flex flex-col leading-none">
      <span className="font-heading text-lg font-semibold tracking-wide">
        UDABOL
      </span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] opacity-75">{subtitle}</span>
    </span>
  );
}
