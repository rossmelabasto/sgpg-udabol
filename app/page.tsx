import { redirect } from "next/navigation";
import { getSessionInfo } from "@/app/actions/auth";
import { getProjects } from "@/app/actions/projects";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { HomeTabs } from "@/components/home-tabs";
import { isAdminRole } from "@/lib/projects";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await getSessionInfo();
  if (!session) redirect("/ingresar");
  const { vista } = await searchParams;

  const rows = await getProjects();
  const careers = new Set(rows.map((r) => r.career)).size;
  const withPdf = rows.filter((r) => r.hasPdf).length;
  const admin = isAdminRole(session.role);

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <section className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 sm:px-6 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-dark dark:text-gold">
            {admin ? "Panel de gestión" : "Universidad de Aquino Bolivia"}
          </p>
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">Repositorio de Proyectos de Grado</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} proyectos · {careers} carreras · {withPdf} con documento digital
          </p>
        </div>
      </section>

      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <HomeTabs initial={rows.map((r) => ({ ...r, score: 0 }))} role={session.role} initialTab={vista} />
      </main>

      <SiteFooter />
    </div>
  );
}
