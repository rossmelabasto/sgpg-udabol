"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, FilePlus2, FolderCog, Search, UploadCloud, Users } from "lucide-react";
import { ProjectSearch } from "@/components/project-search";
import { ProjectForm } from "@/components/project-form";
import { AdminProjects } from "@/components/admin-projects";
import { AdminUsers } from "@/components/admin-users";
import { Dashboard } from "@/components/dashboard";
import { BulkPdfUpload } from "@/components/bulk-pdf-upload";
import { deleteProject, getProjects } from "@/app/actions/projects";
import type { SearchResult, UserRole } from "@/lib/projects";

type Tab = "buscar" | "administrar" | "registrar" | "subida" | "estadisticas" | "usuarios";

const TABS: { id: Tab; label: string; icon: typeof Search; superOnly?: boolean }[] = [
  { id: "buscar", label: "Buscar", icon: Search },
  { id: "administrar", label: "Administrar", icon: FolderCog },
  { id: "registrar", label: "Registrar", icon: FilePlus2 },
  { id: "subida", label: "Subida masiva", icon: UploadCloud },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
  { id: "usuarios", label: "Usuarios", icon: Users, superOnly: true },
];

export function HomeTabs({ initial, role }: { initial: SearchResult[]; role: UserRole }) {
  const tabs = TABS.filter((t) => !t.superOnly || role === "superadmin");
  const [tab, setTabState] = useState<Tab>("buscar");
  const [projects, setProjects] = useState(initial);
  const [editingProject, setEditingProject] = useState<SearchResult | null>(null);

  // La vista activa vive en la URL (?vista=...), así se puede recargar o compartir.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("vista") as Tab | null;
    if (v && tabs.some((t) => t.id === v)) setTabState(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTab(next: Tab) {
    setTabState(next);
    if (next !== "registrar") setEditingProject(null);
    const p = new URLSearchParams(window.location.search);
    if (next === "buscar") p.delete("vista");
    else p.set("vista", next);
    if (next !== "buscar") ["q", "carrera", "desde", "hasta", "tag"].forEach((k) => p.delete(k));
    const qs = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  async function refreshProjects() {
    const rows = await getProjects();
    setProjects(rows.map((r) => ({ ...r, score: 0 })));
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    await refreshProjects();
  }

  if (role === "anonymous") return <ProjectSearch initial={projects} />;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Secciones" className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-card sm:w-full">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors sm:flex-1 ${
                tab === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div key={tab} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {tab === "buscar" && <ProjectSearch initial={projects} />}

        {tab === "administrar" && (
          <Panel title="Gestión de proyectos" description="Edita, revisa el historial y las versiones de PDF, o envía proyectos a la papelera.">
            <AdminProjects
              projects={projects}
              onDelete={handleDelete}
              onEdit={(project) => {
                setEditingProject(project);
                setTab("registrar");
                setEditingProject(project);
              }}
            />
          </Panel>
        )}

        {tab === "registrar" && (
          <Panel
            title={editingProject ? "Editar proyecto" : "Registrar proyecto de grado"}
            description={
              editingProject
                ? "Corrige los datos o reemplaza el PDF; la versión anterior queda en el historial."
                : "Sube el PDF primero (opcional): se detectan los datos automáticamente y luego puedes ajustarlos."
            }
          >
            <ProjectForm
              mode={editingProject ? "edit" : "create"}
              project={editingProject}
              destinationTab={editingProject ? "administrar" : "registrar"}
              onSuccess={async (dest?: string) => {
                setEditingProject(null);
                await refreshProjects();
                if (dest) setTab(dest as Tab);
              }}
            />
          </Panel>
        )}

        {tab === "subida" && (
          <Panel title="Subida masiva" description="Carga varios PDFs a la vez: revisa los datos detectados antes de guardarlos.">
            <BulkPdfUpload onSuccess={refreshProjects} />
          </Panel>
        )}

        {tab === "estadisticas" && (
          <Panel title="Estadísticas del repositorio">
            <Dashboard />
          </Panel>
        )}

        {tab === "usuarios" && role === "superadmin" && (
          <Panel title="Cuentas administrativas" description="Solo el superadministrador ve esta sección. Desactivar o quitar una cuenta le corta el acceso de inmediato.">
            <AdminUsers />
          </Panel>
        )}
      </div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-7">
      <header className="mb-6">
        <h2 className="font-heading text-xl font-semibold text-card-foreground sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}
