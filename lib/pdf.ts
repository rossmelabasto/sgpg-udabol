export type PdfExtraction = {
  title: string;
  studentName: string;
  career: string;
  year: string;
  abstract: string;
  keywords: string[];
  /** true si el PDF casi no tiene texto (probablemente escaneado). */
  scanned: boolean;
  /** true si los datos vinieron de la IA (Groq); false si solo heurística. */
  aiUsed: boolean;
};

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractYear(text: string) {
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? "";
}

export function extractKeywords(text: string): string[] {
  if (!text || text.trim().length < 30) return [];

  const stopwords = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del",
    "en", "con", "por", "para", "que", "es", "son", "se", "su", "al",
    "como", "más", "este", "esta", "entre", "cada", "todo", "todos",
    "fue", "han", "ha", "ser", "tiene", "tienen", "sus", "lo", "le",
    "del", "así", "muy", "sin", "sobre", "también", "desde", "hasta",
    "donde", "cuando", "durante", "pero", "o", "y", "e", "a",
    "the", "of", "and", "in", "to", "a", "is", "for", "with", "on",
    "this", "that", "are", "be", "was", "were", "it", "its", "an",
  ]);

  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-záéíóúñ0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(/\s+/).filter((w) => {
    return w.length >= 4 && !stopwords.has(w) && !/^\d+$/.test(w);
  });

  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([word]) => word);

  return sorted;
}

function inferCareer(text: string) {
  // 1) Buscar el patrón explícito "CARRERA DE <nombre>" (más fiable que
  //    buscar palabras sueltas como "sistemas", que aparecen en el texto
  //    de cualquier proyecto — ej. "...sistemas de control SCADA...").
  const careerMatch = text.match(
    /CARRERA\s+DE\s+(INGENIER[IÍ]A\s+(?:DE\s+)?SISTEMAS|INGENIER[IÍ]A\s+EN\s+TELECOMUNICACIONES|INGENIER[IÍ]A\s+PETROLERA)/i,
  );
  if (careerMatch) {
    const c = careerMatch[1].toLowerCase();
    if (c.includes("telecom")) return "Ingeniería en Telecomunicaciones";
    if (c.includes("petrol")) return "Ingeniería Petrolera";
    return "Ingeniería en Sistemas";
  }
  // 2) Fallback por palabra clave (petrol/telecom primero; "sistemas" es genérica)
  const lower = text.toLowerCase();
  if (lower.includes("petrol")) return "Ingeniería Petrolera";
  if (lower.includes("telecom")) return "Ingeniería en Telecomunicaciones";
  if (lower.includes("sistemas")) return "Ingeniería en Sistemas";
  if (/ingenier[ií]a\s+civil/.test(lower)) return "Ingeniería Civil";
  return "";
}

/**
 * Detecta si una página parece ser de tabla de contenidos/índice (TOC).
 */
function isLikelyTocPage(pageText: string): boolean {
  const items = pageText.split(/\s+/).filter(Boolean);
  if (items.length < 15) return false;

  const singleDots = items.filter((item) => item === ".").length;
  const sectionNums = (pageText.match(/\b\d+\.\d+\b/g) || []).length;

  if ((singleDots > 8 && sectionNums >= 2) || singleDots > 15) return true;

  const alphaChars = pageText.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ]/g, "").length;
  const totalChars = pageText.replace(/\s/g, "").length;
  if (totalChars > 80 && alphaChars / totalChars < 0.35) return true;

  return false;
}

/**
 * Marcadores de sección que vienen DESPUÉS del resumen/introducción.
 * Usamos estos para saber dónde termina el bloque del resumen.
 */
const NEXT_SECTION_MARKERS = [
  // OJO: los marcadores van anclados a números de sección ("1.1 Antecedentes",
  // "1.2 Presentación", etc.) para NO confundir palabras sueltas dentro del
  // texto del resumen (ej. "...los antecedentes investigativos..." no debe
  // cortar el resumen en "antecedentes").
  /\b\d{1,2}(?:\.\d{1,2})*\.?\s*ANTECEDENTES\b/i,
  /\b\d{1,2}(?:\.\d{1,2})*\.?\s*PRESENTACI[ÓO]N(?:\s+DEL\s+TEMA(?:\s+Y\s+SU\s+IMPORTANCIA)?)?\b/i,
  /\b\d{1,2}(?:\.\d{1,2})*\.?\s*PLANTEAMIENTO(?:\s+DEL\s+PROBLEMA)?\b/i,
  /\b\d{1,2}(?:\.\d{1,2})*\.?\s*FORMULACI[ÓO]N(?:\s+DEL\s+PROBLEMA)?\b/i,
  /\b\d{1,2}(?:\.\d{1,2})*\.?\s*OBJETIVOS?(?:\s+(?:GENERAL|ESPEC[ÍI]FICOS?))?\b/i,
  /\b\d{1,2}(?:\.\d{1,2})*\.?\s*JUSTIFICACI[ÓO]N\b/i,
  /\b\d{1,2}(?:\.\d{1,2})*\.?\s*ALCANCE(?:\s+Y\s+LIMITACIONES)?\b/i,
  /\bCAP[ÍI]TULO\s+(?:I{1,3}|IV|V|VI|1|2)\b/i,
  /\b(?:PALABRAS\s+CLAVE|KEYWORDS)\b/i,
];

/**
 * Extrae el contenido real del resumen/introducción usando un enfoque
 * posicional: encuentra el heading "RESUMEN", "ABSTRACT" o "INTRODUCCIÓN",
 * busca el siguiente marcador de sección y extrae solo lo que hay en medio.
 *
 * IMPORTANTE: si la sección existe como subtítulo pero está VACÍA (sin
 * contenido real, es decir menos de 80 caracteres o solo el nombre de la
 * siguiente sección), devuelve string vacío. Así un documento sin
 * introducción deja el campo del resumen en blanco en lugar de arrastrar
 * el texto de "ANTECEDENTES" u otra sección posterior.
 */
function extractAbstractContent(text: string): string {
  const abstractHeadings = [
    // 1) RESUMEN (el ideal)
    /\bRESUMEN\s*(?:EJECUTIVO)?\b/i,
    // 2) ABSTRACT (inglés)
    /\bABSTRACT\b/i,
    // 3) INTRODUCCIÓN (fallback si no hay sección RESUMEN)
    /\b(?:CAP[ÍI]TULO\s+(?:I{1,3}|IV|V|VI|1)\s*[:.\-]\s*)?INTRODUCCI[ÓO]N\b/i,
  ];

  for (const heading of abstractHeadings) {
    const headingMatch = text.match(heading);
    if (!headingMatch) continue;

    const headingEnd = headingMatch.index! + headingMatch[0].length;

    // Buscar el siguiente marcador de sección después del heading
    let closestEnd = text.length;
    for (const marker of NEXT_SECTION_MARKERS) {
      const markerMatch = text.slice(headingEnd).match(marker);
      if (markerMatch) {
        const candidatePos = headingEnd + markerMatch.index!;
        if (candidatePos < closestEnd) {
          closestEnd = candidatePos;
        }
      }
    }

    const rawContent = text.slice(headingEnd, closestEnd).trim();

    // Si es muy corto, probablemente está vacío (solo el heading)
    if (rawContent.length < 80) continue;

    // Si arranca con el nombre de la siguiente sección, no es contenido real
    const startsWithSection = NEXT_SECTION_MARKERS.some((m) =>
      rawContent.match(new RegExp(`^${m.source}`, "i")),
    );
    if (startsWithSection) continue;

    // Si contiene demasiados patrones de índice (números de sección, puntos, etc.)
    const sectionPatternCount = (
      rawContent.match(/\b\d+\.\d+\b/g) || []
    ).length;
    const hasTocDots = /\.{4,}/.test(rawContent);
    if (sectionPatternCount > 3 || hasTocDots) continue;

    // ¡Encontramos contenido real de resumen!
    return rawContent.length > 1000
      ? rawContent.substring(0, 1000) + "..."
      : rawContent;
  }

  return "";
}

/**
 * Nombres de carrera conocidos para anclar el regex de título.
 * El título aparece justo DESPUÉS de "CARRERA DE <carrera>" y ANTES de
 * "EXAMEN DE GRADO" / "PROYECTO DE GRADO" / etc.
 */
const CARRERA_NAMES = [
  "INGENIER[IÍ]A\\s+(?:DE\\s+)?SISTEMAS",
  "INGENIER[IÍ]A\\s+EN\\s+TELECOMUNICACIONES",
  "INGENIER[IÍ]A\\s+PETROLERA",
  "INGENIER[IÍ]A\\s+COMERCIAL",
  "ADMINISTRACI[OÓ]N\\s+DE\\s+EMPRESAS",
  "CONTADUR[IÍ]A\\s+P[UÚ]BLICA",
  "DERECHO",
  "MEDICINA",
  "ODONTOLOG[IÍ]A",
  "ARQUITECTURA",
  "PSICOLOG[IÍ]A",
  "COMUNICACI[OÓ]N\\s+SOCIAL",
  "ENFERMER[IÍ]A",
  "BIOQU[IÍ]MICA",
];

function extractTitleFallback(text: string): string {
  const titleRegex = new RegExp(
    `CARRERA\\s+DE\\s+(?:${CARRERA_NAMES.join("|")})\\s+([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\\s,.:;]{20,300}?)\\s+(?:EXAMEN\\s+DE\\s+GRADO|PROYECTO\\s+DE\\s+GRADO|TESIS\\s+DE\\s+GRADO|TRABAJO\\s+DIRIGIDO|MEMORIA|MONOGRAF[IÍ]A)`,
    "i",
  );
  const match = text.match(titleRegex);
  if (match) return match[1].trim();

  const genericMatch = text.match(
    /(?:titulo|title|proyecto|tesis)\s*[:\-]\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑa-záéíóúñ\s0-9,\.]{10,180})/i,
  );
  return (genericMatch?.[1] || "").trim();
}

function extractStudentFallback(text: string): string {
  const studentRegex =
    /(?:postulante|alumno|autor|student|author)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]{5,80}?)(?=\s+(?:COCHABAMBA|LA PAZ|SANTA CRUZ|BOLIVIA|TUTOR|DOCENTE|202[0-9]|19[0-9]{2}))/i;
  const match = text.match(studentRegex);
  return (match?.[1] || "").trim();
}

export async function extractPdfData(file: File): Promise<PdfExtraction> {
  if (typeof window === "undefined") {
    throw new Error("PDF extraction must run in the browser.");
  }

  const pdfjsLib: any = await import("pdfjs-dist");

  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  } catch (e) {
    console.warn("Could not set pdfjs workerSrc", e);
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  // --- PASO 1: Extraer texto de cada página por separado ---
  const pageTexts: string[] = [];
  const maxPages = Math.min(pdf.numPages, 20);
  for (let index = 1; index <= maxPages; index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  // --- PASO 2: Filtrar páginas de índice (TOC) ---
  const nonTocPages = pageTexts.filter((pt) => !isLikelyTocPage(pt));
  const textForAnalysis =
    nonTocPages.length > 0
      ? normalizeText(nonTocPages.join(" "))
      : normalizeText(pageTexts.join(" "));

  const fullText = normalizeText(pageTexts.join(" "));

  // --- PASO 3: Resumen/introducción de forma determinista ---
  // Esto garantiza que un documento SIN introducción (sección vacía)
  // deje el campo abstract en blanco, sin arrastrar "ANTECEDENTES".
  const abstract = extractAbstractContent(textForAnalysis);

  // --- PASO 4: Intentar con IA (Groq) para título/autor/carrera/año/keywords ---
  let title = "";
  let studentName = "";
  let career = "";
  let year = "";
  let keywords: string[] = [];

  const scanned = fullText.replace(/\s/g, "").length < 200;
  let aiUsed = false;

  if (!scanned) try {
    const response = await fetch("/api/extract-pdf-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textForAnalysis }),
    });

    if (response.ok) {
      const data = await response.json();
      title = data.title || "";
      studentName = data.studentName || "";
      career = data.career || "";
      year = data.year || "";
      keywords = Array.isArray(data.keywords) ? data.keywords : [];
      aiUsed = true;
    }
  } catch (error) {
    console.warn(
      "Fallo en extracción por IA, cayendo a heurística posicional",
      error,
    );
  }

  // --- PASO 5: Fallback heurístico para los campos que quedaron vacíos ---
  if (!title) title = extractTitleFallback(textForAnalysis);
  if (!studentName) studentName = extractStudentFallback(textForAnalysis);
  if (!career) career = inferCareer(fullText);
  if (!year) year = extractYear(fullText);
  // Tags: extraer del título + resumen combinados (no solo del resumen)
  if (keywords.length === 0) {
    keywords = extractKeywords([title, abstract].filter(Boolean).join(" "));
  }

  return {
    title,
    studentName,
    career,
    year,
    abstract,
    keywords,
    scanned,
    aiUsed,
  };
}
