# CRM Ser Elemental

CRM del consultorio Ser Elemental (Marcela Salazar). Se construye por módulos; el primero es **Pacientes**: base de datos, ficha interna y sesiones.

Next.js 16 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind 4 · TypeScript.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y completa las llaves de Supabase
npm run db:apply             # aplica las migraciones de supabase/migrations
npm run seed:admin -- <tu-correo> "<Tu Nombre>"   # crea una cuenta; pide la contraseña sin mostrarla
npm run dev
```

## Importar el Excel de pacientes

El Excel tiene datos de pacientes: **vive fuera del repositorio** (por defecto se busca en la carpeta de arriba).

```bash
node scripts/importar-excel.mjs --dry-run   # analiza y deja reportes/importacion-para-revisar.md
npm run importar                            # importa (solo con la base vacía)
npm run importar -- --forzar                # vuelve a importar encima
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npm test` | Pruebas: mapeo del Excel y migraciones (en un Postgres en memoria) |
| `npm run db:apply` | Aplica las migraciones pendientes al proyecto de Supabase |

## Cómo está organizado

- `src/app/(app)/pacientes/` — listado, ficha (`[id]`), alta y edición. Cada escritura pasa por una Server Action que vuelve a exigir sesión.
- `src/lib/importacion/mapeo.ts` — traducción del Excel (color + letra de cada casilla → asistencia y pago).
- `supabase/migrations/` — esquema, seguridad por filas (RLS) y funciones `registrar_sesion` / `registrar_paquete`.
- `src/lib/database.types.ts` — tipos de la base, mantenidos a mano junto a las migraciones.

## Seguridad

- Solo entra quien tiene un **perfil activo** (`profiles`). Los perfiles se crean con `npm run seed:admin`; registrarse por fuera no da acceso.
- Todas las tablas tienen RLS. La service key solo la usan los scripts locales.
- Nunca se versionan `.env*`, archivos de Excel ni la carpeta `reportes/`.
