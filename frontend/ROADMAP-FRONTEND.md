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
- Falta decidir: gestor de estado/data-fetching (ej. React Query vs.
  RTK Query), librería de UI, y herramienta de generación de tipos a
  partir de `../backend/openapi.yaml` (ej. `openapi-typescript` u
  `orval`) para no transcribir a mano los tipos del contrato.

## Fase 1 — App Capacitor mínima para el negocio — primera pasada completa (2026-07-24)

> Rama `feature/frontend-fase1`. Construido en la misma sesión que
> terminó el backend de Fase 1, para dejar algo funcional con lo que
> retomar. Falta pulido y las mejoras listadas en "Pendiente" abajo.

### Qué se completó
- Scaffold Vite + React + TypeScript en esta carpeta, con Capacitor
  inicializado (`capacitor.config.ts`, sin plataformas nativas
  agregadas todavía). Ver decisiones de stack en `CLAUDE.md`.
- `src/api/schema.ts` generado con `openapi-typescript` desde
  `../backend/openapi.yaml` (`npm run generate:types`), consumido con
  `openapi-fetch` (`src/api/client.ts`) — nunca se escribieron tipos de
  request/response a mano.
- Auth: `src/auth/tokenStore.ts` (tokens en localStorage — pendiente
  migrar a `@capacitor/preferences`, ver abajo), `src/auth/refresh.ts`
  (`conReintentoDeAuth`: reintenta una vez con refresh token en 401),
  `src/auth/AuthContext.tsx` (`login`, `registrarNegocio`, `logout`,
  `membresia` resuelta vía `GET /api/negocios/mi-membresia/`).
- Pantallas:
  - **Login** (`/login`) y **Registro de negocio** (`/registro`,
    pública) — sin esta última, nadie podía crear un negocio desde la
    UI, solo por API directa; se agregó aunque no estaba en el
    alcance textual de Fase 1 porque sin ella la app no es usable de
    punta a punta.
  - **Dashboard** (`/`) — nombre del negocio + lista de las propias
    capacidades (para verificar visualmente el modelo sin roles).
  - **Servicios** (`/servicios`) — listar, crear (si
    `puede_editar_precios`), activar/desactivar.
  - **Agenda** (`/agenda`) — horarios por empleado (listar, crear,
    borrar; si `puede_gestionar_agenda`) y citas (listar, agendar con
    `empleado` opcional = "cualquiera disponible", y las acciones
    confirmar/completar/cancelar según el estado actual).
  - **Empleados** (`/empleados`) — listar (cualquier miembro), crear y
    editar capacidades/especialidad por checkbox (si
    `puede_gestionar_empleados`). No estaba en el texto original de
    Fase 1 pero el backend ya lo soportaba completo desde antes; se
    agregó a pedido explícito del humano tras notar el hueco.
- Todas las pantallas de escritura siguen el mismo patrón: se
  muestran/habilitan según la capacidad puntual (`membresia.puede_*`),
  nunca según un "tipo de usuario".
- `tsconfig.app.json`/`tsconfig.node.json`: se agregó `"strict": true`
  (el scaffold de Vite no lo trae). Sin esto, TypeScript no discrimina
  bien la unión `{ok:true}|{ok:false,error}` que devuelve
  `AuthContext.login` — ver detalle en `CLAUDE.md`.
- Build (`npm run build`) verificado limpio (`tsc -b && vite build`).

### Bug de contrato encontrado y corregido en el camino (backend)
Al tipar la creación de empleados se notó que `POST
/api/negocios/empleados/` documentaba mal su body de entrada
(`MiembroNegocio` en vez de `EmpleadoAlta`, sin `password`). Causa:
`@extend_schema` estaba puesto sobre `create()` en vez de sobre `post`
en una vista `generics.ListCreateAPIView` (a diferencia de un
`ViewSet`, ahí el método que resuelve el verbo HTTP es `post`, no
`create`). Corregido con `extend_schema_view` a nivel de clase. Ver
`../CONTRATO.md` historial y `../backend/ROADMAP-BACKEND.md`.

### Decisiones y su justificación
- Ver `CLAUDE.md` para las decisiones de stack (sin librería de
  estado/data-fetching, sin librería de UI, tipos generados del
  contrato) y el wart de serializers lectura/escritura mezclada.
- Registro de negocio y gestión de Empleados se agregaron aunque el
  texto original de Fase 1 solo mencionaba "login + agenda + registrar
  servicio": sin registro no hay forma de entrar a la app por primera
  vez, y Empleados ya estaba soportado al 100% en el backend — dejarlo
  sin UI habría sido un hueco arbitrario, no una fase real.

### Pendiente / a medio hacer
- **Tokens en localStorage, no en storage nativo**: para la versión
  Capacitor real (no solo navegador) conviene migrar
  `src/auth/tokenStore.ts` a `@capacitor/preferences`, más apropiado
  para una app empaquetada. No se hizo porque añadir la dependencia y
  el flujo async que implica no se justificaba solo para probar en
  navegador.
- **Servicios**: solo se puede activar/desactivar desde la tabla, no
  editar precio/duración/categoría/comisión ya creados (solo al
  crear). Falta un formulario de edición completa.
- **Horarios**: cualquiera con `puede_gestionar_agenda` edita el
  horario de cualquier empleado, incluyendo el propio — no hay modo
  "autogestión" restringido a el propio horario (mismo pendiente que
  ya tenía anotado el backend en `ROADMAP-BACKEND.md`).
- **Sin tests de frontend todavía** (ni unitarios ni e2e). Se verificó
  manualmente (build limpio + smoke test descrito abajo), no hay
  suite automatizada. Evaluar Vitest + Testing Library si el
  compañero lo considera necesario antes de seguir sumando pantallas.
- No se agregaron plataformas nativas de Capacitor (`cap add
  android/ios`) — requieren Android Studio/Xcode que no están en este
  entorno; es el siguiente paso natural cuando haga falta probar en
  dispositivo/emulador real.
- Vulnerabilidades de `npm audit` en `brace-expansion`/`js-yaml`
  (transitivas de `openapi-typescript`, solo se usan al generar tipos,
  nunca en el bundle) y en `react-router` (aplica a "RSC Mode", que
  esta SPA no usa). No se forzó el fix porque implicaba downgrades;
  revisar cuando salgan parches upstream.

### Bloqueos o dudas abiertas para el humano
1. ¿Se agrega Vitest + Testing Library ahora, o se espera a que el
   compañero decida al retomar?
2. ¿Vale la pena migrar tokens a `@capacitor/preferences` ya, o
   esperar a que se pruebe en un dispositivo/emulador real?

## Fase 1 (histórico) — antes de empezar

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
