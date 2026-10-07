// app/actions/users.ts — gestión de cuentas administrativas (solo superadmin).
"use server";

import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { requireAdmin, requireSuperadmin, AuthError } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "superadmin";
  uid?: string;
  addedAt: string;
  addedBy: string;
  isActive: boolean;
  lastSignIn?: string | null;
};

type Result = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(err: unknown, fallback: string): Result {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  console.error(fallback, err);
  return { ok: false, error: fallback };
}

function validatePassword(p: string) {
  if (p.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return null;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  try {
    await requireSuperadmin();
    const snapshot = await adminDb.collection("admins").orderBy("addedAt", "desc").get();
    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        email: data.email as string,
        displayName: (data.displayName as string) || (data.email as string),
        role: data.role === "superadmin" ? "superadmin" : "admin",
        uid: (data.uid as string) || undefined,
        addedAt: data.addedAt as string,
        addedBy: (data.addedBy as string) || "",
        isActive: data.isActive !== false,
      } satisfies AdminUser;
    });
    // Último inicio de sesión desde Firebase Auth (informativo).
    const uids = users.filter((u) => u.uid).map((u) => ({ uid: u.uid! }));
    if (uids.length) {
      const res = await adminAuth.getUsers(uids);
      const byUid = new Map(res.users.map((u) => [u.uid, u.metadata.lastSignInTime]));
      return users.map((u) => ({ ...u, lastSignIn: u.uid ? byUid.get(u.uid) ?? null : null }));
    }
    return users;
  } catch (err) {
    if (!(err instanceof AuthError)) console.error("Error obteniendo administradores:", err);
    return [];
  }
}

/** Crea la cuenta en Firebase Auth (desde el servidor) y la registra como admin. */
export async function addAdminUser(input: {
  email: string;
  displayName: string;
  password: string;
  role?: "admin" | "superadmin";
}): Promise<Result> {
  try {
    const me = await requireSuperadmin();
    const email = input.email.toLowerCase().trim();
    if (!EMAIL_RE.test(email)) return { ok: false, error: "El correo no es válido." };
    const pwdError = validatePassword(input.password);
    if (pwdError) return { ok: false, error: pwdError };

    const existing = await adminDb.collection("admins").where("email", "==", email).get();
    if (!existing.empty) return { ok: false, error: "Este correo ya es administrador." };

    let uid: string;
    try {
      const user = await adminAuth.createUser({
        email,
        password: input.password,
        displayName: input.displayName.trim() || undefined,
      });
      uid = user.uid;
    } catch (e: any) {
      if (e?.code === "auth/email-already-exists") {
        return {
          ok: false,
          error: "Ese correo ya tiene una cuenta. Pide a la persona que use otra o restablece su contraseña desde Firebase.",
        };
      }
      throw e;
    }

    await adminDb.collection("admins").add({
      email,
      displayName: input.displayName.trim() || email.split("@")[0],
      role: input.role === "superadmin" ? "superadmin" : "admin",
      uid,
      addedAt: new Date().toISOString(),
      addedBy: me.email ?? me.uid,
      isActive: true,
    });

    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo crear el administrador.");
  }
}

async function guardSelf(id: string, myUid: string, action: string): Promise<string | null> {
  const doc = await adminDb.collection("admins").doc(id).get();
  if (!doc.exists) return "Administrador no encontrado.";
  if (doc.data()!.uid === myUid) return `No puedes ${action} tu propia cuenta.`;
  return null;
}

async function revokeSessions(id: string) {
  const doc = await adminDb.collection("admins").doc(id).get();
  const uid = doc.data()?.uid as string | undefined;
  if (uid) await adminAuth.revokeRefreshTokens(uid).catch(() => {});
}

export async function removeAdminUser(id: string): Promise<Result> {
  try {
    const me = await requireSuperadmin();
    const blocked = await guardSelf(id, me.uid, "eliminar");
    if (blocked) return { ok: false, error: blocked };
    await revokeSessions(id);
    await adminDb.collection("admins").doc(id).delete();
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo eliminar el administrador.");
  }
}

export async function toggleAdminStatus(id: string, isActive: boolean): Promise<Result> {
  try {
    const me = await requireSuperadmin();
    const blocked = await guardSelf(id, me.uid, "desactivar");
    if (blocked && !isActive) return { ok: false, error: blocked };
    if (!isActive) await revokeSessions(id);
    await adminDb.collection("admins").doc(id).update({ isActive });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo actualizar el estado.");
  }
}

export async function updateAdminUser(
  id: string,
  data: { displayName?: string; email?: string; password?: string; role?: "admin" | "superadmin" },
): Promise<Result> {
  try {
    const me = await requireSuperadmin();
    const docRef = adminDb.collection("admins").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return { ok: false, error: "Administrador no encontrado." };
    const current = doc.data()!;
    const isSelf = current.uid === me.uid;

    const updates: Record<string, unknown> = {};
    const authUpdates: { email?: string; password?: string; displayName?: string } = {};

    if (data.displayName?.trim()) {
      updates.displayName = data.displayName.trim();
      authUpdates.displayName = data.displayName.trim();
    }
    if (data.email?.trim()) {
      const newEmail = data.email.toLowerCase().trim();
      if (!EMAIL_RE.test(newEmail)) return { ok: false, error: "El correo no es válido." };
      if (newEmail !== current.email) {
        updates.email = newEmail;
        authUpdates.email = newEmail;
      }
    }
    if (data.password?.trim()) {
      const pwdError = validatePassword(data.password.trim());
      if (pwdError) return { ok: false, error: pwdError };
      authUpdates.password = data.password.trim();
    }
    if (data.role && data.role !== (current.role ?? "admin")) {
      if (isSelf) return { ok: false, error: "No puedes cambiar tu propio rol." };
      updates.role = data.role;
    }

    let uid = current.uid as string | undefined;
    if (Object.keys(authUpdates).length) {
      if (!uid) {
        try {
          uid = (await adminAuth.getUserByEmail(current.email)).uid;
          updates.uid = uid;
        } catch {
          return { ok: false, error: "No se encontró la cuenta en Firebase Auth." };
        }
      }
      await adminAuth.updateUser(uid, authUpdates);
      if (authUpdates.password && !isSelf) await adminAuth.revokeRefreshTokens(uid).catch(() => {});
    }
    if (Object.keys(updates).length) await docRef.update(updates);

    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo actualizar el administrador.");
  }
}

/** Cambio de contraseña propio (cualquier admin). */
export async function changeOwnPassword(newPassword: string): Promise<Result> {
  try {
    const me = await requireAdmin();
    const pwdError = validatePassword(newPassword.trim());
    if (pwdError) return { ok: false, error: pwdError };
    await adminAuth.updateUser(me.uid, { password: newPassword.trim() });
    return { ok: true };
  } catch (err) {
    return fail(err, "No se pudo cambiar la contraseña.");
  }
}
