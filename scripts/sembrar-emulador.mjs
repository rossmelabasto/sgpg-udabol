// Siembra los emuladores de Firebase con cuentas y proyectos de prueba.
//
//   pnpm emuladores          (en otra terminal)
//   pnpm sembrar             (cuentas + 14 proyectos ficticios + 1 con 3 versiones de PDF)
//   pnpm sembrar -- --json ruta/proyectos.json   (además importa proyectos exportados)
//
// Cuentas (solo existen en el emulador):
//   superadmin@sgpg.test / prueba-super-123   (superadmin)
//   admin@sgpg.test      / prueba-admin-123   (admin)
//   inactivo@sgpg.test   / prueba-inact-123   (admin desactivado: no debe poder entrar)
//   intruso@sgpg.test    / prueba-intru-123   (cuenta sin registro en `admins`)
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error("Este script solo corre contra los emuladores (usa `pnpm sembrar`).");
  process.exit(1);
}
const projectId = process.env.FIREBASE_PROJECT_ID || "demo-sgpg";
initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const auth = getAuth();
const db = getFirestore();
const bucket = getStorage().bucket();
const now = Date.now();
const iso = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString();

const cuentas = [
  { email: "superadmin@sgpg.test", password: "prueba-super-123", name: "Superadmin de prueba", role: "superadmin", isActive: true },
  { email: "admin@sgpg.test", password: "prueba-admin-123", name: "Jefatura (prueba)", role: "admin", isActive: true },
  { email: "inactivo@sgpg.test", password: "prueba-inact-123", name: "Admin desactivado", role: "admin", isActive: false },
  { email: "intruso@sgpg.test", password: "prueba-intru-123", name: null },
];
for (const c of cuentas) {
  let u;
  try { u = await auth.getUserByEmail(c.email); } catch { u = await auth.createUser({ email: c.email, password: c.password, displayName: c.name ?? undefined }); }
  if (c.role) {
    const ex = await db.collection("admins").where("email", "==", c.email).get();
    if (ex.empty) await db.collection("admins").add({ email: c.email, displayName: c.name, role: c.role, uid: u.uid, addedAt: iso(5000), addedBy: "semilla", isActive: c.isActive });
  }
}

const ficticios = [
  ["Sistema web de gestión de citas para el Hospital Viedma", "Ana Lucía Prueba Torrez", "Ingeniería en Sistemas", 2025, ["gestión de citas", "aplicación web", "salud", "hospital"]],
  ["Aplicación móvil con realidad aumentada para el Parque Cretácico", "Diego Prueba Rocha", "Ingeniería en Sistemas", 2026, ["realidad aumentada", "aplicación móvil", "turismo", "dinosaurios"]],
  ["Red neuronal convolucional para detectar enfermedades en hojas de papa", "Carla Prueba Mendoza", "Ingeniería en Sistemas", 2026, ["redes neuronales", "visión artificial", "agricultura", "papa"]],
  ["Chatbot con PLN para la atención de estudiantes de la UDABOL", "Luis Prueba Vargas", "Ingeniería en Sistemas", 2025, ["chatbot", "PLN", "inteligencia artificial", "atención al estudiante"]],
  ["Sistema IoT de monitoreo de temperatura en cámaras de frío", "María Prueba Quispe", "Ingeniería en Sistemas", 2024, ["IoT", "monitoreo", "temperatura", "cadena de frío"]],
  ["Diseño de una red FTTH con tecnología GPON para Sacaba", "Jorge Prueba Flores", "Ingeniería en Telecomunicaciones", 2026, ["FTTH", "GPON", "fibra óptica", "Sacaba"]],
  ["Infraestructura de red WISP para comunidades rurales de Tiraque", "Paola Prueba Arce", "Ingeniería en Telecomunicaciones", 2025, ["WISP", "conectividad rural", "enlaces inalámbricos", "Tiraque"]],
  ["Cableado estructurado y red LAN para una clínica en Quillacollo", "Rubén Prueba Soto", "Ingeniería en Telecomunicaciones", 2024, ["cableado estructurado", "LAN", "clínica", "Quillacollo"]],
  ["Diseño de trayectoria tipo J para el pozo Sirari X2", "Gabriela Prueba Rojas", "Ingeniería Petrolera", 2025, ["perforación direccional", "trayectoria J", "pozo", "Sirari"]],
  ["Levantamiento artificial por gas lift en el campo Bulo Bulo", "Henry Prueba Mamani", "Ingeniería Petrolera", 2024, ["gas lift", "levantamiento artificial", "producción", "Bulo Bulo"]],
  ["Recuperación mejorada mediante inyección de vapor en crudo pesado", "Silvia Prueba Choque", "Ingeniería Petrolera", 2026, ["recuperación mejorada", "inyección de vapor", "crudo pesado"]],
  ["Selección de fluido de perforación para la formación Huamampampa", "Óscar Prueba Gutiérrez", "Ingeniería Petrolera", 2025, ["fluido de perforación", "lodos", "Huamampampa"]],
  ["Estimación de costos para construcción en drywall", "Álvaro Prueba Lima", "Ingeniería Civil", 2025, ["costos", "drywall", "construcción"]],
  ["Sistema de recomendación de libros basado en emociones", "Oriana Prueba Castro", "Ingeniería en Sistemas", 2026, ["sistema de recomendación", "emociones", "libros", "machine learning"]],
];

async function addProject(p, minutesAgo, extra = {}) {
  const ref = await db.collection("projects").add({
    title: p[0], studentName: p[1], career: p[2], year: p[3], tags: p[4], abstract: extra.abstract ?? "",
    pdfPath: null, pdfVersion: 0, createdAt: iso(minutesAgo), updatedAt: iso(minutesAgo),
    createdBy: "semilla", deleted: false, deletedAt: null, ...extra,
  });
  await ref.collection("history").add({ projectId: ref.id, action: "CREATE", details: "Proyecto creado (semilla)", timestamp: iso(minutesAgo), userRole: "admin", actorName: "Semilla", actorEmail: "semilla" });
  return ref;
}

if ((await db.collection("projects").limit(1).get()).empty) {
  for (const [i, p] of ficticios.entries()) await addProject(p, 3000 - i * 30);

  // Un proyecto con 3 versiones de PDF (v1 y v2 en el historial, v3 vigente).
  const files = ["01-inventarios-v1.pdf", "02-inventarios-v2.pdf", "03-inventarios-v3-final.pdf"];
  const paths = [];
  for (const f of files) {
    const path = `projects/semilla-${f}`;
    await bucket.file(path).save(readFileSync(new URL(`./fixtures/${f}`, import.meta.url)), { contentType: "application/pdf", resumable: false });
    paths.push(path);
  }
  const ref = await addProject(
    ["Sistema web de control de inventarios con predicción de demanda mediante aprendizaje automático para la distribuidora El Prado", "Lucía Fernanda Prueba Rojas", "Ingeniería en Sistemas", 2026, ["inventarios", "predicción de demanda", "aprendizaje automático", "Random Forest"]],
    200,
    { pdfPath: paths[2], pdfFileName: files[2], pdfVersion: 3, pdfUploadedAt: iso(60), abstract: "El presente proyecto desarrolla un sistema web de control de inventarios con predicción de demanda mediante aprendizaje automático para la distribuidora El Prado de Cochabamba." },
  );
  await ref.collection("pdfHistory").add({ path: paths[0], version: 1, fileName: files[0], uploadedAt: iso(200), replacedAt: iso(120) });
  await ref.collection("pdfHistory").add({ path: paths[1], version: 2, fileName: files[1], uploadedAt: iso(120), replacedAt: iso(60) });
  console.log("Proyectos ficticios sembrados.");
}

const jsonArg = process.argv.indexOf("--json");
if (jsonArg > -1) {
  const rows = JSON.parse(readFileSync(process.argv[jsonArg + 1], "utf8"));
  const batch = db.batch();
  for (const r of rows) {
    const { id, ...data } = r;
    batch.set(db.collection("projects").doc(id), { ...data, pdfPath: null, pdfUrl: null });
  }
  await batch.commit();
  console.log(rows.length, "proyectos importados desde", process.argv[jsonArg + 1], "(sin PDFs)");
}
console.log("Listo. Cuentas de prueba en el encabezado de este script.");
process.exit(0);
