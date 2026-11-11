# CRM Ser Elemental

CRM del consultorio Ser Elemental (Marcela Salazar). Se construye por módulos; el primero es **Pacientes**: base de datos, ficha interna y sesiones.

Next.js 16 (App Router) · Supabase (Postgres + Auth + RLS) · Tailwind 4 · TypeScript.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y completa las llaves de Supabase
npm run db:apply             # aplica las migraciones de supabase/migrations
npm run seed:admin           # crea una cuenta: pregunta correo, nombre y contraseña (oculta)
npm run dev
```

## Importar el Excel de pacientes

El Excel tiene datos de pacientes: **vive fuera del repositorio** (por defecto se busca en la carpeta de arriba).

```bash
node scripts/importar-excel.mjs --dry-run   # analiza y deja reportes/importacion-para-revisar.md
npm run importar                            # importa (solo con la base vacía)
npm run importar -- --forzar                # vuelve a importar encima
npm run importar -- --solo-sesiones         # corrige solo las sesiones (no pisa lo editado en el CRM)
```

## Facturas

Marcela factura desde dos empresas: Colombia (cuenta de cobro, COP) y EE. UU. (invoice, USD). Los datos de cada una —incluidas las cuentas bancarias— viven en la base, no en el código:

```bash
npm run cargar:emisores      # lee datos/emisores.json (no se versiona) y lo carga en la tabla emisores
npm run muestras:factura     # genera PDF de muestra en ../Muestras de facturas
```

Una factura emitida no se edita ni se borra: se marca pagada o se anula. El consecutivo es por empresa y año.

## Despliegue

Producción: https://crm-ser-elemental.vercel.app (proyecto `crm-ser-elemental` en Vercel).

Vercel no tiene acceso al repositorio de GitHub, así que **no se publica solo al subir cambios**: se publica desde este computador.

```bash
npm run desplegar            # compila en Vercel y publica a producción
```

En Vercel solo están las dos variables públicas (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). La service key y el token de acceso **no** se suben: solo los usan los scripts locales. El archivo `.vercelignore` deja por fuera llaves, datos y pruebas.

Se intentó enlazar el repositorio (la app de Vercel está instalada en la cuenta SerElemental de GitHub, solo para este repositorio), pero Vercel no admite como origen la cuenta personal de otra persona. Si algún día hace falta que se publique solo, la vía es un flujo de GitHub Actions con un token de Vercel guardado como secreto `VERCEL_TOKEN`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (admite cabeceras grandes: en `localhost` se acumulan las cookies de sesión de otros proyectos y sin eso responde 431) |
| `npm run build` | Compilación de producción |
| `npm run lint` | ESLint |
| `npm test` | Pruebas: mapeo del Excel y migraciones (en un Postgres en memoria) |
| `npm run db:apply` | Aplica las migraciones pendientes al proyecto de Supabase |

## Cómo está organizado

- `src/app/(app)/pacientes/` — listado, ficha (`[id]`), alta y edición. Cada escritura pasa por una Server Action que vuelve a exigir sesión.
- `src/app/(app)/facturas/` — repositorio con filtros, nueva factura, detalle y la ruta que genera el PDF.
- `src/lib/facturas/` — plantilla PDF (`factura-pdf.tsx`), tipos, validación y valor en letras.
- `src/lib/importacion/mapeo.ts` — traducción del Excel (color + letra de cada casilla → asistencia y pago).
- `supabase/migrations/` — esquema, seguridad por filas (RLS) y funciones `registrar_sesion` / `registrar_paquete`.
- `src/lib/database.types.ts` — tipos de la base, mantenidos a mano junto a las migraciones.

## Seguridad

- Solo entra quien tiene un **perfil activo** (`profiles`). Los perfiles se crean con `npm run seed:admin`; registrarse por fuera no da acceso.
- Todas las tablas tienen RLS. La service key solo la usan los scripts locales.
- Nunca se versionan `.env*`, archivos de Excel ni la carpeta `reportes/`.
