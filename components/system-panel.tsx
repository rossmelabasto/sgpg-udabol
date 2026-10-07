"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Copy, DatabaseBackup, Download, FileWarning, Loader2, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatDateTime } from "@/components/project-history";
import { deleteOrphanPdfs, exportBackup, findDuplicateGroups, findOrphanPdfs, type DuplicateGroup, type OrphanPdf } from "@/app/actions/system";
import { getRecentActivity } from "@/app/actions/projects";
import type { ProjectHistoryLog } from "@/lib/projects";

/** Herramientas del superadministrador. */
export function SystemPanel() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <BackupCard />
      <DuplicatesCard />
      <OrphansCard />
      <ActivityCard />
    </div>
  );
}

function Card({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <header className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary dark:text-gold">{icon}</span>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setMsg(null);
    const r = await exportBackup();
    setBusy(false);
    if (!r.ok || !r.data) return setMsg(r.ok ? "Respaldo vacío." : r.error);
    const url = URL.createObjectURL(new Blob([r.data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `respaldo-sgpg-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(`Respaldo descargado (${(r.data.length / 1024).toFixed(0)} KB).`);
  }
  return (
    <Card icon={<DatabaseBackup className="size-5" />} title="Respaldo de datos" description="Descarga todos los proyectos, su historial, versiones y administradores en un archivo JSON. Los PDFs quedan en Storage (no se incluyen).">
      <Button onClick={run} disabled={busy} className="w-fit">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Descargar respaldo
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <p className="text-xs text-muted-foreground">Recomendado: una vez al mes y antes de cambios grandes; guárdalo fuera de la computadora.</p>
    </Card>
  );
}

function DuplicatesCard() {
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    const r = await findDuplicateGroups();
    setBusy(false);
    if (r.ok) setGroups(r.data ?? []);
    else setError(r.error);
  }
  return (
    <Card icon={<Copy className="size-5" />} title="Posibles duplicados" description="Proyectos con títulos casi iguales. Revísalos y envía a la papelera el que sobre (desde Administrar).">
      <Button variant="outline" onClick={run} disabled={busy} className="w-fit">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar duplicados
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {groups && groups.length === 0 && <p className="text-sm text-success">No se encontraron duplicados.</p>}
      {groups && groups.length > 0 && (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {groups.map((g, i) => (
            <li key={i} className="rounded-lg border border-border p-3 text-sm">
              <p className="mb-1.5 text-xs font-semibold text-gold-dark dark:text-gold">{Math.round(g.similarity * 100)}% parecidos</p>
              {g.projects.map((p) => (
                <Link key={p.id} href={`/proyecto/${p.id}`} target="_blank" className="block py-0.5 hover:underline">
                  <span className="text-foreground">{p.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {p.studentName} · {p.year}
                    {p.hasPdf ? " · con PDF" : ""} · registrado {p.createdAt.slice(0, 10)}
                  </span>
                </Link>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OrphansCard() {
  const [orphans, setOrphans] = useState<OrphanPdf[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function scan() {
    setBusy(true);
    setMsg(null);
    const r = await findOrphanPdfs();
    setBusy(false);
    if (r.ok) setOrphans(r.data ?? []);
    else setMsg(r.error);
  }
  const total = (orphans ?? []).reduce((s, o) => s + o.size, 0);
  return (
    <Card icon={<FileWarning className="size-5" />} title="PDFs huérfanos" description="Archivos en Storage que ningún proyecto usa (subidas que nunca se guardaron). Ocupan espacio sin servir.">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={scan} disabled={busy} className="w-fit">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Revisar almacenamiento
        </Button>
        {orphans && orphans.length > 0 && (
          <Button variant="destructive" onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" /> Borrar {orphans.length}
          </Button>
        )}
      </div>
      {orphans && (
        <p className="text-sm text-muted-foreground">
          {orphans.length === 0 ? "No hay PDFs huérfanos." : `${orphans.length} archivo(s), ${(total / 1024 / 1024).toFixed(1)} MB en total.`}
        </p>
      )}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="¿Borrar los PDFs huérfanos?"
        description="Se vuelve a verificar que ningún proyecto (ni en la papelera ni en versiones anteriores) los use antes de borrarlos. No se puede deshacer."
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          const r = await deleteOrphanPdfs((orphans ?? []).map((o) => o.path));
          setMsg(r.ok ? `${r.data} archivo(s) borrados.` : r.error);
          setOrphans(null);
        }}
      />
    </Card>
  );
}

function ActivityCard() {
  const [items, setItems] = useState<(ProjectHistoryLog & { projectTitle?: string })[] | null>(null);
  useEffect(() => {
    getRecentActivity(30).then(setItems);
  }, []);
  return (
    <Card icon={<Activity className="size-5" />} title="Actividad reciente" description="Últimos cambios hechos por cualquier administrador.">
      {!items ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay actividad registrada con el nuevo sistema.</p>
      ) : (
        <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto">
          {items.map((it) => (
            <li key={it.id} className="py-2 text-sm">
              <p className="text-foreground">
                <span className="font-medium">{it.actorName || it.actorEmail || "—"}</span> · {it.details}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDateTime(it.timestamp)} · {it.projectTitle}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
