// Copia el worker de pdf.js a public/ para que siempre coincida con la versión
// instalada de pdfjs-dist (si no coinciden, el visor falla con "API version").
import { copyFileSync, existsSync } from "node:fs";
const src = "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";
if (existsSync(src)) copyFileSync(src, "public/pdf.worker.min.mjs");
