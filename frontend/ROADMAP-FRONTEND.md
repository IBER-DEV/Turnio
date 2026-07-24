# ROADMAP — Frontend (Turnio)

> Detalle de trabajo del lado frontend. Para el estado conjunto del
> proyecto (ambas partes) ver [`../ROADMAP.md`](../ROADMAP.md). Para el
> contrato con el backend ver [`../CONTRATO.md`](../CONTRATO.md) y
> [`../backend/openapi.yaml`](../backend/openapi.yaml) (schema real de
> la API, regenerado desde el código del backend — nunca lo
> reinterpretes a mano, ni asumas un campo que no esté ahí).
>
> Reglas: leer completo al empezar una sesión de frontend; al
> terminar, agregar una entrada nueva (nunca borrar las anteriores).
> Si necesitas que la API tenga una forma distinta a la actual,
> anótalo como duda abierta acá — el cambio de contrato lo hace
> backend, no se asume del lado frontend.

## Fase 0 — sin empezar del lado frontend

Fase 0 fue exclusivamente backend (setup, multi-tenancy, auth, alta de
negocio). No hay todavía código de frontend en este repo.

### Decisiones pendientes antes de arrancar
- Stack confirmado: **React** + Capacitor (decisión tomada por el
  humano el 2026-07-24, ver `../ROADMAP.md`).
- Decidido (humano, 2026-07-24):
  - Data-fetching/estado: **fetch nativo + Context** (sin librería de
    cache tipo React Query/RTK Query, para no sumar una dependencia
    todavía). Cliente base en `src/api/client.ts` con manejo de
    JWT (`Authorization: Bearer`) y refresh automático en 401 según
    `../CONTRATO.md` sección 3.
  - Librería de UI: **Tailwind CSS v4** (`@tailwindcss/vite`) +
    **Headless UI** (`@headlessui/react`).
  - Generador de tipos desde `../backend/openapi.yaml`:
    **openapi-typescript**. Script `npm run gen:api-types` regenera
    `src/api/schema.d.ts` (correr cada vez que backend actualice el
    contrato).

### Setup del ambiente — hecho (2026-07-24)
- Scaffold Vite + React + TypeScript en `frontend/` (`npm create
  vite@latest -- --template react-ts`), boilerplate de demo (logos,
  contador) eliminado.
- Instalado: `tailwindcss` + `@tailwindcss/vite`, `@headlessui/react`,
  `openapi-typescript` (dev).
  - Nota: `openapi-typescript@7.13.0` declara peer `typescript@^5.x`
    pero el scaffold trae `typescript@~6.0.2`; se instaló con
    `--legacy-peer-deps` porque es solo dependencia de codegen (no
    corre en runtime). Revisar si esto se resuelve solo en una
    próxima versión de `openapi-typescript`.
- `frontend/.env.example` con `VITE_API_BASE_URL=http://localhost:8001`
  (coincide con `../CONTRATO.md` sección 2); `.env` local ya ignorado
  por el `.gitignore` de la raíz.
- Verificado: `npm run build`, `npm run lint` (oxlint) y `npm run dev`
  (puerto 5173) corren sin errores.

## Fase 1 — App Capacitor mínima para el negocio (próxima, sin empezar)

Alcance esperado (ver `../CLAUDE.md`): login + agenda + registrar
servicio, para un negocio con varios empleados (calendario por
empleado, no solo el caso de un operador único).

Endpoints ya disponibles del lado backend (2026-07-24, backend de
Fase 1 completo — ver `../CONTRATO.md` para el contrato completo y
`../backend/openapi.yaml` para el detalle exacto de campos):
- `POST /api/negocios/registro/`
- `POST /api/auth/login/` / `POST /api/auth/refresh/`
- **`GET /api/negocios/mi-membresia/`** — llamar justo después del
  login (y al recuperar sesión desde tokens guardados): devuelve de
  una vez las capacidades del usuario **y** los datos de su negocio
  (`negocio` anidado). Es la base de "qué vista mostrar" sin roles
  fijos: cada pantalla/botón se muestra u oculta preguntando por el
  flag de capacidad puntual que necesita (`puede_gestionar_agenda`,
  `puede_editar_precios`, etc.), no por un tipo de usuario. Ver
  `../CONTRATO.md` sección 3.1 — **no** resolver esto listando
  empleados y buscando por email, ese approach quedó descartado por
  frágil (el login no devuelve el email, así que había que recordarlo
  aparte).
- `GET/POST /api/negocios/empleados/` y `GET/PATCH
  /api/negocios/empleados/{id}/` (capacidades + `especialidad`) — para
  la pantalla de *gestión* de empleados, no para autoidentificarse.
- `GET/POST/PATCH/DELETE /api/servicios/`
- `GET/POST/PATCH/DELETE /api/agenda/horarios/` (disponibilidad
  semanal por empleado)
- `GET/POST /api/agenda/citas/` + `POST
  /api/agenda/citas/{id}/confirmar|completar|cancelar/` — al crear
  una cita, el campo `empleado` es opcional: si se omite, el backend
  asigna automáticamente el primer empleado disponible ("cualquiera
  disponible"); la UI de agenda no necesita calcular disponibilidad
  por su cuenta.

Con esto, todas las pantallas del alcance de Fase 1 (login, registrar
servicio, agenda por empleado) ya tienen contrato disponible: el
frontend puede empezar.

### Bloqueos o dudas abiertas para el humano
(ninguna todavía — el frontend no ha empezado)
