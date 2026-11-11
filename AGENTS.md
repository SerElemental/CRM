<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CRM Ser Elemental

- Todo en español: tablas, columnas, archivos (kebab-case), comentarios y textos.
- Datos de pacientes de un consultorio de psicología: nunca al repositorio (`*.xlsx`, `reportes/`, `.env*` están ignorados) ni a servicios externos.
- Cada Server Action empieza con `requireProfile()`. La RLS (`private.es_staff()`) es el candado real.
- Los conteos y sumas van en SQL (vista `pacientes_listado`): las consultas desde la app cortan en 1.000 filas.
- Al añadir columnas a `pacientes` hay que volver a crear las vistas `pacientes_listado` y `pacientes_facetas` en la misma migración: usan `p.*` y Postgres fija las columnas de una vista al crearla (ver la migración `…0008`).
- Un cambio de esquema = migración nueva (nunca editar una aplicada) + `src/lib/database.types.ts` + prueba en `supabase/tests/`.
- Antes de cada commit: `npm run lint`, `npm test` y `npm run build`.
