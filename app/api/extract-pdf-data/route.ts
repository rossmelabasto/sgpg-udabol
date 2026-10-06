import { NextResponse } from "next/server";
import { getSession, isAdminRole } from "@/lib/auth";

const MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];

function safeJsonParse(content: string): Record<string, unknown> {
  if (!content) return {};
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isAdminRole(session.role)) {
    return NextResponse.json({ error: "Solo los administradores pueden usar la extracción." }, { status: 403 });
  }

  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY no está configurada." },
        { status: 501 },
      );
    }

    // Prompt optimizado para tesis de grado bolivianas (formato UDABOL).
    // El resumen/abstract NO se extrae aquí: se calcula de forma determinista
    // en lib/pdf.ts (extractAbstractContent) para manejar bien el caso de
    // documentos sin introducción (sección vacía).
    const prompt = `Eres un asistente experto en documentos académicos de universidades bolivianas, específicamente tesis y proyectos de grado de la Universidad de Aquino Bolivia (UDABOL).

A continuación se presenta el texto extraído de un proyecto de grado o tesis. Los documentos suelen tener este formato:
- "CARRERA DE INGENIERÍA DE SISTEMAS" (o Telecomunicaciones, o Petrolera)
- "POSTULANTE: Nombre Completo" o "AUTOR: Nombre Completo"
- "EXAMEN DE GRADO", "PROYECTO DE GRADO" o "TESIS DE GRADO"
- Título del proyecto en mayúsculas después de la carrera
- Fechas: "Cochabamba - Bolivia", "Gestión 2024", un año de 4 dígitos

Tu objetivo es extraer los siguientes datos y devolverlos ESTRICTAMENTE en formato JSON, sin texto adicional ni markdown. Corrige errores tipográficos del OCR.

Campos a extraer:
- title: El título completo del proyecto de grado (string). Aparece en mayúsculas después de la carrera, antes de "EXAMEN DE GRADO" / "PROYECTO DE GRADO" / "TESIS DE GRADO". Devuélvelo en formato oración (no todo en mayúsculas): mayúscula inicial, nombres propios y siglas (IoT, FTTH, UDABOL) como corresponde, con tildes. Ej: "Sistema de gestión académica para la Universidad de Aquino Bolivia".
- studentName: El nombre completo del postulante o autor (string). Busca después de "POSTULANTE:", "AUTOR:", "ALUMNO:", "POR:". Devuelve el nombre en formato normal (sin mayúsculas sostenidas). Ej: "Oriana Madeleine Castro Vallejo".
- career: La carrera (string). Debe ser exactamente una de: "Ingeniería en Sistemas", "Ingeniería en Telecomunicaciones", "Ingeniería Petrolera", "Ingeniería Civil", o string vacío si no se identifica claramente.
- year: El año del documento (string, 4 dígitos). Busca en la portada: "Gestión 2024", "Cochabamba - Bolivia", o el año junto al lugar. Si hay varios, prioriza el de la portada.
- keywords: Un array de 4 a 8 palabras clave cortas (1 a 3 palabras cada una, en minúsculas salvo siglas) relevantes del proyecto (tecnologías, metodologías, temas principales). Nunca repitas el título completo ni pongas la carrera como palabra clave. Extrae del título y del resumen/introducción si existen. Ej: ["machine learning", "procesamiento de lenguaje natural", "sistema de recomendación", "base de datos"]. Si no puedes determinarlas con confianza, devuelve un array vacío [].

Texto del documento:
"""
${text.substring(0, 8000)}
"""`;

    // Modelo principal y uno de respaldo por si el primero falla o se satura.
    let data: any = null;
    for (const model of MODELS) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
          signal: AbortSignal.timeout(25_000),
        });
        if (res.ok) {
          data = await res.json();
          break;
        }
        console.error(`Groq (${model}) respondió ${res.status}:`, (await res.text()).slice(0, 300));
      } catch (err) {
        console.error(`Groq (${model}) no respondió:`, err);
      }
    }
    if (!data) {
      return NextResponse.json({ error: "La IA no respondió; completa los datos a mano." }, { status: 502 });
    }

    const content = data.choices?.[0]?.message?.content;
    const parsed = safeJsonParse(content || "{}");

    return NextResponse.json({
      title: parsed.title || "",
      studentName: parsed.studentName || "",
      career: parsed.career || "",
      year: parsed.year || "",
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    });
  } catch (error) {
    console.error("Error in extract-pdf-data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
