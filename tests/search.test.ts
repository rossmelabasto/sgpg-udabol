import { describe, expect, it } from "vitest";
import { normalize, scoreProject, searchInMemory, significantTokens, titleSimilarity, levenshtein } from "@/lib/search";
import type { ThesisProject } from "@/lib/projects";

const p = (id: string, title: string, extra: Partial<ThesisProject> = {}): ThesisProject => ({
  id,
  title,
  studentName: "Alumno Prueba",
  career: "Ingeniería en Sistemas",
  year: 2025,
  abstract: "",
  tags: [],
  hasPdf: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});

const data = [
  p("redes", "Diseño de una red de fibra óptica para Cochabamba", { career: "Ingeniería en Telecomunicaciones", tags: ["redes", "fibra óptica"] }),
  p("neuro", "Red neuronal convolucional para detectar enfermedades en hojas de papa", { tags: ["redes neuronales", "visión artificial"] }),
  p("iot", "Sistema IoT de monitoreo de temperatura", { year: 2024, tags: ["IoT", "monitoreo"] }),
  p("gas", "Levantamiento artificial por gas lift en el campo Bulo Bulo", { career: "Ingeniería Petrolera", studentName: "Henry Mamani" }),
];

describe("normalize / tokens", () => {
  it("quita tildes (y la ñ), mayúsculas y signos", () => {
    expect(normalize("DISEÑO de Óptica, ¡Ya!")).toBe("diseno de optica ya");
  });
  it("ignora palabras vacías", () => {
    expect(significantTokens("sistema de la red para el campo")).toEqual(["sistema", "red", "campo"]);
  });
});

describe("búsqueda", () => {
  it("exige todas las palabras: 'redes neuronales' no trae proyectos de redes de telecomunicaciones", () => {
    const ids = searchInMemory(data, "redes neuronales").map((r) => r.id);
    expect(ids).toEqual(["neuro"]);
  });
  it("encuentra sin tildes y con un error de tipeo", () => {
    expect(searchInMemory(data, "optica cochabamba").map((r) => r.id)).toEqual(["redes"]);
    expect(searchInMemory(data, "monitoreo temperatur").map((r) => r.id)).toEqual(["iot"]);
    expect(searchInMemory(data, "monitoero").map((r) => r.id)).toEqual(["iot"]);
  });
  it("busca por alumno", () => {
    expect(searchInMemory(data, "mamani").map((r) => r.id)).toEqual(["gas"]);
  });
  it("prioriza coincidencias en el título", () => {
    const withAbstract = p("abs", "Otro tema", { abstract: "habla de monitoreo de temperatura" });
    const res = searchInMemory([withAbstract, ...data], "monitoreo temperatura");
    expect(res[0].id).toBe("iot");
  });
  it("una consulta solo de palabras vacías devuelve todo", () => {
    expect(searchInMemory(data, "de la el")).toHaveLength(data.length);
  });
  it("filtra por carrera, rango de años y tag", () => {
    expect(searchInMemory(data, "", { career: "Ingeniería Petrolera" }).map((r) => r.id)).toEqual(["gas"]);
    expect(searchInMemory(data, "", { yearTo: 2024 }).map((r) => r.id)).toEqual(["iot"]);
    expect(searchInMemory(data, "", { tag: "Redes Neuronales" }).map((r) => r.id)).toEqual(["neuro"]);
  });
  it("puntaje 0 si falta una palabra", () => {
    expect(scoreProject(data[2], "monitoreo blockchain")).toBe(0);
  });
});

describe("duplicados", () => {
  it("títulos casi iguales tienen alta similitud", () => {
    expect(titleSimilarity("Sistema de recomendación de libros basado en emociones", "SISTEMA INTELIGENTE DE RECOMENDACION DE LIBROS BASADO EN EMOCIONES")).toBeGreaterThanOrEqual(0.8);
    expect(titleSimilarity("Red neuronal para papa", "Fibra óptica en el Beni")).toBe(0);
  });
  it("levenshtein con corte", () => {
    expect(levenshtein("monitoreo", "monitoero", 2)).toBe(1); // letras invertidas = 1 error
    expect(levenshtein("telecomunicacion", "telecomunicasion", 2)).toBe(1);
    expect(levenshtein("abc", "abcdefgh", 2)).toBe(3);
  });
});
