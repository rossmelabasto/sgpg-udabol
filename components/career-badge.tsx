import { GraduationCap } from "lucide-react";

// Un color por carrera (dentro de la paleta institucional).
const STYLES: Record<string, string> = {
  "Ingeniería en Sistemas": "border-teal/25 bg-teal/8 text-teal dark:border-teal-light dark:bg-teal-light/30 dark:text-white",
  "Ingeniería en Telecomunicaciones": "border-chart-3/30 bg-chart-3/10 text-chart-3",
  "Ingeniería Petrolera": "border-gold/40 bg-gold/12 text-gold-dark dark:text-gold-light",
  "Ingeniería Civil": "border-chart-5/30 bg-chart-5/10 text-chart-5",
};

export function careerShort(career: string) {
  return career.replace(/^Ingeniería (en |de )?/, "");
}

export function CareerBadge({ career, short = false }: { career: string; short?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        STYLES[career] ?? "border-border bg-secondary text-secondary-foreground"
      }`}
      title={career}
    >
      <GraduationCap className="size-3" aria-hidden="true" />
      {short ? careerShort(career) : career}
    </span>
  );
}
