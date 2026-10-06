"use client";

import { useState } from "react";
import { ProjectSearch } from "@/components/project-search";
import { ProjectForm } from "@/components/project-form";
import { AdminProjects } from "@/components/admin-projects";
import { AdminUsers } from "@/components/admin-users";
import { Dashboard } from "@/components/dashboard";
import { BulkPdfUpload } from "@/components/bulk-pdf-upload";
import { deleteProject, getProjects } from "@/app/actions/projects";
import type { SearchResult, UserRole } from "@/lib/projects";
import {
  Search,
  FilePlus2,
  ShieldCheck,
  FolderGit2,
  UploadCloud,
  Users,
  BarChart3,
} from "lucide-react";

type Tab = "buscar" | "registrar" | "admin" | "dashboard" | "usuarios" | "bulk";

export function HomeTabs({
  initial,
  role,
}: {
  initial: SearchResult[];
  role: UserRole;
}) {
  const [tab, setTabState] = useState<Tab>(() => {
    if (typeof window === "undefined") return "buscar";
    const saved = (sessionStorage.getItem("sgpg-tab") as Tab) || "buscar";
    return saved === "usuarios" && role !== "superadmin" ? "buscar" : saved;
  });

  function setTab(next: Tab) {
    setTabState(next);
    try { sessionStorage.setItem("sgpg-tab", next); } catch {}
  }
  const [projects, setProjects] = useState(initial);
  const [editingProject, setEditingProject] = useState<SearchResult | null>(null);

  async function refreshProjects() {
    const rows = await getProjects();
    setProjects(rows.map((r) => ({ ...r, score: 0 })));
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    await refreshProjects();
  }

  // Vista anónima: solo búsqueda, sin tabs
  if (role === "anonymous") {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <ProjectSearch initial={projects} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-2 rounded-2xl bg-muted/50 p-2 border border-border/50" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
        <TabButton active={tab === "buscar"} onClick={() => setTab("buscar")}>
          <Search className="size-4.5" aria-hidden="true" /> Buscar
        </TabButton>
        <TabButton active={tab === "admin"} onClick={() => setTab("admin")}>
          <FolderGit2 className="size-4.5" aria-hidden="true" /> Administrar
        </TabButton>
        {role === "superadmin" && (
          <TabButton active={tab === "usuarios"} onClick={() => { setEditingProject(null); setTab("usuarios"); }}>
            <Users className="size-4.5" aria-hidden="true" /> Usuarios
          </TabButton>
        )}
        <TabButton active={tab === "dashboard"} onClick={() => { setEditingProject(null); setTab("dashboard"); }}>
          <BarChart3 className="size-4.5" aria-hidden="true" /> Estadísticas
        </TabButton>
        <TabButton active={tab === "registrar"} onClick={() => { setEditingProject(null); setTab("registrar"); }}>
          <FilePlus2 className="size-4.5" aria-hidden="true" /> Registrar
        </TabButton>
        <TabButton active={tab === "bulk"} onClick={() => { setEditingProject(null); setTab("bulk"); }}>
          <UploadCloud className="size-4.5" aria-hidden="true" /> Subida Masiva
        </TabButton>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {tab === "buscar" ? (
          <ProjectSearch initial={projects} />
        ) : tab === "admin" ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="mb-2 text-2xl font-bold text-card-foreground flex items-center gap-2">
              <ShieldCheck className="size-6 text-primary" /> Gestión de proyectos
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Usa esta vista para editar o eliminar proyectos y para administrar el repositorio oficial.
            </p>
            <AdminProjects projects={projects} onDelete={handleDelete} onEdit={(project) => { setEditingProject(project); setTab("registrar"); }} />
          </div>
        ) : tab === "dashboard" ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="mb-6 text-2xl font-bold text-card-foreground flex items-center gap-2">
              <BarChart3 className="size-6 text-primary" /> Estadísticas del Repositorio
            </h2>
            <Dashboard />
          </div>
        ) : tab === "usuarios" && role === "superadmin" ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="mb-2 text-2xl font-bold text-card-foreground flex items-center gap-2">
              <Users className="size-6 text-primary" /> Gestión de Administradores
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Agrega o elimina administradores del sistema para controlar quién puede registrar y gestionar proyectos.
            </p>
            <AdminUsers />
          </div>
        ) : tab === "registrar" ? (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="mb-2 text-2xl font-bold text-card-foreground flex items-center gap-2">
              <FilePlus2 className="size-6 text-primary" />
              {editingProject ? "Editar proyecto" : "Nuevo proyecto de grado"}
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Sube un PDF primero, si quieres, y luego ajusta los datos antes de guardar.
            </p>
            <ProjectForm
              mode={editingProject ? "edit" : "create"}
              project={editingProject}
              destinationTab={editingProject ? "admin" : "registrar"}
              onSuccess={async (dest?: string) => {
                setEditingProject(null);
                await refreshProjects();
                if (dest) setTab(dest as Tab);
              }}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h2 className="mb-2 text-2xl font-bold text-card-foreground flex items-center gap-2">
              <UploadCloud className="size-6 text-primary" /> Subida Masiva de Proyectos
            </h2>
            <p className="mb-8 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Arrastra múltiples PDFs aquí. El sistema extraerá los metadatos de todos en lote.
            </p>
            <BulkPdfUpload onSuccess={refreshProjects} />
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`flex items-center justify-center gap-2.5 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all sm:text-base ${
        active ? "bg-card text-primary shadow-sm ring-1 ring-border/50 scale-[1.01]" : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
      }`}
    >
      {children}
    </button>
  );
}
