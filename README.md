# SGPG · Repositorio de Proyectos de Grado — UDABOL

Plataforma web para registrar, consultar y conservar los proyectos y tesis de grado
de la Universidad de Aquino Bolivia. Producción: <https://sgpg-udabol.vercel.app>.

## Qué hace

- **Consulta (invitados):** búsqueda por tema, título, palabras clave o alumno (tolera tildes
  y errores de tipeo, ordena por relevancia), filtros por carrera, año y palabra clave, y
  lectura del PDF en un visor integrado (también en el celular).
- **Administración:** registro con extracción automática de datos del PDF (IA + heurística),
  subida masiva con revisión y detección de duplicados, versiones del PDF, historial de
  cambios con autor, papelera y exportación CSV.
- **Superadministración:** cuentas y roles, borrado definitivo, respaldo JSON, búsqueda de
  duplicados, limpieza de PDFs huérfanos y actividad reciente.

## Roles

| Rol | Puede |
|---|---|
| Invitado | Buscar y leer proyectos (sin cuenta, acceso anónimo). |
| Administrador | Además registrar, editar, subir PDFs y enviar a la papelera. |
| Superadministrador | Además gestionar cuentas, borrar definitivamente y usar «Sistema». |

El rol **siempre lo decide el servidor** a partir de la colección `admins` de Firestore
(`role` y `isActive`). Desactivar o quitar una cuenta le corta el acceso en su siguiente
petición. Ver `lib/auth.ts`.

## Arquitectura

- **Next.js 16** (App Router, React 19, TypeScript) + Tailwind 4 + componentes base de shadcn/Base UI.
- **Firebase:** Auth (sesión por cookie httpOnly de 14 días), Firestore y Storage, usados
  **solo desde el servidor** con el Admin SDK. Las reglas (`firestore.rules`,
  `storage.rules`) niegan todo acceso directo desde el navegador.
- **PDFs:** se suben por `/api/upload-pdf` (máx. 4 MB por el límite de Vercel) y se leen
  por `/api/pdf/<id>` con sesión, por rangos (pdf.js descarga por partes).
- **IA:** Groq (`openai/gpt-oss-20b`, respaldo `openai/gpt-oss-120b`) en
  `/api/extract-pdf-data`; si no responde, se usa la heurística de `lib/pdf.ts`.

```
app/            páginas, server actions (app/actions) y rutas API (app/api)
components/     interfaz (components/ui = primitivas)
lib/            auth, búsqueda, utilidades de PDF y Firebase
scripts/        mantenimiento, migraciones y emuladores
tests/          pruebas (Vitest)
```

## Desarrollo local

Requisitos: Node 20+, pnpm 11 y Java 21+ (para los emuladores).

```bash
pnpm install
```

**Con emuladores (recomendado, no toca producción):**

```bash
pnpm emuladores        # terminal 1: Auth, Firestore y Storage locales (UI en :4000)
pnpm sembrar           # terminal 2: cuentas y proyectos de prueba
pnpm dev:emulador      # app en http://localhost:3100
```

Cuentas de prueba (solo existen en el emulador): ver el encabezado de
`scripts/sembrar-emulador.mjs`. Para probar con los proyectos reales sin tocarlos:
`node --env-file=.env scripts/exportar-proyectos.mjs /tmp/p.json` y luego
`pnpm sembrar -- --json /tmp/p.json`.

> El servidor de desarrollo (Turbopack) usa ~3 GB de RAM. En equipos con 16 GB conviene
> limitarlo: `systemd-run --user --scope -p MemoryMax=4500M pnpm dev:emulador`.

**Contra el proyecto real:** copiar `.env.example` a `.env`, completar y `pnpm dev`.

## Calidad

```bash
pnpm typecheck   # TypeScript
pnpm lint        # ESLint (config de Next)
pnpm test        # Vitest
pnpm build
```

## Despliegue

Cada push a `main` despliega en Vercel. Variables: `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `GROQ_API_KEY` (también en *Preview* para
las ramas). Reglas de Firebase:

```bash
npx firebase deploy --only firestore:rules,storage --project udabol-project-manager
```

## Scripts de mantenimiento (`scripts/`)

Todos simulan por defecto; con `--aplicar` escriben. Se corren con
`node --env-file=.env scripts/<script>.mjs`.

| Script | Para qué |
|---|---|
| `migrar-admins.mjs` | Deja las cuentas con rol explícito y crea el superadmin (`SUPERADMIN_EMAIL`). |
| `migrar-pdfpath.mjs` | Pasa las URLs firmadas antiguas de los PDFs a rutas internas. |
| `exportar-proyectos.mjs` | Exporta los proyectos a JSON (solo lectura). |

---
Desarrollado por Rossmel Abasto para la Universidad de Aquino Bolivia.
