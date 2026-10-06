"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // El script del layout ya aplicó el tema antes de pintar; aquí solo se lee.
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem("udabol-theme", next ? "dark" : "light");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex size-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-current transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-gold ${className}`}
      title={dark ? "Modo claro" : "Modo oscuro"}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
