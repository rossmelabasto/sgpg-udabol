// Guarda `pdfPath` (ruta en Storage) en los proyectos y versiones que solo
// tenían `pdfUrl`/`url` (URLs firmadas que caducan al año). La app ya sabe
// leer ambas formas; esto solo deja los datos limpios.
// Uso: node --env-file=.env scripts/migrar-pdfpath.mjs [--aplicar]
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initAdmin, APPLY } from "./_firebase.mjs";

initAdmin();
const db = getFirestore();

function pathFromUrl(url) {
  try {
    const m = decodeURIComponent(new URL(url).pathname).match(/\/(projects\/.+)$/);
    return m ? m[1] : null;
  } catch { return null; }
}

let n = 0;
for (const d of (await db.collection("projects").get()).docs) {
  const x = d.data();
  if (!x.pdfPath && x.pdfUrl) {
    const p = pathFromUrl(x.pdfUrl);
    if (p) { n++; console.log(APPLY ? "→" : "(simulación)", d.id, p); if (APPLY) await d.ref.update({ pdfPath: p, pdfUrl: FieldValue.delete() }); }
  }
  for (const v of (await d.ref.collection("pdfHistory").get()).docs) {
    const y = v.data();
    if (!y.path && y.url) {
      const p = pathFromUrl(y.url);
      if (p) { n++; console.log(APPLY ? "→" : "(simulación)", d.id, "versión", v.id, p); if (APPLY) await v.ref.update({ path: p, url: FieldValue.delete() }); }
    }
  }
}
console.log(n, "registro(s)", APPLY ? "migrados" : "por migrar");
process.exit(0);
