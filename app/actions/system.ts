// app/actions/system.ts — mantenimiento (respaldo, duplicados, PDFs huérfanos).
"use server";

import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { AuthError, requireAdmin, requireSuperadmin } from "@/lib/auth";
import { deletePdf, PDF_PREFIX, resolvePdfPath } from "@/lib/pdf-storage";
import { titleSimilarity } from "@/lib/search";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(err: unknown, fallback: string): { ok: false; error: string } {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

/**
 * Respaldo completo de los datos (proyectos con su historial y versiones de
 * PDF, administradores y registro de auditoría) en JSON. No incluye los
 * archivos PDF (solo sus rutas) ni contraseñas.
 */
export async function exportBackup(): Promise<Result<string>> {
  try {
    const me = await requireSuperadmin();
    const projects = await adminDb.collection("projects").get();
    const out = [];
    for (const d of projects.docs) {
      const [history, pdfHistory] = await Promise.all([d.ref.collection("history").get(), d.ref.collection("pdfHistory").get()]);
      out.push({
        id: d.id,
        ...d.data(),
        history: history.docs.map((h) => ({ id: h.id, ...h.data() })),
        pdfHistory: pdfHistory.docs.map((h) => ({ id: h.id, ...h.data() })),
      });
    }
    const [admins, audit] = await Promise.all([adminDb.collection("admins").get(), adminDb.collection("auditLog").get()]);
    const backup = {
      generado: new Date().toISOString(),
      generadoPor: me.email,
      sistema: "SGPG UDABOL",
      proyectos: out,
      administradores: admins.docs.map((a) => ({ id: a.id, ...a.data() })),
      auditoria: audit.docs.map((a) => ({ id: a.id, ...a.data() })),
    };
    return { ok: true, data: JSON.stringify(backup, null, 2) };
  } catch (err) {
    return fail(err, "No se pudo generar el respaldo.");
  }
}

export type DuplicateGroup = { similarity: number; projects: { id: string; title: string; studentName: string; year: number; hasPdf: boolean; createdAt: string }[] };

/** Pares de proyectos activos con títulos muy parecidos (posibles duplicados). */
export async function findDuplicateGroups(threshold = 0.8): Promise<Result<DuplicateGroup[]>> {
  try {
    await requireAdmin();
    const snap = await adminDb.collection("projects").get();
    const items = snap.docs.filter((d) => !d.data().deleted).map((d) => {
      const x = d.data();
      return { id: d.id, title: x.title as string, studentName: x.studentName as string, year: Number(x.year), hasPdf: !!resolvePdfPath(x), createdAt: (x.createdAt as string) ?? "" };
    });
    const groups: DuplicateGroup[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const sim = titleSimilarity(items[i].title, items[j].title);
        if (sim >= threshold) groups.push({ similarity: Math.round(sim * 100) / 100, projects: [items[i], items[j]] });
      }
    }
    return { ok: true, data: groups.sort((a, b) => b.similarity - a.similarity) };
  } catch (err) {
    return fail(err, "No se pudo buscar duplicados.");
  }
}

export type OrphanPdf = { path: string; size: number; updated: string };

async function referencedPaths(): Promise<Set<string>> {
  const used = new Set<string>();
  const projects = await adminDb.collection("projects").get();
  for (const d of projects.docs) {
    const p = resolvePdfPath(d.data());
    if (p) used.add(p);
    const versions = await d.ref.collection("pdfHistory").get();
    versions.docs.forEach((v) => {
      const vp = resolvePdfPath(v.data());
      if (vp) used.add(vp);
    });
  }
  return used;
}

/** PDFs en Storage que ningún proyecto (ni la papelera ni el historial) usa, de hace más de 1 día. */
export async function findOrphanPdfs(): Promise<Result<OrphanPdf[]>> {
  try {
    await requireSuperadmin();
    const [[files], used] = await Promise.all([adminStorage.bucket().getFiles({ prefix: PDF_PREFIX }), referencedPaths()]);
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const orphans = files
      .filter((f) => !used.has(f.name))
      .map((f) => ({ path: f.name, size: Number(f.metadata.size ?? 0), updated: String(f.metadata.updated ?? f.metadata.timeCreated ?? "") }))
      .filter((f) => !f.updated || new Date(f.updated).getTime() < dayAgo);
    return { ok: true, data: orphans };
  } catch (err) {
    return fail(err, "No se pudo revisar el almacenamiento.");
  }
}

export async function deleteOrphanPdfs(paths: string[]): Promise<Result<number>> {
  try {
    await requireSuperadmin();
    const used = await referencedPaths();
    const safe = paths.filter((p) => p.startsWith(PDF_PREFIX) && !used.has(p));
    await Promise.all(safe.map((p) => deletePdf(p)));
    return { ok: true, data: safe.length };
  } catch (err) {
    return fail(err, "No se pudieron borrar los PDFs.");
  }
}
