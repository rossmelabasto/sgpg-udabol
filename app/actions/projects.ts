"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import {
  CARRERAS,
  type SearchResult,
  type ThesisProject,
  type ProjectInput,
  type ProjectHistoryLog,
  type PdfVersion,
  type AuditActionType,
} from "@/lib/projects";
import { adminDb } from "@/lib/firebase/admin";
import {
  requireAdmin,
  requireSession,
  requireSuperadmin,
  actorOf,
  AuthError,
  type Session,
} from "@/lib/auth";
import { normalize, searchInMemory, titleSimilarity, type SearchFilters } from "@/lib/search";
import { deletePdf, isValidPdfPath, pdfExists, resolvePdfPath } from "@/lib/pdf-storage";

type Result = { ok: true; id?: string } | { ok: false; error: string };

function fail(err: unknown, fallback: string): Result {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function docToProject(id: string, data: FirebaseFirestore.DocumentData): ThesisProject {
  return {
    id,
    title: data.title ?? "",
    studentName: data.studentName ?? "",
    career: data.career ?? "",
    year: Number(data.year) || 0,
    abstract: data.abstract ?? "",
    tags: (data.tags as string[]) ?? [],
    hasPdf: !!resolvePdfPath(data),
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt ?? null,
    deleted: !!data.deleted,
    deletedAt: data.deletedAt ?? null,
  };
}

async function loadProjects(): Promise<ThesisProject[]> {
  const snapshot = await adminDb.collection("projects").orderBy("createdAt", "desc").get();
  return snapshot.docs.map((d) => docToProject(d.id, d.data()));
}

export async function getProjects(): Promise<ThesisProject[]> {
  try {
    await requireSession();
    return (await loadProjects()).filter((p) => !p.deleted);
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error obteniendo proyectos:", err);
    return [];
  }
}

export async function getProjectById(projectId: string): Promise<ThesisProject | null> {
  try {
    await requireSession();
    const doc = await adminDb.collection("projects").doc(projectId).get();
    if (!doc.exists || doc.data()!.deleted) return null;
    return docToProject(doc.id, doc.data()!);
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error obteniendo proyecto:", err);
    return null;
  }
}

export async function searchProjects(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
  const all = await getProjects();
  return searchInMemory(all, query, filters);
}

// ---------------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------------

async function addHistoryLog(
  session: Session,
  projectId: string,
  projectTitle: string,
  action: AuditActionType,
  details: string,
) {
  try {
    const entry = {
      projectId,
      projectTitle,
      action,
      details,
      timestamp: new Date().toISOString(),
      ...actorOf(session),
    };
    const batch = adminDb.batch();
    if (action !== "PURGE") {
      batch.set(adminDb.collection("projects").doc(projectId).collection("history").doc(), entry);
    }
    // Registro global: sobrevive aunque el proyecto se borre definitivamente.
    batch.set(adminDb.collection("auditLog").doc(), entry);
    await batch.commit();
  } catch (err) {
    console.error("Error guardando el historial:", err);
  }
}

export async function getProjectHistory(projectId: string): Promise<ProjectHistoryLog[]> {
  try {
    await requireAdmin();
    const snapshot = await adminDb
      .collection("projects")
      .doc(projectId)
      .collection("history")
      .orderBy("timestamp", "desc")
      .get();
    return snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        projectId: d.projectId,
        action: d.action,
        details: d.details,
        timestamp: d.timestamp,
        userRole: d.userRole,
        actorEmail: d.actorEmail ?? null,
        actorName: d.actorName ?? null,
      };
    });
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error obteniendo el historial:", err);
    return [];
  }
}

/** Actividad reciente de todo el sistema (superadmin). */
export async function getRecentActivity(limit = 40): Promise<(ProjectHistoryLog & { projectTitle?: string })[]> {
  try {
    await requireSuperadmin();
    const snap = await adminDb.collection("auditLog").orderBy("timestamp", "desc").limit(limit).get();
    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        projectId: d.projectId,
        projectTitle: d.projectTitle,
        action: d.action,
        details: d.details,
        timestamp: d.timestamp,
        userRole: d.userRole,
        actorEmail: d.actorEmail ?? null,
        actorName: d.actorName ?? null,
      };
    });
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error obteniendo actividad:", err);
    return [];
  }
}

export interface TopContributor {
  name: string;
  count: number;
}

/** Quiénes hicieron más cambios (según el registro global de auditoría). */
export async function getTopContributors(limit = 5): Promise<TopContributor[]> {
  try {
    await requireAdmin();
    const snap = await adminDb.collection("auditLog").select("actorName", "actorEmail").get();
    const counts: Record<string, number> = {};
    snap.docs.forEach((d) => {
      const k = (d.get("actorName") as string) || (d.get("actorEmail") as string) || "Sin registrar";
      counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error obteniendo top contributors:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

function cleanInput(input: ProjectInput) {
  const title = (input.title ?? "").replace(/\s+/g, " ").trim();
  const studentName = (input.studentName ?? "").replace(/\s+/g, " ").trim();
  const career = (input.career ?? "").trim();
  const abstract = (input.abstract ?? "").trim();
  const tags = [
    ...new Set(
      (input.tags ?? [])
        .map((t) => t.replace(/\s+/g, " ").trim())
        .filter((t) => t && t.length <= 40),
    ),
  ].slice(0, 12);
  const year = Number(input.year);

  if (!title || !studentName || !career) {
    return { error: "El título, el nombre del alumno y la carrera son obligatorios." } as const;
  }
  if (title.length > 400) return { error: "El título es demasiado largo." } as const;
  if (!CARRERAS.includes(career as (typeof CARRERAS)[number])) {
    return { error: "La carrera seleccionada no es válida." } as const;
  }
  const maxYear = new Date().getFullYear() + 1;
  if (!Number.isInteger(year) || year < 1990 || year > maxYear) {
    return { error: `El año debe estar entre 1990 y ${maxYear}.` } as const;
  }
  if (abstract.length > 6000) return { error: "El resumen es demasiado largo." } as const;
  return { value: { title, studentName, career, year, abstract, tags } } as const;
}

async function checkNewPdf(pdfPath: string | null | undefined) {
  if (pdfPath === undefined || pdfPath === null) return null;
  if (!isValidPdfPath(pdfPath) || !(await pdfExists(pdfPath))) {
    return "El PDF subido no se encontró. Vuelve a subirlo.";
  }
  return null;
}

export async function createProject(input: ProjectInput & { pdfFileName?: string | null }): Promise<Result> {
  try {
    const session = await requireAdmin();
    const cleaned = cleanInput(input);
    if ("error" in cleaned) return { ok: false, error: cleaned.error! };
    const pdfError = await checkNewPdf(input.pdfPath);
    if (pdfError) return { ok: false, error: pdfError };

    const now = new Date().toISOString();
    const docRef = await adminDb.collection("projects").add({
      ...cleaned.value,
      pdfPath: input.pdfPath ?? null,
      pdfFileName: input.pdfPath ? input.pdfFileName ?? null : null,
      pdfUploadedAt: input.pdfPath ? now : null,
      pdfVersion: input.pdfPath ? 1 : 0,
      createdAt: now,
      updatedAt: now,
      createdBy: session.email ?? session.uid,
      deleted: false,
      deletedAt: null,
    });

    await addHistoryLog(
      session,
      docRef.id,
      cleaned.value.title,
      "CREATE",
      `Proyecto creado. Alumno: ${cleaned.value.studentName}${input.pdfPath ? " (con PDF, versión 1)" : ""}`,
    );
    revalidatePath("/");
    return { ok: true, id: docRef.id };
  } catch (err) {
    return fail(err, "No se pudo guardar el proyecto.");
  }
}

export async function updateProject(
  id: string,
  input: ProjectInput & { pdfFileName?: string | null },
): Promise<Result> {
  try {
    const session = await requireAdmin();
    const cleaned = cleanInput(input);
    if ("error" in cleaned) return { ok: false, error: cleaned.error! };
    const pdfError = await checkNewPdf(input.pdfPath);
    if (pdfError) return { ok: false, error: pdfError };

    const docRef = adminDb.collection("projects").doc(id);
    const oldDoc = await docRef.get();
    if (!oldDoc.exists) return { ok: false, error: "El proyecto no existe." };
    const old = oldDoc.data()!;
    const v = cleaned.value;

    const changes: string[] = [];
    if (old.title !== v.title) changes.push("título");
    if (old.studentName !== v.studentName) changes.push("autor");
    if (old.career !== v.career) changes.push("carrera");
    if (Number(old.year) !== v.year) changes.push("año");
    if ((old.abstract ?? "") !== v.abstract) changes.push("resumen");
    const oldTags = [...((old.tags as string[]) ?? [])].sort();
    if (JSON.stringify(oldTags) !== JSON.stringify([...v.tags].sort())) changes.push("etiquetas");

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { ...v, updatedAt: now };
    const batch = adminDb.batch();
    let pdfNote = "";

    const currentPath = resolvePdfPath(old);
    if (input.pdfPath !== undefined && input.pdfPath !== currentPath) {
      const currentVersion = Number(old.pdfVersion) || (currentPath ? 1 : 0);
      if (currentPath) {
        // La versión vigente pasa al historial de versiones.
        batch.set(docRef.collection("pdfHistory").doc(), {
          path: currentPath,
          version: currentVersion,
          fileName: old.pdfFileName ?? null,
          uploadedAt: old.pdfUploadedAt ?? old.createdAt ?? null,
          replacedAt: now,
        });
      }
      if (input.pdfPath) {
        updates.pdfPath = input.pdfPath;
        updates.pdfFileName = input.pdfFileName ?? null;
        updates.pdfUploadedAt = now;
        updates.pdfVersion = currentVersion + 1;
        pdfNote = `Nueva versión del PDF (v${currentVersion + 1})`;
      } else {
        updates.pdfPath = null;
        updates.pdfFileName = null;
        updates.pdfUploadedAt = null;
        pdfNote = "PDF quitado (queda en el historial de versiones)";
      }
      updates.pdfUrl = FieldValue.delete();
    }

    if (changes.length === 0 && !pdfNote) return { ok: true, id };

    batch.update(docRef, updates as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
    await batch.commit();

    const details = [changes.length ? `Cambios en: ${changes.join(", ")}` : "", pdfNote].filter(Boolean).join(". ");
    await addHistoryLog(session, id, v.title, pdfNote ? "PDF_UPLOAD" : "UPDATE", details);
    revalidatePath("/");
    revalidatePath(`/proyecto/${id}`);
    return { ok: true, id };
  } catch (err) {
    return fail(err, "No se pudo actualizar el proyecto.");
  }
}

export async function deleteProject(id: string): Promise<Result> {
  try {
    const session = await requireAdmin();
    const ref = adminDb.collection("projects").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, error: "El proyecto no existe." };
    await ref.update({ deleted: true, deletedAt: new Date().toISOString() });
    await addHistoryLog(session, id, doc.data()!.title, "DELETE", "Proyecto enviado a la papelera");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo eliminar el proyecto.");
  }
}

export async function restoreProject(id: string): Promise<Result> {
  try {
    const session = await requireAdmin();
    const ref = adminDb.collection("projects").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, error: "El proyecto no existe." };
    await ref.update({ deleted: false, deletedAt: null, cleanupTag: FieldValue.delete() });
    await addHistoryLog(session, id, doc.data()!.title, "RESTORE", "Proyecto restaurado desde la papelera");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo restaurar el proyecto.");
  }
}

export async function getDeletedProjects(): Promise<ThesisProject[]> {
  try {
    await requireAdmin();
    const snapshot = await adminDb.collection("projects").where("deleted", "==", true).get();
    return snapshot.docs
      .map((d) => docToProject(d.id, d.data()))
      .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error obteniendo la papelera:", err);
    return [];
  }
}

/** Borrado definitivo (solo superadmin y solo desde la papelera): borra también los PDFs. */
export async function permanentlyDeleteProject(id: string): Promise<Result> {
  try {
    const session = await requireSuperadmin();
    const ref = adminDb.collection("projects").doc(id);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, error: "El proyecto no existe." };
    const data = doc.data()!;
    if (!data.deleted) return { ok: false, error: "Primero envía el proyecto a la papelera." };

    const [history, pdfHistory] = await Promise.all([
      ref.collection("history").get(),
      ref.collection("pdfHistory").get(),
    ]);
    const paths = [resolvePdfPath(data), ...pdfHistory.docs.map((d) => resolvePdfPath(d.data()))];

    const batch = adminDb.batch();
    history.docs.forEach((d) => batch.delete(d.ref));
    pdfHistory.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();
    await Promise.all(paths.map((p) => deletePdf(p).catch(() => {})));

    await addHistoryLog(session, id, data.title, "PURGE", `Borrado definitivo (incluye ${paths.filter(Boolean).length} PDF)`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo eliminar definitivamente.");
  }
}

// ---------------------------------------------------------------------------
// Versiones de PDF
// ---------------------------------------------------------------------------

/** Versiones del PDF: la vigente primero (id "actual") y luego las anteriores. */
export async function getPdfHistory(projectId: string): Promise<PdfVersion[]> {
  try {
    await requireAdmin();
    const ref = adminDb.collection("projects").doc(projectId);
    const [doc, snap] = await Promise.all([ref.get(), ref.collection("pdfHistory").get()]);
    const data = doc.data() ?? {};
    const old = snap.docs
      .map((d, i) => {
        const x = d.data();
        return {
          id: d.id,
          version: Number(x.version) || 0,
          uploadedAt: x.uploadedAt ?? x.replacedAt ?? "",
          replacedAt: x.replacedAt ?? null,
          fileName: x.fileName ?? null,
          _order: x.replacedAt ?? x.uploadedAt ?? String(i),
        };
      })
      .sort((a, b) => String(a._order).localeCompare(String(b._order)));
    // Versiones antiguas sin número: se numeran por orden.
    old.forEach((v, i) => {
      if (!v.version) v.version = i + 1;
    });
    const result: PdfVersion[] = old.map(({ id, version, uploadedAt, replacedAt, fileName }) => ({ id, version, uploadedAt, replacedAt, fileName }));
    if (resolvePdfPath(data)) {
      result.push({
        id: "actual",
        version: Number(data.pdfVersion) || old.length + 1,
        uploadedAt: data.pdfUploadedAt ?? data.updatedAt ?? data.createdAt ?? "",
        replacedAt: null,
        fileName: data.pdfFileName ?? null,
      });
    }
    return result.reverse();
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error obteniendo versiones de PDF:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Duplicados y subidas descartadas
// ---------------------------------------------------------------------------

export type DuplicateMatch = { index: number; id: string; title: string; studentName: string; similarity: number };

/** Para cada título candidato, devuelve proyectos existentes muy parecidos. */
export async function checkDuplicates(
  items: { title: string; studentName?: string }[],
): Promise<DuplicateMatch[]> {
  try {
    await requireAdmin();
    const all = (await loadProjects()).filter((p) => !p.deleted);
    const out: DuplicateMatch[] = [];
    items.forEach((item, index) => {
      if (!item.title?.trim()) return;
      for (const p of all) {
        let sim = titleSimilarity(item.title, p.title);
        // Mismo alumno y título parecido: casi seguro es el mismo proyecto.
        if (item.studentName && normalize(item.studentName) === normalize(p.studentName)) sim = Math.min(1, sim + 0.2);
        if (sim >= 0.75) out.push({ index, id: p.id, title: p.title, studentName: p.studentName, similarity: Math.round(sim * 100) / 100 });
      }
    });
    return out;
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error buscando duplicados:", err);
    return [];
  }
}

/** Borra un PDF recién subido que no llegó a asociarse a ningún proyecto. */
export async function discardUpload(path: string): Promise<Result> {
  try {
    await requireAdmin();
    if (!isValidPdfPath(path)) return { ok: false, error: "Ruta no válida." };
    // Solo se llama justo después de una subida que no llegó a guardarse, así
    // que basta con comprobar que ningún proyecto la tenga como PDF vigente.
    const inUse = await adminDb.collection("projects").where("pdfPath", "==", path).limit(1).get();
    if (!inUse.empty) return { ok: false, error: "El PDF está en uso." };
    await deletePdf(path);
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo descartar el PDF.");
  }
}

/** Proyectos relacionados: comparten palabras clave (y suman si son de la misma carrera). */
export async function getRelatedProjects(projectId: string, limit = 3): Promise<ThesisProject[]> {
  try {
    await requireSession();
    const all = (await loadProjects()).filter((p) => !p.deleted);
    const me = all.find((p) => p.id === projectId);
    if (!me) return [];
    const myTags = new Set((me.tags ?? []).map((t) => normalize(t)));
    return all
      .filter((p) => p.id !== projectId)
      .map((p) => {
        const shared = (p.tags ?? []).filter((t) => myTags.has(normalize(t))).length;
        return { p, score: shared * 3 + (p.career === me.career ? 1 : 0) + titleSimilarity(p.title, me.title) * 4 };
      })
      .filter((x) => x.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.p);
  } catch {
    return [];
  }
}
