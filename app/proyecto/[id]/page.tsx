import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionInfo } from "@/app/actions/auth";
import { getProjectById, getRelatedProjects } from "@/app/actions/projects";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { ProjectDetail } from "@/components/project-detail";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectById(id);
  return { title: project ? project.title : "Proyecto de grado" };
}

export default async function ProjectDetailPage({ params }: Params) {
  const { id } = await params;
  const session = await getSessionInfo();
  // Enlace compartido sin sesión: ingresar y volver a este mismo proyecto.
  if (!session) redirect(`/ingresar?next=${encodeURIComponent(`/proyecto/${id}`)}`);

  const [project, related] = await Promise.all([getProjectById(id), getRelatedProjects(id)]);
  if (!project) notFound();

  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main id="contenido" className="flex-1">
        <ProjectDetail project={project} related={related} />
      </main>
      <SiteFooter />
    </div>
  );
}
