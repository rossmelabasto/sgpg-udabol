export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-xs text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
        <p>
          <span className="font-medium text-foreground">Universidad de Aquino Bolivia</span> · Repositorio de Proyectos de Grado
        </p>
        <p>© {new Date().getFullYear()} Desarrollado por Rossmel Abasto</p>
      </div>
    </footer>
  );
}
