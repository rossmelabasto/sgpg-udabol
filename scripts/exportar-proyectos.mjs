// Exporta los proyectos (sin PDFs ni historial) a un JSON, por ejemplo para
// probar en los emuladores con datos reales sin tocar producción.
// Uso: node --env-file=.env scripts/exportar-proyectos.mjs salida.json
import { writeFileSync } from "node:fs";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "./_firebase.mjs";

const out = process.argv[2];
if (!out) { console.error("Indica el archivo de salida."); process.exit(1); }
initAdmin();
const snap = await getFirestore().collection("projects").get();
const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(rows.length, "proyectos exportados a", out);
process.exit(0);
