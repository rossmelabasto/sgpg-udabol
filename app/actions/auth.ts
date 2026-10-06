// app/actions/auth.ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/projects";
import { adminAuth } from "@/lib/firebase/admin";
import {
  SESSION_COOKIE,
  SESSION_MAX_DAYS,
  findAdminRecord,
  getSession,
} from "@/lib/auth";

export async function isLoggedIn() {
  return (await getSession()) !== null;
}

export async function getUserRole(): Promise<UserRole> {
  return (await getSession())?.role ?? "anonymous";
}

/** Datos públicos de la sesión para mostrar en la interfaz. */
export async function getSessionInfo() {
  const s = await getSession();
  return s ? { role: s.role, email: s.email, name: s.name } : null;
}

/**
 * Crea la sesión a partir del idToken de Firebase. El rol NO lo manda el
 * cliente: invitado si el token es anónimo; admin/superadmin solo si la
 * cuenta está activa en la colección `admins`.
 */
export async function loginAction({ idToken }: { idToken: string }) {
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken, true);
  } catch {
    return { success: false as const, error: "No se pudo verificar el inicio de sesión." };
  }

  const anonymous = decoded.firebase?.sign_in_provider === "anonymous";
  if (!anonymous) {
    const admin = await findAdminRecord(decoded.uid, decoded.email ?? null);
    if (!admin) {
      return {
        success: false as const,
        error: "Esta cuenta no tiene acceso de administrador o está desactivada.",
      };
    }
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_DAYS * 24 * 60 * 60 * 1000,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_DAYS * 24 * 60 * 60,
  });

  return { success: true as const };
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/ingresar");
}
