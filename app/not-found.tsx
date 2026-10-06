import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main id="contenido" className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <FileQuestion className="size-12 text-gold" aria-hidden="true" />
      <h1 className="font-heading text-2xl font-semibold text-foreground">No encontramos esta página</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        El proyecto pudo haber sido retirado del repositorio o el enlace está incompleto.
      </p>
      <Link href="/" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Volver al repositorio
      </Link>
    </main>
  );
}
