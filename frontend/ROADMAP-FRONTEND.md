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

### Rediseño de UI/UX (2026-07-24) — próximo paso antes de seguir sumando pantallas
El frontend actual es funcional pero no profesional (CSS mínimo, sin
sistema de diseño, sin estados de carga/vacío/error diseñados, sin
confirmaciones, sin accesibilidad) — ver `../plan-accion.md` sección
0.3. Se dejó [`diseno-ui-ux-prompt.md`](diseno-ui-ux-prompt.md) listo
para correr en una herramienta de diseño (Claude, Figma AI, v0,
Lovable, etc.) y usar el resultado como base para reconstruir las
pantallas existentes, en vez de seguir agregando pantallas nuevas
sobre el CSS actual.

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
1. ~~¿Se agrega Vitest + Testing Library ahora?~~ Resuelto el
   2026-07-25: se agregó (ver entrada de esa fecha).
2. ¿Vale la pena migrar tokens a `@capacitor/preferences` ya, o
   esperar a que se pruebe en un dispositivo/emulador real?

## Rediseño de UI/UX + corrección de bugs de formularios (2026-07-25)

> Misma rama `feature/frontend-fase1`. Sesión pedida por el humano tras
> encontrar bugs usando los formularios de la app.

### Bugs encontrados y corregidos
1. **El input perdía el foco al escribir la primera letra** (reportado
   por el humano; el más grave de los tres). Causa raíz: el `useEffect`
   de `Modal` tenía `onCerrar` en sus dependencias, y todas las
   pantallas pasan ese prop como arrow function inline — identidad nueva
   en cada render. Cada tecla → re-render → efecto re-ejecutado →
   `contenedor.focus()` robaba el foco del campo. Explicado en
   `CLAUDE.md` como trampa a evitar en efectos futuros.
2. **El campo "Duración (min)" de Servicios se repintaba en `0`** al
   borrarlo, porque `Number("")` es `0`; había que borrar ese `0` para
   poder escribir. Ahora acepta el vacío mientras se edita.
3. **Los campos de hora de Horarios se atascaban** al borrarlos:
   `` `${""}:00` `` producía `":00"`, que no es una hora válida, y el
   input quedaba en un estado del que no se podía salir.

Los bugs 2 y 3 no los reportó el humano; salieron de revisar el resto de
formularios buscando el mismo tipo de falla.

### Dependencias nuevas (justificación, según regla de `../CLAUDE.md`)
- **`@radix-ui/react-dialog`**: se eligió sobre seguir manteniendo el
  modal artesanal porque además del bug de foco le faltaba focus trap
  real (el Tab se escapaba del modal), devolución del foco al elemento
  que lo abrió, y `aria-describedby`. Es headless: no trae estilos ni
  pelea con el sistema de diseño. Costo: ~22 kB gzip en el bundle.
- **`clsx` + `tailwind-merge`**: `cn()` solo concatenaba, así que
  `className="px-2"` sobre un componente con `px-4` interno dejaba las
  dos clases y ganaba la del CSS emitido de último, no la del call
  site. Ya había dos llamadas así en el código (`Button className="px-2"`
  en Servicios y Agenda), o sea que el bug ya estaba latente.
- **`tailwindcss-animate`**: animaciones declarativas atadas a los
  `data-state` de Radix, sin JS de animación (se descartó Framer Motion
  por peso: es una app Capacitor y las animaciones necesarias son
  simples).
- **`vitest` + `@testing-library/react` + `jsdom`**: cerraba el pendiente
  "sin tests de frontend" que ya estaba anotado abajo.

### Qué más se hizo
- **Test de regresión** (`src/ui/Modal.test.tsx`, 4 tests). Se verificó
  que **falla contra el `Modal` viejo** — un test que pasa en ambas
  versiones no habría probado nada. Cubre: foco al escribir, focus trap,
  cierre con Escape, y nombre/descripción accesibles.
- **Animaciones**: entrada de modales (hoja desde abajo en móvil, zoom
  en escritorio), toasts, filas de listas y detalle expandido de cita.
  Con bloque global de `prefers-reduced-motion` en `index.css`.
- **Fuga de timers en `Toast`**: los `setTimeout` de auto-cierre nunca
  se limpiaban al desmontar el provider.
- **CI de frontend** (`.github/workflows/frontend-ci.yml`): lint, tests,
  build (que incluye `tsc -b`), y un chequeo de que `src/api/schema.ts`
  esté regenerado respecto a `../backend/openapi.yaml` — el espejo del
  chequeo de contrato que ya hacía el CI de backend. Cierra el pendiente
  #3 de `../ROADMAP.md`.

### Pendiente que sigue abierto
- La suite de tests es mínima a propósito (solo `Modal`). Falta cubrir
  el gating por capacidades y los flujos de creación de cada pantalla.
- Sigue sin haber tests e2e.
- Sigue pendiente migrar tokens a `@capacitor/preferences` y agregar
  plataformas nativas de Capacitor.

## Catálogo de servicios, horario semanal y vista de calendario (2026-07-25)

> Misma rama. Pedido del humano tras revisar Goldie en vivo: le gustó que
> la competencia traiga "maestros" listos (catálogo de servicios), que el
> horario del empleado se defina de una vez para toda la semana en vez de
> día por día, y su vista de calendario.

### Catálogo de servicios
Se investigó primero si existía una **API pública de catálogo de
servicios de barbería/salón** para no mantener el dato a mano: **no
existe**. Lo único disponible son APIs propietarias de plataformas
competidoras (Vagaro, Phorest), no usables acá. Así que el catálogo es
dato local en `src/data/catalogoServicios.ts` — lo cual además resultó
preferible: los nombres son los que se usan en Colombia (no traducciones
del inglés) y los precios están en COP con órdenes de magnitud reales.

- 28 servicios en 4 categorías (Barbería, Peluquería, Uñas, Estética).
- `ModalCatalogo` permite alta en lote con checkboxes; oculta los que ya
  existen por nombre para no duplicar.
- Son **valores de arranque, no verdad**: se editan al agregarlos y
  después desde la pantalla. Si los precios envejecen, se actualiza ese
  archivo y ya.
- El estado vacío de Servicios ahora ofrece el catálogo como acción
  principal y "crear desde cero" como secundaria (se agregó
  `accionSecundaria` a `EstadoVacio`).

### Horario semanal (`ModalHorarioSemanal`)
Reemplaza al formulario anterior, que creaba **un bloque a la vez**:
dejar listo a un barbero de lunes a sábado eran seis envíos separados.
Ahora se edita la semana completa y se guarda de una.

- Plantillas de un clic para el caso común ("Lun a Vie · 9–18", etc.).
- **Se mantuvo la posibilidad de varias franjas por día** (el caso del
  descanso de mediodía, que el diseño original resolvía creando dos
  bloques el mismo día): cada día es una lista de franjas, no un rango
  único. Un editor de un solo rango por día habría sido más simple pero
  habría quitado una capacidad que el backend ya soporta y que está
  explícitamente cubierta por un test suyo.
- Valida solapamientos entre franjas del mismo día antes de enviar.
- Al guardar hace diff contra lo existente: `DELETE` de lo que se quitó,
  `PATCH` de lo que cambió de hora, `POST` de lo nuevo.

### Vista de calendario semanal (`VistaSemana`)
Grilla horaria con los días como columnas, al estilo de un calendario
clásico (es lo que le gustó de Goldie).

- **Convive con la vista de lista, no la reemplaza**: en un teléfono
  —que es el caso principal de esta app— siete columnas quedan
  ilegibles. La lista sigue siendo el default y el selector Lista/Semana
  solo aparece desde `lg`.
- El rango horario visible se deriva de los horarios cargados y las
  citas, para no pintar 00:00–23:00 casi vacío.
- Las franjas de trabajo se pintan de fondo: se ve de un vistazo cuándo
  hay alguien disponible.
- Las citas que se solapan (dos barberos a la misma hora) se reparten en
  columnas dentro del día en vez de taparse.
- Al hacer clic en una cita salta a la lista con esa cita abierta, para
  reusar las acciones de estado que ya existían.

### Bloqueos o dudas abiertas para el humano / backend
1. ~~Falta escritura en lote en el contrato.~~ **Resuelto el mismo día**
   (2026-07-25): como el humano hace también el backend, se agregaron
   `PUT /api/agenda/horarios/semana/` y `POST /api/servicios/lote/`,
   ambos transaccionales. El frontend ya los consume: el guardado del
   horario semanal pasó de N llamadas con diff manual a una sola, y el
   alta desde catálogo de N POST a uno. Los mensajes de error se
   ajustaron en consecuencia ("tu horario anterior quedó intacto", "no
   se creó ninguno"), que ahora son ciertos. Ver `../CONTRATO.md` 5.5.
2. Los precios del catálogo son estimaciones de mercado medio en Bogotá,
   sin fuente dura. Vale la pena contrastarlos con negocios reales
   cuando se haga la validación de campo anotada en
   `../ESTRATEGIA-COMPETITIVA.md`.
