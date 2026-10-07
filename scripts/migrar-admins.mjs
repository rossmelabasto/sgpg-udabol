// Migra las cuentas administrativas al nuevo esquema de roles.
//
// Antes, CUALQUIER cuenta de Firebase Auth con contraseña entraba como admin.
// Ahora solo entran las que están activas en la colección `admins`, con rol
// "admin" o "superadmin". Este script deja el estado inicial:
//   - admin@udabol.edu.bo  -> admin (cuenta compartida con la jefatura)
//   - test@udabol.edu.bo   -> desactivada (cuenta de prueba antigua)
//   - SUPERADMIN_EMAIL     -> superadmin (se crea la cuenta si no existe; la
//                             contraseña temporal se escribe en el archivo
//                             indicado por SUPERADMIN_PASSWORD_FILE, nunca en consola)
//
// Uso:
//   SUPERADMIN_EMAIL=tu@correo SUPERADMIN_PASSWORD_FILE=~/ruta/segura.txt \
//     node --env-file=.env scripts/migrar-admins.mjs            (simulación)
//   ... node --env-file=.env scripts/migrar-admins.mjs --aplicar (aplica)
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin, APPLY } from "./_firebase.mjs";

initAdmin();
const auth = getAuth();
const db = getFirestore();
const admins = db.collection("admins");
const now = new Date().toISOString();

const SUPER = (process.env.SUPERADMIN_EMAIL || "").toLowerCase().trim();
const PWD_FILE = process.env.SUPERADMIN_PASSWORD_FILE;

async function findAdmin(email) {
  const s = await admins.where("email", "==", email).limit(1).get();
  return s.empty ? null : s.docs[0];
}
async function authUser(email) {
  try { return await auth.getUserByEmail(email); } catch { return null; }
}

const plan = [];

// 1) Cuenta compartida actual -> admin
{
  const email = "admin@udabol.edu.bo";
  const u = await authUser(email);
  const doc = await findAdmin(email);
  if (u && !doc) plan.push({ desc: `Agregar ${email} como admin`, run: () => admins.add({ email, displayName: "Administración (cuenta compartida)", role: "admin", uid: u.uid, addedAt: now, addedBy: "migracion", isActive: true }) });
  else if (doc && doc.data().role !== "admin" && doc.data().role !== "superadmin") plan.push({ desc: `Marcar ${email} con rol admin`, run: () => doc.ref.update({ role: "admin" }) });
}

// 2) Cuenta de prueba antigua -> desactivada
{
  const doc = await findAdmin("test@udabol.edu.bo");
  if (doc && doc.data().isActive !== false) plan.push({ desc: "Desactivar test@udabol.edu.bo (prueba antigua)", run: () => doc.ref.update({ isActive: false }) });
}

// 3) Superadmin
if (SUPER) {
  let u = await authUser(SUPER);
  const doc = await findAdmin(SUPER);
  if (!u) {
    if (!PWD_FILE) { console.error("Para crear la cuenta del superadmin define SUPERADMIN_PASSWORD_FILE."); process.exit(1); }
    plan.push({ desc: `Crear cuenta ${SUPER} (contraseña temporal en ${PWD_FILE})`, run: async () => {
      if (existsSync(PWD_FILE)) throw new Error(`${PWD_FILE} ya existe; no lo sobrescribo.`);
      const password = randomBytes(12).toString("base64url");
      u = await auth.createUser({ email: SUPER, password, displayName: "Superadministrador" });
      writeFileSync(PWD_FILE, `SGPG superadmin\nemail: ${SUPER}\ncontraseña temporal: ${password}\n(cámbiala desde la app: menú de usuario > Cambiar contraseña)\n`, { mode: 0o600 });
    } });
  }
  if (!doc) plan.push({ desc: `Registrar ${SUPER} como superadmin`, run: async () => admins.add({ email: SUPER, displayName: "Superadministrador", role: "superadmin", uid: (u ?? await authUser(SUPER))?.uid ?? null, addedAt: now, addedBy: "migracion", isActive: true }) });
  else if (doc.data().role !== "superadmin") plan.push({ desc: `Subir ${SUPER} a superadmin`, run: () => doc.ref.update({ role: "superadmin", isActive: true }) });
}

// 4) Admins sin rol explícito -> admin
for (const d of (await admins.get()).docs) {
  if (!d.data().role) plan.push({ desc: `Rol explícito "admin" para ${d.data().email}`, run: () => d.ref.update({ role: "admin" }) });
}

if (!plan.length) console.log("Nada que migrar.");
for (const step of plan) {
  console.log(APPLY ? "→" : "(simulación)", step.desc);
  if (APPLY) await step.run();
}
process.exit(0);
