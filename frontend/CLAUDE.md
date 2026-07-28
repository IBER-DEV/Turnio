# CLAUDE.md — Frontend (Turnio)

> Se carga junto con el `CLAUDE.md` de la raíz (léelo primero si no lo
> has hecho: define el proyecto, el contrato con backend y las reglas
> de coordinación entre las dos partes). Este archivo son las reglas
> específicas de implementación del frontend.

## Rol
Eres el ingeniero frontend de Turnio: React + Capacitor, un solo
código para web admin del negocio, app cliente y app empleado. No
tocas código de `backend/`; todo lo que necesites saber sobre cómo
hablarle a la API sale de `../CONTRATO.md` y `../backend/openapi.yaml`,
nunca de leer o adivinar el código Django directamente.

## Regla de oro: el contrato manda
- `../backend/openapi.yaml` es el schema real, autogenerado desde el
  backend. Es la fuente de verdad de campos, tipos y endpoints
  disponibles. Si el backend está corriendo local (`docker compose up
  -d` desde la raíz), también puedes explorarlo en
  `http://localhost:8001/api/docs/`.
- `../CONTRATO.md` documenta lo que el schema no captura: flujo de
  auth JWT, formato de errores, convenciones de nombres (español,
  `snake_case`), y el modelo de capacidades.
- Si necesitas un campo, endpoint o comportamiento que no está en
  ninguno de los dos, **no lo inventes ni lo asumas**: anótalo como
  duda abierta en `ROADMAP-FRONTEND.md` (o en `../ROADMAP.md` si
  bloquea a ambas partes) para que backend lo resuelva.
- Si el contrato cambia (nuevo endpoint, campo renombrado), vas a
  verlo reflejado en `../backend/openapi.yaml` y en el historial de
  `../CONTRATO.md` — revisa ese historial al empezar una sesión si
  sospechas que algo cambió del lado backend.

## Principios de producto que afectan la UI
- **Cargos que define cada negocio, y dos niveles de gating**
  (revisado 2026-07-26). `MiembroNegocio` no tiene flags: tiene un
  **cargo**, y de ahí salen las capacidades. `mi-membresia` devuelve
  `tipo` (discriminador de dominio) y `cargo` (capacidades). La regla:
  - **`tipo` decide la forma de la app** — qué navegación existe y dónde
    aterriza la persona. Vive en `src/permisos/shell.ts`.
  - **las capacidades deciden las acciones** — qué botones se pintan.
  - Todo se lee con el hook `usePermisos()` (`puede(...)` y `shell`).
    **Nunca leas `membresia.cargo.puede_x` a mano** en una pantalla.

  Los nombres de los cargos los pone el dueño, así que **no los
  hardcodees ni los uses para decidir nada**: para eso está `tipo`. Un
  negocio de un solo operador es el caso n=1 del mismo modelo.
- **El lenguaje de los permisos vive en `src/permisos/catalogo.ts`**, en
  términos de lo que la persona hace en el local ("Poner los precios"),
  no del nombre del campo. Es un `Record<Capacidad, …>` derivado del
  schema: si el backend agrega una capacidad, el frontend **deja de
  compilar** hasta que se decida cómo se le explica al usuario.
- **Multi-empleado desde el inicio**: cualquier pantalla de agenda debe
  pensarse por empleado (selector de empleado, "cualquiera
  disponible"), no como agenda única del negocio. Ver `../CLAUDE.md`.
- **Reserva de citas por el cliente es MVP**, no una mejora tardía: al
  llegar a Fase 2, la búsqueda/reserva básica de negocios tiene la
  misma prioridad que las pantallas del lado negocio.

## Stack (decidido 2026-07-24, ver justificación en `ROADMAP-FRONTEND.md`)
- Vite + React + TypeScript + React Router. Capacitor inicializado
  (`capacitor.config.ts`), sin plataformas nativas agregadas todavía
  (`npx cap add android/ios` queda para cuando haga falta compilar a
  dispositivo — no bloquea el desarrollo web).
- **Sin librería de estado/data-fetching** (no React Query, no Redux):
  Context de React (`src/auth/AuthContext.tsx`) + `useState`/`useEffect`
  por pantalla. Suficiente para el volumen de Fase 1; revisar si hace
  falta algo más cuando el número de pantallas con caché compartida
  crezca.
- **Sistema de diseño propio sobre Tailwind** (revisado 2026-07-25; la
  decisión original era "CSS plano en `src/App.css`, sin Tailwind", y
  quedó obsoleta con el rediseño de UI/UX). **`tailwind.config.js` es la
  fuente de verdad del sistema de diseño**: colores, tipografías,
  espaciados, sombras y animaciones. Los mockups de los que se
  extrajeron esos tokens (generados con `diseno-ui-ux-prompt.md`) se
  borraron del repo a propósito una vez volcados, para no mantener dos
  copias que se desincronizarían — así que no busques una carpeta de
  diseño, no existe. Regla práctica: **nada de `#hex` ni `[13px]`
  sueltos en un `className`**; si falta un valor, se agrega al config
  con nombre semántico y se usa por ese nombre. Los componentes
  compartidos viven en `src/ui/`.
- **Sin librería de componentes con estilos propios** (no MUI, no
  Chakra, no shadcn completo): pelearían con el sistema de diseño ya
  definido. Lo que sí se usa son **primitivas headless de Radix**
  (`@radix-ui/react-dialog`) para el comportamiento accesible que es
  fácil de hacer mal a mano: focus trap, restauración de foco, scroll
  lock, cableado de `aria-*`. Radix no trae estilos, así que el diseño
  sigue siendo 100% nuestro. Si hace falta otro primitivo complejo
  (select, popover, tabs), la preferencia es el equivalente de Radix
  antes que escribirlo a mano.
- **`cn()` usa `clsx` + `tailwind-merge`** (`src/ui/cn.ts`): sin
  `tailwind-merge`, pasar `className="px-2"` a un componente que por
  dentro trae `px-4` dejaba ambas clases y ganaba la que Tailwind
  emitiera de último en el CSS — no la del call site. Los tokens propios
  del proyecto están declarados en `extendTailwindMerge` ahí mismo; si
  agregas un token de tipografía nuevo en `tailwind.config.js`, agrégalo
  también a esa lista o los conflictos no se resolverán.
- **Iconos: SVG inline generado, no fuente de iconos.** `src/ui/Icon.tsx`
  lee de `src/ui/iconos.generated.ts`, que produce `npm run iconos`
  (script en `scripts/generar-iconos.mjs`) tomando de
  `@material-symbols/svg-400` **solo los iconos que el código usa**.
  Antes se importaba la fuente completa de Material Symbols: 3,96 MB de
  woff2 para dibujar ~30 glifos. **Si agregas un `<Icon name="...">` con
  un icono nuevo, corre `npm run iconos`** — si no, TypeScript falla en
  compilación señalando el archivo y la línea (con la fuente, en cambio,
  se renderizaba el texto literal "calendar_todai" en la UI y nadie se
  enteraba). El archivo generado se commitea; no hace falta regenerarlo
  en cada build. Los nombres válidos están en
  https://fonts.google.com/icons.
- **Fuentes: solo el subset `latin`** (`@fontsource/inter/latin-400.css`,
  no `@fontsource/inter/400.css`). Cubre todo el español; el paquete
  completo arrastraba cirílico, griego y vietnamita.
- **Animaciones vía `tailwindcss-animate` + keyframes propios** en
  `tailwind.config.js`. Nada por encima de ~250ms en interacciones. Hay
  un bloque global de `prefers-reduced-motion` en `index.css`: cualquier
  animación nueva lo respeta automáticamente, no hace falta repetirlo.
- **Tipos generados desde el contrato**: `openapi-typescript` genera
  `src/api/schema.ts` desde `../backend/openapi.yaml`
  (`npm run generate:types`). El cliente HTTP es `openapi-fetch`
  (`src/api/client.ts`), tipado contra ese mismo schema — nunca se
  escriben a mano los tipos de request/response.
- **`tsconfig` con `strict: true`**: el scaffold de Vite NO lo trae por
  defecto. Sin `strictNullChecks`, TypeScript no discrimina bien
  uniones con discriminante booleano (`{ok:true}|{ok:false,error}`) ni
  la mayoría del narrowing útil — se detectó porque `AuthContext.login`
  devuelve exactamente ese tipo de unión. Si en algún punto parece que
  TypeScript "no está narrowing algo obvio", lo primero a revisar es
  que `strict` siga en `true` en `tsconfig.app.json`.

## Trampa conocida de React en este código: efectos que dependen de callbacks inline
El `Modal` original tenía un `useEffect` con `onCerrar` en su lista de
dependencias, y todas las pantallas pasan ese prop como arrow function
inline (`onCerrar={() => setAbierto(false)}`). Como esa función cambia
de identidad en cada render, **cada tecla escrita en un input del modal
re-ejecutaba el efecto**, y el `contenedor.focus()` que había adentro
sacaba el foco del campo: se escribía una letra y había que volver a
hacer clic. Se corrigió migrando a Radix Dialog, y hay un test de
regresión en `src/ui/Modal.test.tsx` que falla contra la
implementación vieja.

Regla general que sale de ahí: **si un efecto depende de una función
que viene por props, o la memoizas en el padre, o la guardas en un ref,
o no la pones en las dependencias.** Antes de agregar un `useEffect`
con una función en las deps, verifica quién la construye.

## Testing
`vitest` + `@testing-library/react` (`npm run test`, `npm run
test:watch`). Setup en `src/test/setup.ts`, que incluye stubs de APIs
del navegador que jsdom no trae y que Radix necesita (`matchMedia`,
`ResizeObserver`, pointer capture) — si agregas un componente Radix y
revienta en tests con un `TypeError` de alguna API del DOM, ese archivo
es el lugar donde se agrega el stub.

Criterio de qué testear (todavía no hay suite amplia): comportamiento
que sea fácil de romper sin darse cuenta y caro de detectar a ojo —
foco, accesibilidad, gating por capacidades, máquina de estados de
`Cita`. No hace falta test de snapshot de cada pantalla.

## Wart conocido del contrato: serializers que mezclan lectura/escritura
Algunos `ModelSerializer` del backend (`Servicio`, `HorarioTrabajo`,
y los serializers de simplejwt como `TokenObtainPair`) exponen `id`
(o `access`/`refresh`) como `readonly` en el schema, pero el mismo
componente sirve de request Y de response — el schema no los separa.
Eso hace que el tipo de body de creación incluya campos que en
realidad no se envían. Patrón usado para no pelear con esto en cada
pantalla: `src/api/types.ts` define alias `Omit<.... , "id">` para los
casos de `ModelSerializer` (`ServicioInput`, `HorarioTrabajoInput`), y
para los de simplejwt se castea el body con `as never` en el único
punto de llamada (`AuthContext.tsx`). Si agregas un nuevo
`ModelSerializer` con este mismo problema, sigue el patrón de
`src/api/types.ts` en vez de repetir `as never` sueltos.

## Roadmap
Ver [`ROADMAP-FRONTEND.md`](ROADMAP-FRONTEND.md) para el estado
detallado de esta capa. La vista conjunta por fase vive en
`../ROADMAP.md`.
