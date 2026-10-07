// lib/auth.ts — sesión y roles, SOLO del lado del servidor.
//
// La cookie guarda únicamente la session cookie de Firebase (firmada por Google).
// El rol nunca viaja desde el navegador: se calcula aquí a partir de la
// colección `admins` de Firestore. Así, desactivar o quitar un admin le corta
// el acceso en su siguiente petición.
import { cache } from "react";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminRole, type UserRole } from "@/lib/projects";

export { isAdminRole };

export const SESSION_COOKIE = "udabol_session";
export const SESSION_MAX_DAYS = 14;

export type Session = {
  uid: string;
  email: string | null;
  name: string | null;
  role: UserRole;
};

export type AdminRecord = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "superadmin";
  isActive: boolean;
  uid?: string | null;
};

/** Busca el registro de admin activo de un usuario (por uid o, si falta, por email). */
export async function findAdminRecord(uid: string, email: string | null): Promise<AdminRecord | null> {
  const col = adminDb.collection("admins");
  let snap = await col.where("uid", "==", uid).limit(1).get();
  if (snap.empty && email) {
    snap = await col.where("email", "==", email.toLowerCase()).limit(1).get();
    // Vincula el uid la primera vez que entra, para no depender del email.
    if (!snap.empty && !snap.docs[0].data().uid) {
      await snap.docs[0].ref.update({ uid });
    }
  }
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  if (data.isActive === false) return null;
  return {
    id: d.id,
    email: data.email,
    displayName: data.displayName ?? data.email,
    role: data.role === "superadmin" ? "superadmin" : "admin",
    isActive: data.isActive !== false,
    uid: data.uid ?? uid,
  };
}

function readSessionCookieValue(raw: string | undefined): string | null {
  if (!raw) return null;
  // Compatibilidad con el formato anterior "sessionCookie|rol": el sufijo se
  // IGNORA (antes se confiaba en él, que era el agujero de seguridad).
  const pipe = raw.lastIndexOf("|");
  const value = pipe === -1 ? raw : raw.slice(0, pipe);
  return value || null;
}

/** Sesión verificada de la petición actual (memoizada por petición). */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const value = readSessionCookieValue(store.get(SESSION_COOKIE)?.value);
  if (!value) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(value, true);
    const provider = decoded.firebase?.sign_in_provider;
    if (provider === "anonymous") {
      return { uid: decoded.uid, email: null, name: null, role: "anonymous" };
    }
    const admin = await findAdminRecord(decoded.uid, decoded.email ?? null);
    if (!admin) return null; // cuenta sin permiso o desactivada
    return { uid: decoded.uid, email: decoded.email ?? admin.email, name: admin.displayName, role: admin.role };
  } catch {
    return null; // expirada, revocada o inválida
  }
});

export class AuthError extends Error {}

/** Exige cualquier sesión válida (invitado o admin). */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError("Tu sesión expiró. Vuelve a ingresar.");
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s || !isAdminRole(s.role)) throw new AuthError("Solo los administradores pueden hacer esto.");
  return s;
}

export async function requireSuperadmin(): Promise<Session> {
  const s = await getSession();
  if (!s || s.role !== "superadmin") throw new AuthError("Solo el superadministrador puede hacer esto.");
  return s;
}

/** Quién hizo un cambio, para la auditoría. */
export function actorOf(s: Session) {
  return { userRole: s.role, actorUid: s.uid, actorEmail: s.email, actorName: s.name };
}
