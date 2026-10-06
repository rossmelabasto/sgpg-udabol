// lib/projects.ts — tipos y constantes compartidos (cliente y servidor).

export const CARRERAS = [
  "Ingeniería en Sistemas",
  "Ingeniería en Telecomunicaciones",
  "Ingeniería Petrolera",
  "Ingeniería Civil",
] as const;

export type UserRole = "anonymous" | "admin" | "superadmin";

export function isAdminRole(role: UserRole | undefined | null) {
  return role === "admin" || role === "superadmin";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  anonymous: "Invitado",
  admin: "Administrador",
  superadmin: "Superadministrador",
};

/** Proyecto tal como lo ve la interfaz (sin rutas ni URLs internas del PDF). */
export interface ThesisProject {
  id: string;
  title: string;
  studentName: string;
  career: string;
  year: number;
  abstract: string;
  tags?: string[];
  /** true si el proyecto tiene un PDF; se sirve por /api/pdf/<id>. */
  hasPdf: boolean;
  createdAt: string;
  updatedAt?: string | null;
  deleted?: boolean;
  deletedAt?: string | null;
}

export type SearchResult = ThesisProject & {
  score?: number;
};

export interface ProjectInput {
  title: string;
  studentName: string;
  career: string;
  year: number;
  abstract: string;
  tags?: string[];
  /**
   * Ruta en Storage de un PDF recién subido (devuelta por /api/upload-pdf).
   * `undefined` = no tocar el PDF actual; `null` = quitar el PDF.
   */
  pdfPath?: string | null;
}

export interface PdfVersion {
  id: string;
  /** Número de versión (1 = la primera que se subió). */
  version: number;
  uploadedAt: string;
  /** Cuándo dejó de ser la versión vigente. */
  replacedAt?: string | null;
  fileName?: string | null;
  size?: number | null;
}

export type AuditActionType = "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "PDF_UPLOAD" | "PURGE";

export interface ProjectHistoryLog {
  id: string;
  projectId: string;
  action: AuditActionType;
  details: string;
  timestamp: string;
  userRole: UserRole;
  actorEmail?: string | null;
  actorName?: string | null;
}

export const MAX_PDF_BYTES = 4 * 1024 * 1024;

/** URL del visor/descarga de un PDF (siempre pasa por el servidor con sesión). */
export function pdfUrlFor(projectId: string, versionId?: string, opts?: { download?: boolean }) {
  const params = new URLSearchParams();
  if (versionId) params.set("v", versionId);
  if (opts?.download) params.set("download", "1");
  const q = params.toString();
  return `/api/pdf/${encodeURIComponent(projectId)}${q ? `?${q}` : ""}`;
}
