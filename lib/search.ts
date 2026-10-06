// lib/search.ts — búsqueda en memoria sobre los proyectos (pura, sin Firebase).
//
// Reglas:
// - Se ignoran tildes, mayúsculas, signos y palabras vacías ("de", "la", ...).
// - TODAS las palabras significativas de la consulta deben aparecer en el
//   proyecto (como palabra, prefijo o con un error de tipeo). Así "redes
//   neuronales" no devuelve cualquier proyecto que diga "redes".
// - El puntaje premia coincidencias en título > tags > alumno > resumen y la
//   frase exacta; los resultados se ordenan por puntaje.
import type { SearchResult, ThesisProject } from "@/lib/projects";

export function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const STOPWORDS = new Set([
  "de", "del", "el", "la", "los", "las", "un", "una", "unos", "unas",
  "en", "con", "por", "para", "que", "y", "e", "o", "u", "a", "al",
  "es", "son", "se", "su", "sus", "lo", "le", "como", "mas", "este",
  "esta", "estos", "estas", "entre", "cada", "todo", "todos", "sobre",
  "sin", "ha", "han", "ser", "fue", "mediante", "basado", "basada",
  "the", "of", "and", "in", "to", "is", "for", "with", "on", "an",
]);

export function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

export function significantTokens(query: string): string[] {
  return [...new Set(tokenize(query).filter((t) => t.length >= 2 && !STOPWORDS.has(t)))];
}

/** Distancia de Levenshtein con corte temprano (devuelve max+1 si se pasa). */
export function levenshtein(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur[j - 1], prev[j - 1]);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

type Field = { words: string[]; text: string; weight: number };

/** Qué tan bien aparece un token en un campo: 1 exacto, 0.7 prefijo, 0.5 con tipeo, 0 nada. */
function tokenMatch(token: string, field: Field): number {
  let best = 0;
  for (const w of field.words) {
    if (w === token) return 1;
    if (token.length >= 3 && w.startsWith(token)) best = Math.max(best, 0.7);
    else if (token.length >= 5 && w.length >= 4 && levenshtein(token, w, 1) <= 1) best = Math.max(best, 0.5);
  }
  return best;
}

export type SearchFilters = {
  career?: string;
  yearFrom?: number;
  yearTo?: number;
  tag?: string;
};

export function applyFilters<T extends ThesisProject>(projects: T[], f: SearchFilters = {}): T[] {
  const tag = f.tag ? normalize(f.tag) : "";
  return projects.filter(
    (p) =>
      (!f.career || p.career === f.career) &&
      (f.yearFrom === undefined || Number(p.year) >= f.yearFrom) &&
      (f.yearTo === undefined || Number(p.year) <= f.yearTo) &&
      (!tag || (p.tags ?? []).some((t) => normalize(t) === tag)),
  );
}

export function scoreProject(project: ThesisProject, query: string): number {
  const tokens = significantTokens(query);
  if (tokens.length === 0) return 0;
  const mk = (s: string, weight: number): Field => {
    const text = normalize(s);
    return { text, words: text.split(" ").filter(Boolean), weight };
  };
  const fields: Field[] = [
    mk(project.title, 10),
    mk((project.tags ?? []).join(" "), 6),
    mk(project.studentName, 5),
    mk(project.career, 2),
    mk(project.abstract || "", 2),
  ];

  let score = 0;
  for (const token of tokens) {
    let best = 0;
    for (const f of fields) best = Math.max(best, tokenMatch(token, f) * f.weight);
    if (best === 0) return 0; // falta una palabra: no es resultado
    score += best;
  }

  // Bonus por la frase completa (en el orden escrito).
  const phrase = normalize(query);
  if (phrase.includes(" ")) {
    if (fields[0].text.includes(phrase)) score += 15;
    else if (fields.some((f) => f.text.includes(phrase))) score += 6;
  }
  return Math.round(score * 10) / 10;
}

export function searchInMemory<T extends ThesisProject>(
  projects: T[],
  query: string,
  filters: SearchFilters = {},
): (T & SearchResult)[] {
  const filtered = applyFilters(projects, filters);
  if (significantTokens(query).length === 0) return filtered.map((p) => ({ ...p, score: 0 }));
  return filtered
    .map((p) => ({ ...p, score: scoreProject(p, query) }))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.year) - Number(a.year));
}

/** Clave para detectar títulos duplicados o casi iguales. */
export function titleKey(title: string): string {
  return significantTokens(title).join(" ");
}

/** Similitud de Jaccard entre conjuntos de palabras significativas (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const A = new Set(significantTokens(a));
  const B = new Set(significantTokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
