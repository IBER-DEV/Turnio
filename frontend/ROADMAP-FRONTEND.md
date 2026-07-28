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

## Gating por capacidad en rutas de gestión (2026-07-25)

Pregunta del humano: si un empleado no puede gestionar el equipo, ¿debería
poder entrar a esa pantalla aunque sea en modo lectura? Respuesta: no, y
además el problema de fondo estaba en el backend (ver
`../backend/ROADMAP-BACKEND.md` — el endpoint exponía email y permisos de
todo el equipo a cualquier miembro).

Del lado frontend:
- `RutaProtegida` acepta ahora una prop `capacidad` opcional. `/empleados`
  la usa con `puede_gestionar_empleados`; quien no la tenga es redirigido
  a `/`. El tipo `Capacidad` se deriva del schema (`puede_${string}` sobre
  `MiMembresia`), así que un flag mal escrito no compila.
- El ítem "Equipo" desaparece del menú (drawer y bottom nav) para quien no
  tiene la capacidad.
- Agenda y `ModalHorarioSemanal` pasaron a consumir el nuevo
  `GET /api/negocios/equipo/`, que devuelve solo `id`, `nombre`,
  `especialidad` y `activo`.

**Criterio adoptado** (documentado también en el docstring de
`RutaProtegida`): el gating por ruta se aplica solo a pantallas que son de
gestión de punta a punta, donde no queda nada útil en modo lectura. En
Servicios y Agenda la lectura sí sirve a cualquier miembro, así que esas
siguen abiertas y ocultan únicamente sus acciones de escritura. El guard
de ruta no es la barrera de seguridad —esa está en el backend— sino la
forma de no ofrecer una pantalla que respondería 403.

## Peso del bundle: fuera la fuente de iconos (2026-07-25)

Detectado al evaluar dónde construir la landing: el bundle pesaba
**5,3 MB**, de los cuales **3,96 MB eran el woff2 completo de Material
Symbols** — cargado entero para dibujar ~30 iconos. En el contexto que
documenta `../ESTRATEGIA-COMPETITIVA.md` (negocios donde solo el 44,2%
tiene internet decente, uso mayoritariamente móvil) eso es un primer
arranque inaceptable, y en el bundle Capacitor es peso muerto
permanente en el APK.

### Qué se hizo
- **Iconos como SVG inline generado**: `scripts/generar-iconos.mjs`
  extrae de `@material-symbols/svg-400` solo los iconos referenciados en
  `src/`, y escribe `src/ui/iconos.generated.ts` (37 entradas: 33 iconos
  + 4 variantes rellenas para la bottom nav). `npm run iconos`.
- **Subsets de tipografía**: se pasó de `@fontsource/inter/400.css` a
  `@fontsource/inter/latin-400.css`. El paquete completo traía cirílico,
  griego, vietnamita y latin-ext.
- Se desinstaló `material-symbols` (ya sin uso) y se agregó
  `@material-symbols/svg-400` como devDependency — solo se usa al
  generar, no entra al bundle.

### Resultado
| | Antes | Ahora |
|---|---|---|
| `dist/assets` total | 5,3 MB | **676 kB** |
| Fuente de iconos | 3.960 kB | 0 (eliminada) |
| Fuentes de texto | ~1 MB | 239 kB |
| JS | 362 kB (112 gzip) | 391 kB (122 gzip) |

Los iconos pasaron de 3,96 MB en una request aparte a ~9 kB gzip dentro
del JS. El JS crece un poco, el total baja **87%**.

### Efecto secundario: los nombres de icono quedaron tipados
`Icon` ya no acepta `string` sino `NombreIcono`, derivado del archivo
generado. Al migrar, TypeScript señaló los 9 sitios donde se pasaba
`string` sin validar (`Button`, `Input`, `Feedback`, `Toast`,
`EstadoCita`, `DashboardPage`…). Antes, un nombre mal escrito
renderizaba el texto literal dentro de la UI; ahora no compila.

Detalle de tipado que costó encontrar: en `DashboardPage` la anotación
tiene que ir sobre el **literal del array**, no sobre el resultado de
`.filter()` — ahí TypeScript ya perdió el tipado contextual e infiere
`string`. Queda comentado en el código.

### Tests
5 nuevos en `src/ui/Icon.test.tsx` (9 en total): que dibuja SVG y no
pide fuente, que queda `aria-hidden`, que `filled` usa la variante
rellena, que pedir `filled` sobre un icono sin variante no rompe, y que
el tamaño sigue heredándose de `font-size` para no romper las clases
`text-[32px]` que ya estaban repartidas por las pantallas.

### Pendiente relacionado
Quedan ~239 kB de tipografías (Inter 400/500/600 + Montserrat 600/700,
en woff2 **y** woff). Los `.woff` son fallback para navegadores que
ningún WebView de Capacitor actual necesita; se podrían excluir del
build si hiciera falta apretar más.

## Horarios: el negocio pasa a ser el sujeto, el empleado la excepción (2026-07-26)

> Cambio de contrato con ruptura originado en backend el mismo día (ver
> `../CONTRATO.md` sección 5.7 e historial, y
> `../backend/ROADMAP-BACKEND.md`). Lo hizo la misma persona en ambos
> lados, así que se entregó de una en vez de quedar como bloqueo.

### Qué cambió en la UI
`ModalHorarioSemanal` se reorganizó en dos pestañas y cambió de sujeto:

- **"Todo el negocio"** (pestaña por defecto) — edita el horario del
  local vía el nuevo `PUT /api/agenda/horario-negocio/`. Es el camino
  normal: se carga una vez y lo hereda el equipo entero, incluidos los
  empleados que se den de alta después.
- **"Excepciones"** — para quien trabaja distinto. Selección **múltiple**
  de empleados (chips con checkbox, no el `SelectCustom` de a uno que
  había antes), porque los de medio tiempo suelen compartir turno. Marca
  con una etiqueta "propio" a quien ya es excepción, y ofrece "quitar la
  excepción y volver al horario del negocio" (que es `franjas: []`).

Antes el modal abría pidiendo elegir **un** empleado y cargarle la semana
a mano — el gesto que había que repetir tantas veces como empleados
hubiera, y que motivó todo el cambio.

El editor de la semana en sí (los siete días con sus franjas, las
plantillas "Lun a Vie · 9–18", el partir el día para el descanso) se
extrajo a un `EditorSemana` interno y lo comparten las dos pestañas: es
el mismo control, cambia solo qué se hace con el resultado.

### `horarioEfectivo.ts`: la regla de herencia, duplicada a propósito
La grilla semanal (`VistaSemana`) pinta bandas de disponibilidad. Con
herencia, `GET /api/agenda/horarios/` devuelve vacío en el caso normal,
así que pintar directo desde ahí mostraba una agenda sin disponibilidad
para un negocio perfectamente configurado.

`franjasDeEmpleado()` / `franjasDelEquipo()` replican del lado cliente la
resolución del backend. **Es duplicación consciente**: el backend es la
autoridad al agendar, pero la grilla no puede preguntarle por cada celda.
Está anotado en el archivo y hay tests que fijan la parte sutil (tener
horario propio **un solo día** no hace heredar los demás días — mismo
caso que el test dedicado del backend).

`VistaSemana` pasó de recibir `HorarioTrabajo[]` a recibir `Franja[]` ya
resueltas por el llamador: no le corresponde a la vista saber de herencia.

### Bug pre-existente encontrado y corregido
`npm run build` / `tsc -b` **ya estaba roto en `HEAD`** antes de este
cambio: `AgendaPage` pasaba `tamano="sm"` a `Button`, cuyo tipo `Tamano`
solo admitía `"md" | "lg"`. Se agregó el tamaño `sm` (36px) al sistema de
diseño en vez de borrar el prop, que era la intención del call site —
botones de acción dentro de la tarjeta de una cita, ya densa. Queda
anotado que 36px está por debajo del objetivo táctil de 44px y por eso se
reserva a acciones secundarias.

Que el CI de frontend (`tsc -b`) no lo hubiera atajado sugiere que el
último commit se hizo sin correrlo o sin esperar el resultado.

### Tests
8 nuevos en `src/pages/agenda/horarioEfectivo.test.ts` (17 en total):
herencia cuando no hay horario propio, reemplazo cuando lo hay, el caso
del "solo sábados" que no debe heredar el lunes, no confundir el horario
propio de otro empleado, la unión del equipo sin repetir la franja del
negocio una vez por empleado, y sin nada cargado no hay banda que pintar.

### Duda abierta
La pestaña de excepciones precarga la semana del primer empleado
seleccionado que ya tenga horario propio, y si ninguno tiene, parte del
horario del negocio. Con varios seleccionados que tengan horarios propios
**distintos entre sí**, se muestra el del primero y guardar los iguala a
todos. Es coherente con la semántica de reemplazo del endpoint y con el
caso de uso (marcar varios = quiero que compartan turno), pero no hay
aviso visual de que se van a pisar horarios distintos. Si en uso real
resulta confuso, el arreglo es advertirlo antes de guardar.

## Dos capacidades nuevas y las reglas anti-escalada en la UI (2026-07-26)

> Contraparte del cambio de backend del mismo día (ver `../CONTRATO.md`
> secciones 5.8 y 5.9). Tipos regenerados desde el schema.

### Agenda
- El botón **Horarios** pasa a depender de `puede_configurar_horarios`; el
  de **Agendar**, de `puede_gestionar_agenda`. Antes ambos colgaban del
  mismo flag, que es justo lo que se partió: una recepcionista agenda
  citas pero no decide a qué hora abre el local.
- **El filtro por empleado se oculta sin `puede_ver_agenda_completa`.** El
  backend ya devuelve solo las citas propias, así que el filtro no tenía
  nada que filtrar y sugería que existían citas de otros que no se estaban
  mostrando.
- La banda de disponibilidad de la vista semana también se acota a la
  propia en ese caso: pintar la del equipo entero contradecía la lista de
  al lado.

### Equipo
- Dos interruptores nuevos en el panel de permisos.
- **Los interruptores ahora se deshabilitan según las reglas del backend**
  (`CONTRATO.md` 5.9), con el mensaje correspondiente debajo:
  - los propios, porque nadie cambia sus propias capacidades;
  - los de capacidades que quien mira no posee, **solo cuando están
    apagados** — quitarle a otro algo que uno no tiene sí está permitido,
    así que ese interruptor queda activo.

  Sin esto la UI ofrecía acciones que el backend rechaza con `400`, que es
  la peor combinación: el usuario cree que puede y descubre que no al
  guardar.
- El badge "Admin" pasa a derivarse de la lista `CAPACIDADES` en vez de
  enumerar cinco flags a mano. Con siete capacidades, la versión escrita a
  mano ya estaba mintiendo (marcaba Admin a quien no tenía las dos
  nuevas).

### Dashboard
Corregido el texto del acceso "Gestionar equipo": decía "Permisos y
horarios" y los horarios nunca estuvieron ahí — ahora menos que nunca,
porque dependen de una capacidad distinta.

### Duda abierta
`puede_cobrar` y `puede_ver_reportes` se siguen mostrando como
interruptores funcionales en el panel de permisos, pero el backend no los
usa en ningún endpoint (son de Fase 3 y 4). El dueño los activa y no pasa
nada en ninguna parte. Habría que ocultarlos hasta que sirvan, o marcarlos
como "próximamente" — pendiente de decidir con backend, anotado también en
`../backend/ROADMAP-BACKEND.md`.

## Tipos de empleado y permisos en lenguaje de negocio (2026-07-26)

> Decisión de producto del humano: *"su negocio, sus reglas"* — que haya
> roles para escoger rápido, pero que después el dueño pueda mover
> permiso por permiso, y en un lenguaje que le diga algo a él y no al que
> programó el modelo.
>
> **Cambio solo de frontend.** No toca el backend ni el contrato: las
> capacidades ya existían, lo que cambia es cómo se eligen y cómo se
> explican.

### Por qué esto no contradice "capacidades, no roles fijos"
La regla registrada prohíbe un enum cerrado de roles que gobierne los
permisos. Acá el rol es una **plantilla de arranque que no se guarda en
ningún lado**: precarga interruptores y deja de existir. La fuente de
verdad siguen siendo las capacidades de cada membresía — que es
exactamente lo que hace posible la segunda mitad de la frase del humano.
Si el rol se guardara, habría que resolver qué pasa con los empleados ya
asignados cuando la plantilla cambia, y el dueño terminaría peleando con
una plantilla en vez de configurando a su gente.

### Módulos nuevos en `src/permisos/`
- **`catalogo.ts`** — la traducción de cada capacidad a lenguaje de
  negocio (`etiqueta` = lo que la persona hace en el local,
  `consecuencia` = qué significa en la práctica) y el agrupamiento en
  Dinero / Agenda / Equipo. Es un `Record<Capacidad, …>` con `Capacidad`
  derivado del schema: **si el backend agrega una capacidad, esto deja de
  compilar** hasta que alguien decida cómo se le explica al usuario. Una
  capacidad sin traducir sería un interruptor sin nombre.
- **`roles.ts`** — las cuatro plantillas (Barbero o estilista, Recepción,
  Encargado, Administrador) y `rolDe()`, que **deduce** el tipo mirando
  las capacidades reales y reporta a cuántos interruptores está del más
  cercano. Eso permite mostrar "Recepción · 2 cambios" en vez de un
  "Personalizado" que no dice nada. Empates se resuelven por el rol más
  acotado (`ROLES` va de menos a más permisos).
- **`reglas.ts`** — `motivoBloqueo()`, que espeja `CONTRATO.md` 5.9.
  Devuelve **el motivo en texto**, no un booleano, para poder explicarlo
  donde ocurre — que es la mitad del punto de este rediseño.

### Pantalla nueva: Configuración › Permisos
Se eligió pantalla aparte sobre editar en la ficha del empleado (decisión
del humano), por el valor de comparar a todo el equipo de un vistazo.
Como la matriz no cabe en un teléfono y esto es una app Capacitor, es
responsive de verdad y no un `overflow` con la esperanza de que se
entienda:
- **`lg` en adelante**: matriz `<table>` con los permisos como filas
  agrupadas por área, las personas como columnas, y la primera columna
  fija al hacer scroll horizontal. Fila de "tipo de empleado" arriba.
- **Teléfono**: se elige una persona y se ven sus permisos agrupados, con
  la línea de consecuencia bajo cada uno.

Los interruptores bloqueados llevan `Tooltip` con el motivo concreto.
Guardado optimista con reversión si el `PATCH` falla: mover un
interruptor y esperar al servidor para verlo moverse se siente roto,
sobre todo al ajustar varios seguidos.

### Equipo deja de editar permisos
Para no tener dos pantallas que hacen lo mismo y se contradicen, la ficha
del empleado pasa a mostrar un **resumen de solo lectura** (el rol
deducido + la lista de lo que puede hacer) con un enlace a Permisos. El
alta gana el selector de tipo de empleado como tarjetas de radio, con la
aclaración de que es un punto de partida.

### `puede_cobrar` y `puede_ver_reportes` ahora dicen la verdad
Llevan un chip **"Pronto"**: siguen siendo configurables —el dueño puede
dejarlos listos— pero ya no se presentan como si hicieran algo. Cierra en
la dirección honesta la duda abierta 6 de `../ROADMAP.md`, que era
precisamente que la UI los mostraba como funcionales cuando ningún
endpoint los exige todavía.

### Cambio menor en el sistema de diseño
`SelectCustom` gana `etiquetaOculta`, que deja la etiqueta para lectores
de pantalla y la esconde visualmente. Hacía falta en la matriz, donde la
columna ya dice de quién es el control y repetirlo lo haría ilegible.
`npm run iconos` regenerado por el icono `settings` (43 iconos).

### Tests
15 nuevos en `src/permisos/roles.test.ts` (32 en total): que todas las
capacidades estén en algún grupo y en uno solo, la deducción exacta y
aproximada del rol, la pluralización de "cambios", y las cuatro ramas de
`motivoBloqueo` — incluida la que más fácil se implementa mal, que
**quitar** un permiso que uno no tiene sí está permitido.

Un test falló al escribirlo y **tenía razón el código**: el caso que
elegí para "2 cambios" quedaba en realidad a 1 cambio de Encargado. Se
cambió el caso de prueba, no la implementación.

### Duda abierta
El conjunto de cuatro roles salió de la lectura del dominio
(`../ESTRATEGIA-COMPETITIVA.md`: comisión, alquiler de silla), no de
hablar con barberías. Revisarlo en las visitas pendientes (duda abierta 4
de `../ROADMAP.md`) — sobre todo si hace falta un tipo específico para el
barbero que alquila silla y maneja su propia plata.

## Shell por tipo de usuario y UI de cargos (2026-07-26)

> Reemplaza la entrada anterior del mismo día ("Tipos de empleado y
> permisos en lenguaje de negocio"): el humano decidió que los roles en
> el frontend habían sido precipitados y que los cargos van en el
> backend. Ver `../CONTRATO.md` 5.10 y `../backend/ROADMAP-BACKEND.md`.

### Qué sobrevivió y qué se fue
Sobrevive `catalogo.ts` —el lenguaje de negocio de cada permiso y su
agrupación en Dinero / Agenda / Equipo—, que era la parte que más costó y
la que el humano quería. Se fueron `roles.ts` (plantillas hardcodeadas),
`reglas.ts` (absorbido) y `ConfiguracionPermisosPage.tsx` (la matriz por
persona). El reemplazo es más chico, no más grande.

### `shell.ts`: el discriminador de dominio en acción
El backend manda `tipo` y de ahí sale la **forma de la app**: qué
navegación existe y dónde aterriza la persona al entrar.

| tipo | inicio | navegación |
|---|---|---|
| `administracion` | `/` | Inicio, Agenda, Servicios, Equipo, Cargos |
| `recepcion` | `/agenda` | Inicio, Agenda, Servicios, Equipo, Cargos |
| `operativo` | `/agenda` | Inicio, Agenda |

La división de trabajo, que es lo que pidió el humano:
- **`tipo` decide la forma** — se resuelve una vez, no por pantalla.
- **las capacidades deciden las acciones** — los botones dentro.

`Layout` ya no arma la navegación: la lee de `shell.navegacion`. `Login`
ya no navega a `/` a mano: redirige a `shell.inicio`, y como el guard de
la propia página lo hace al llegar la membresía, el destino se calcula en
un solo lugar. `RutaProtegida` también manda al `shell.inicio` en vez de
a `/` cuando alguien entra donde no le toca — para un operativo, `/` no
es su pantalla.

Al operativo se le recorta la navegación a propósito: Servicios y Equipo
le son de solo lectura o directamente 403, y llenarle la barra inferior
de secciones ajenas le esconde la que sí usa.

### `usePermisos()`: un solo lugar donde se atraviesa el cargo
Antes cada pantalla leía `membresia.puede_x`. Con las capacidades en el
cargo eso serían siete `?.` repartidos por el código. El hook expone
`puede(capacidad)` y `shell`, y es lo único que las pantallas tocan.

### Pantalla de Cargos
Reemplaza a la matriz por persona. Una tarjeta por cargo con sus permisos
agrupados, y **cuánta gente lo tiene** — que es la contrapartida de que
el cargo sea la única fuente de verdad: editar uno alcanza a todos, y eso
hay que decirlo antes, no después. Se puede crear (eligiendo con qué
pantalla arranca su gente), renombrar, y borrar solo si está vacío.

Los interruptores bloqueados explican por qué al pasar el cursor,
espejando las dos reglas del backend: no ampliar el cargo propio, no dar
lo que uno no tiene. **Recortar sí se permite**, incluso sobre el propio,
así que solo se bloquea encender.

### Equipo
Deja de editar permisos: asigna un **cargo** (un select) y muestra qué
puede hacer quien lo tenga. El alta pide cargo en vez de siete
interruptores, con enlace a Cargos si ninguno le queda. El badge "Admin"
sale de `cargo_detalle.tipo`, no de contar flags.

### Tests
9 nuevos en `src/permisos/shell.test.ts` (26 en total). Cubren la
completitud del catálogo, que cada tipo tenga traducción, el inicio y la
navegación de cada shell, que las capacidades sigan recortando dentro del
shell, y dos invariantes que son fáciles de romper en un refactor: sin
`tipo` se cae al shell **más acotado** (mostrar de menos es la falla
segura) y **todo shell arranca en una ruta que él mismo tiene** — un
inicio fuera de la navegación deja al usuario donde no puede volver.

### Duda abierta
Los tres `tipo` están fijos en el backend y el frontend tiene un shell
por cada uno. Es lo que permite el routing eficiente, pero significa que
un negocio puede inventar cargos, no experiencias. Si aparece un caso
real que no encaja en administración/recepción/operativo, hay que
agregarlo en los dos lados a la vez.

### Ajuste posterior: las tarjetas de cargo se pliegan (2026-07-26)

Al ver la pantalla funcionando, el humano notó que siete interruptores
por cargo, todos abiertos, "asusta" de entrada. Tenía razón: con tres
cargos eran veintiún controles antes de haber decidido nada.

Ahora la tarjeta muestra plegada lo que se necesita para **reconocer** el
cargo —nombre, tipo, cuánta gente lo tiene y **chips con lo que
concede**— y se despliega para verlo y cambiarlo. Los chips usan un campo
`corto` nuevo en `DEFINICIONES` ("Cobrar", "Precios", "Agenda completa"):
la etiqueta completa no cabe en una fila y ahí no hace falta. Un cargo
sin capacidades dice "Solo atiende y maneja sus propias citas" en vez de
no mostrar nada, que se leería como un error de carga.

Detalles que no son obvios:
- **Una tarjeta abierta a la vez.** Con varias abiertas hay que hacer
  scroll para comparar cargos, que es justo lo que uno viene a hacer.
- Es un disclosure de verdad (`aria-expanded` + `aria-controls`), no un
  div que aparece: quien navega con lector de pantalla necesita saber que
  el botón abre algo y qué.
- El texto del botón cambia según se pueda editar o no ("Ver y cambiar
  permisos" vs "Ver permisos"), para no prometer lo que la capacidad no
  da.

Un test nuevo (27 en total) fija que todo permiso tenga `corto` no vacío
y de ≤16 caracteres: una cadena vacía dejaría un chip fantasma y una
larga rompería la fila.

## Tailwind 4 y tokens compartidos con la landing (2026-07-28)

> Rama `feature/frontend-sistema-diseno`. Sale de querer "elevar el
> diseño" y encontrar que no se podía hacer una sola vez: el repo tenía
> dos Tailwind incompatibles.

### El problema
`frontend/` estaba en Tailwind 3.4 (config en JS) y `landing/` en 4.3
(config en CSS). Son majors incompatibles: v4 movió la configuración a
CSS y cambió el motor. Mientras fueran dos proyectos sin nada en común no
dolía, pero compartir tokens —que es exactamente lo que "elevar el
diseño" implica— obliga a unificar primero, o el sistema de diseño se
construye dos veces y se desincroniza dos veces.

Y ya se había desincronizado: la landing dibujaba las pantallas simuladas
con `--color-app-primary: #091426` cuando la app hacía rato usaba
`#1e1b4b`, bajo un comentario que pedía mantenerlos sincronizados a mano.
El visitante veía un producto que no era el que se encontraba al
registrarse.

### Qué se hizo
- **`frontend/` migrado a Tailwind 4.3**: se borraron
  `tailwind.config.js` y `postcss.config.js`; la configuración vive ahora
  en `@theme`. Tailwind se carga por `@tailwindcss/vite` y no por
  PostCSS — es el camino recomendado en v4 y es el que ya usaba la
  landing. Tener el mismo pipeline en los dos es la mitad de poder
  compartir tokens.
- **`design/tokens.css` en la raíz del repo** como fuente de verdad
  única, importada por `frontend/src/index.css` y por
  `landing/src/styles/global.css`. Vive en la raíz y no dentro de uno de
  los dos porque ninguno es dueño del otro.
- **La landing dejó de copiar tokens.** Sus nombres de marketing
  (`lienzo`, `superficie`, `borde`, `shadow-tarjeta`) y los `app-*` de
  las pantallas simuladas pasaron a ser **alias** —
  `--color-lienzo: var(--color-background)` — en vez de valores propios.
  El sitio conserva su vocabulario y pierde la copia: si el producto
  cambia de color, los mockups cambian con él.
- **Tipografía**: Inter + Montserrat → **Plus Jakarta Sans**, la misma de
  la landing. Autoalojada vía `@fontsource`, subset `latin`.

### `@theme static`, y por qué no `@theme` a secas
Por defecto Tailwind 4 solo emite la variable de un token si alguna
utilidad generada la usa. Un alias (`var(--color-background)`) **no
cuenta como uso**: `--color-background` quedaba fuera del CSS compilado y
el `var()` de la landing resolvía a nada. Con `static` se emiten todos.

Cuesta **+0,27 kB gzip** en el frontend (10,24 → 10,51 kB). Es el precio
de que los alias funcionen; barato comparado con volver a tener dos
copias.

Está anotado dentro de `tokens.css`, porque alguien que "limpie" ese
`static` rompe la landing sin tocarla y sin que nada falle en compilación.

### Los mockups de la landing ahora usan los estados reales
Los badges de cita del `Telefono3D` usaban `app-secondary-fixed` y
`bg-green-100` — colores que no salían de ningún lado. Pasaron a
`bg-agendada/15 text-agendada` y equivalentes, que es literalmente lo que
pinta `src/ui/EstadoCita.ts`. Se eliminaron de la landing los tokens M3
`*-fixed` que no tienen equivalente en la paleta nueva.

### Verificación
No basta con que compile: un alias roto no falla el build, deja el color
vacío. Se verificó **contra el CSS compilado** que los 15 alias `app-*` y
los de marca resuelven a un token realmente emitido, con su valor. Mismo
criterio que la nota de mantenimiento de `../landing/ROADMAP-LANDING.md`
sobre la clase `hide-scroll` que no existía.

`frontend`: build limpio, 27 tests en verde. `landing`: `astro check` con
0 errores, build limpio.

### Documentación corregida
`CLAUDE.md` decía que la fuente de verdad era `tailwind.config.js` (que
ya no existe) y que las fuentes eran Inter + Montserrat. Corregido, junto
con el comentario de `src/ui/cn.ts`.

También se **precisó la regla sobre shadcn/ui**, que decía "no shadcn
completo" y se leía como prohibición total. La distinción que importa:
shadcn no es una dependencia sino código Radix + Tailwind que se copia, y
este proyecto ya usa Radix y Tailwind. Copiar una implementación y
re-estilarla con nuestros tokens es compatible y ahorra trabajo; correr
`npx shadcn init` no lo es, porque trae su propio vocabulario de
variables CSS que convive mal con el nuestro y `cn()` no sabría cuál gana.

### Pendiente / propuesto, no hecho
Ideas evaluadas para elevar el diseño, ordenadas por valor/costo. Ninguna
implementada todavía:
1. **View Transitions API** — nativa, cero dependencias, funciona en el
   WebView de Capacitor. Es lo que hace que navegar se sienta nativo. El
   mayor salto por el menor costo.
2. **Una pasada de estados vacíos, de carga y de error** con ilustración
   y copy propio. Hoy son `SkeletonLista` y `EstadoError` genéricos. No
   es una librería, pero mueve más la aguja que las cuatro de abajo
   juntas.
3. **Vaul** (bottom sheets) — el modal de Radix no es el idioma móvil;
   una hoja que sube desde abajo sí. Encaja con Radix, que ya se usa.
4. **NumberFlow** — números animados en las métricas del dashboard.
5. **Lenis** (scroll suave) — **solo landing**; en móvil pelea con el
   scroll nativo.

Descartado explícitamente:
- **Paper Shaders en la app del staff.** Compilar un shader cuesta GPU y
  batería en el arranque. Detrás de un hero que se ve una vez, vale;
  detrás de la pantalla donde un barbero mira su día veinte veces, no.
  Si se usan en la landing, tienen que respetar `prefers-reduced-motion`.
- **Cualquier fuente por CDN** (Fontshare incluida). Esto es Capacitor:
  una fuente remota se rompe sin conexión y agrega una petición a un
  tercero en el arranque. Si se cambia de tipografía (Satoshi o General
  Sans serían un upgrade real), se autoaloja igual que la actual.

A verificar antes de instalar nada: el proyecto está en **React 19.2**.
Blossom y Paper Shaders hay que probarlos ahí; si alguno no lo soporta,
Embla es el reemplazo maduro para el carrusel.

### Duda abierta
El carrusel (Blossom/Embla) y los shaders se evaluaron para el **perfil
público del negocio**, que es Fase 2 y del lado del visitante, no del
staff. Queda por decidir si el perfil público se construye dentro de
`frontend/` (comparte auth y componentes, pero carga el bundle de la app
a un visitante que no la necesita) o en `landing/` (Astro, estático,
mucho más liviano para algo que se ve una vez). La decisión cambia qué
librerías tienen sentido.

## Fase 2: perfil público y reserva sin cuenta (2026-07-28)

> Rama `feature/frontend-sistema-diseno`. Retoma Fase 2 tras cerrar el
> sistema de diseño compartido (entrada anterior). Backend ya tenía los
> cuatro endpoints públicos construidos; acá se consumen por primera vez.

### Cambio de alcance decidido antes de escribir código
El texto original de Fase 2 (`../CLAUDE.md`) incluía "búsqueda de
negocios por parte del cliente" como parte del MVP. El humano lo corrigió:
el reemplazo real de "llamar o escribir por WhatsApp" es el enlace único
que el dueño comparte (`turnio.app/{slug}`), no un marketplace donde el
cliente descubre negocios que no conoce — eso necesita densidad de oferta
que la plataforma no tiene todavía. Por eso esta sesión no construye
`/buscar`, aunque el endpoint `GET /api/publico/negocios/` sigue vivo del
lado backend para cuando llegue Fase 6+. Detalle completo en
`../ROADMAP.md` (decisión #8) y `../CLAUDE.md`.

### Bug de contrato encontrado antes de poder tipar nada
`NegocioPublico.servicios/profesionales/horario` estaban declarados
`type: string` en el schema (faltaba `@extend_schema_field` sobre los
`SerializerMethodField`). No se pudo asumir la forma real "porque se leyó
el serializer": se cruzó a backend a pedir el arreglo, se regeneró el
contrato, y solo entonces se tipó el cliente. Ver
`../backend/ROADMAP-BACKEND.md` y `../CONTRATO.md` historial.

### `src/api/publico.ts` — cliente aparte, sin cabecera de auth
No es el mismo `apiClient` de siempre con otra base URL: ese cliente
adjunta `Authorization` si hay un token en `localStorage`, y DRF
autentica antes de evaluar permisos. Un token vencido de una sesión de
staff anterior habría hecho que un endpoint `AllowAny` respondiera `401`
— justo para la única persona que ya conoce el producto (el dueño
mirando su propio perfil). El comentario en el archivo explica el porqué.

### `PerfilNegocioPage` (`/:slug`)
Header (nombre, ciudad, dirección, teléfono con `tel:`, botón compartir
con `navigator.share` y fallback a copiar el enlace), servicios (con
precio en COP y botón "Reservar" por servicio), equipo (avatares con
iniciales — no hay foto: ver pendiente abajo) y horario por día. Estados
de carga (skeleton), error (negocio inactivo o inexistente, copy propio
en vez de un 404 genérico) y vacío (catálogo sin servicios) con
`EstadoVacio`/`EstadoError`/`Skeleton` ya existentes — no hizo falta
inventar componentes nuevos, solo el copy específico de este flujo.

### `ReservaHoja`: el flujo de reservar, en una hoja de Vaul
Fecha → horas disponibles (fetch a `disponibilidad` en cada cambio de
fecha) → profesional opcional ("Cualquiera disponible" por defecto,
igual que el backend) → datos (nombre, teléfono, notas) → confirmar.

- **Vaul, no `Modal`.** Es la primera vez que se usa: `Modal` (Radix
  Dialog) ya parece una hoja en móvil por CSS, pero no se puede arrastrar
  para cerrar. Vaul agrega el gesto real. Encapsulado en `src/ui/Hoja.tsx`,
  mismo API que `Modal` (`abierta`, `onCerrar`, `titulo`, `descripcion`) a
  propósito, para que cambiar de uno a otro sea un cambio de una línea si
  hace falta en el futuro.
- **El mensaje de "hueco ocupado" es el que ya devuelve el backend**, no
  uno inventado: `ReservarView` es deliberadamente genérico ("Ese
  horario ya no está disponible. Elige otro.") para no distinguir "se
  acaba de ocupar" de "nunca estuvo disponible". Se repite el mismo texto
  en el frontend en vez de parsear el `400` — con datos ya validados en
  el cliente, esa es la única causa realista.
- **Tras un 400, se refresca la disponibilidad** (`cargarHuecos()`): el
  hueco que se acaba de perder no debe seguir apareciendo como elegible.
- Distingue error de conexión (mensaje de "revisa tu internet") de error
  del servidor (mensaje del backend) — son causas distintas y
  confundirlas hace perder tiempo a quien reintenta el mismo hueco que ya
  se ocupó.

### Reestructura de rutas + code-splitting
`/:slug` se agregó como ruta pública (fuera de `RutaProtegida`), al final
— React Router ya prioriza segmentos literales (`/login`, `/agenda`…)
sobre uno dinámico, así que el orden no cambia el comportamiento, pero
refleja que es el catch-all que `SLUGS_RESERVADOS` protege del lado
backend.

Se aprovechó para partir el bundle: cada pantalla (`DashboardPage`,
`ServiciosPage`, `AgendaPage`, `EmpleadosPage`, `ConfiguracionCargosPage`,
`LoginPage`, `RegistroNegocioPage`, `PerfilNegocioPage`) pasó a
`React.lazy` + un único `<Suspense>` en `App.tsx`. Antes un visitante que
abría `/{slug}` bajaba el bundle completo del panel del staff (formularios
de Agenda, calendario, gestión de equipo…) sin usar nada de eso. El chunk
principal bajó de **519 kB a 297 kB**; `PerfilNegocioPage` quedó en su
propio chunk de 40 kB (incluye Vaul). `Layout` y `RutaProtegida` se
dejaron eager a propósito: son la cáscara que comparten todas las
pantallas de staff, no el peso que había que separar.

### View Transitions API
`viewTransition` en los `NavLink` de `Layout` (desktop y bottom nav
móvil) — nativo, sin dependencias nuevas. El cross-fade por defecto del
navegador (~250ms) ya encaja con la regla del proyecto de no pasarse de
ese tiempo en interacciones. Único cuidado: los pseudo-elementos
`::view-transition-*` no son parte del árbol normal del documento, así
que el bloque global de `prefers-reduced-motion` en `index.css` (que usa
`*`) no los alcanzaba — se agregó una regla aparte para ellos, comentada
en el archivo para que no se pierda por qué hace falta un bloque
"duplicado".

### Verificación: no solo tipos, no solo mocks
Además de `tsc -b` + `vitest`, se corrió el flujo completo contra un
backend real (`docker compose up`): se registraron dos negocios, se les
cargó servicio y horario, se pidió disponibilidad real y se reservó dos
veces el mismo hueco para confirmar el `400`. Encontró un caso que los
tests con mocks no podían mostrar — ver "Refinamiento" en
`../backend/ROADMAP-BACKEND.md` (rutas reservadas del SPA). Los negocios
de prueba se borraron al terminar.

### Tests
5 nuevos en `src/pages/publico/PerfilNegocioPage.test.tsx` (32 en el
proyecto, antes 27): render de los datos reales, estado de error con
copy propio, estado vacío del catálogo, el flujo completo de reserva
(botón deshabilitado hasta tener hora + nombre + teléfono, confirmación
con los datos que devuelve el backend), y el caso de hueco ocupado con
refetch. Es el primer test del proyecto que mockea el cliente HTTP
(`vi.mock("../../api/publico")`) — no había precedente porque hasta
ahora ningún componente probado hacía fetch directo.

### Pendiente / a medio hacer
- **No hay ningún campo de imagen** en `Negocio` ni `Servicio` (logo,
  portada, fotos). Bloquea tanto el `og:image` del enlace compartido
  como cualquier futuro carrusel de fotos en el perfil. Es de backend
  (modelo + storage), anotado también en `../ROADMAP.md` decisión #8.
- **`formatearPrecio`/`MONEDA` (COP) se volvió a duplicar** — ya estaba
  en `ServiciosPage.tsx` y `ModalCatalogo.tsx`, ahora también en
  `PerfilNegocioPage.tsx`. Candidato claro para extraer a un helper
  compartido en una pasada de limpieza; no se tocó en esta sesión para
  no mezclar refactor con feature nueva.
- **Sin cancelación ni consulta de la cita reservada**: la respuesta de
  `reservar` es deliberadamente magra (ver `../CONTRATO.md` 5.11) y no
  lleva `id`. Cuando haga falta, es un token en el enlace de
  confirmación, no una cuenta — decisión ya tomada, solo falta construirla.
- **`ReservaHoja` no valida el formato del teléfono** más allá de "no
  vacío". El backend tampoco lo valida (`CharField` libre). Si en el uso
  real llegan números mal escritos, hay que decidir el formato esperado
  en los dos lados a la vez.
- Quedó pendiente (no bloqueante) evaluar **Vaul con snap points** para
  la hoja de reserva en pantallas grandes — hoy ocupa el mismo layout
  fijo en cualquier tamaño; funciona pero no aprovecha el espacio extra
  en tablet/desktop.

### Pendiente del paquete visual más amplio (fuera de esta sesión)
Se evaluaron y quedaron fuera a propósito, documentadas también en la
entrada anterior de este roadmap: NumberFlow (dashboard), Lenis (solo
landing), y la pasada de estados vacíos/error con ilustración propia
(hoy siguen siendo genéricos, solo con copy distinto por pantalla).

## Perfil del negocio: logo, galería y drift de contrato cerrado (2026-07-28)

> Rama `feature/backend-fase2-imagenes-negocio` (la misma del backend: la
> hizo la misma persona, y el drift de `schema.ts` obligaba a cerrar los
> dos lados en el mismo commit). Retoma los 4 pasos de frontend que
> quedaron escritos en `../backend/ROADMAP-BACKEND.md`.

### El drift de contrato quedó cerrado
`src/api/schema.ts` regenerado contra el `openapi.yaml` nuevo **y**
`puede_editar_negocio` traducida en `catalogo.ts`, en el mismo commit.
Confirmado en el camino que el mecanismo funciona como se diseñó: al
regenerar, lo único que dejó de compilar fue el `Record<Capacidad, …>` de
`DEFINICIONES` — el compilador señaló exactamente la línea que había que
atender, ni una más. El CI de frontend vuelve a verde.

La capacidad se presenta como **"Cambiar cómo se ve el negocio"** (corto:
"Perfil"), en un área propia del catálogo —"Perfil del negocio"— y no
dentro de "Equipo": lo que el cliente ve del local no es organización
interna.

### Qué se construyó
- **`src/api/multipart.ts`** — `cuerpoMultipart<T>()`. OpenAPI no expresa
  "acá va un archivo" (un `ImageField` viaja como `type: string, format:
  uri`, que es la forma de salida), así que toda subida choca con el tipo
  generado. El cast queda en un solo lugar. Ver `../DECISIONES.md` #8.
- **`ConfiguracionNegocioPage`** (`/configuracion/negocio`, gateada por
  `puede_editar_negocio` en la ruta y en la navegación): enlace público
  con copiar/ver arriba de todo, logo (subir, cambiar, quitar), datos del
  negocio y galería con subir, borrar y reordenar.
- **Navegación con entradas secundarias** — `ItemNav.secundaria`. La
  barra inferior de móvil ya estaba en cinco entradas y esta habría sido
  la sexta; lo secundario vive ahora en el menú de cuenta. Hay un test
  que fija el techo. Ver `../DECISIONES.md` #10.
- **Perfil público**: el `Avatar` del encabezado usa el logo real (cae
  solo en las iniciales si no hay), y arriba de Servicios hay un carrusel
  de fotos.
- **Tests**: 36 en verde (venían 32). Nuevos: el carrusel no aparece sin
  fotos, aparece con el orden que mandó el backend, el gating de la
  entrada nueva y el techo de la barra inferior.

### Decisiones tomadas acá (detalle completo en `../DECISIONES.md`)
- **Carrusel con `scroll-snap` nativo, sin librería** — se descartó
  Blossom, que venía evaluada de la sesión anterior. Diez fotos como
  máximo y el gesto lo hace mejor el navegador. Lo que sí hubo que
  agregar a mano es lo que la librería habría dado gratis: `tabIndex` y
  `role="group"` con etiqueta para el acceso por teclado.
- **Los límites (10 fotos / 5 MB) se duplican en el cliente** como
  cortesía —no hacerle subir 8 MB por datos móviles a alguien para
  después decirle que no—, con el backend como única autoridad.
- **Reordenar es optimista**: mueve la lista local, manda la galería
  completa (el endpoint no acepta parciales) y revierte si falla.
- Tras guardar los datos se llama `refrescarMembresia()`: el nombre del
  negocio se ve en la cabecera y en la barra lateral, y sin eso quien lo
  cambia seguía viendo el viejo hasta recargar.

### Verificado contra el backend real
No solo contra mocks: se registró un negocio, se subió logo y dos fotos
por `multipart`, se invirtió el orden y se comprobó que el perfil público
devuelve URLs absolutas y que `GET /{slug}/` emite el `og:image` correcto
con `twitter:card: summary_large_image`.

### Pendientes que deja
- **Sin recorte ni compresión de imagen en el cliente.** Se sube el
  archivo tal cual: un logo rectangular se ve recortado por
  `object-cover`, y una foto de 4 MB viaja completa. Un recorte previo
  (canvas) mejoraría las dos cosas; hoy el límite de 5 MB es lo único
  que hay.
- **Reordenar es con flechas, no arrastrando.** Funciona con teclado y
  es accesible sin trabajo extra, pero en móvil arrastrar sería lo
  natural. Si se hace, que sea sin perder el camino por teclado.
- **`formatearPrecio`/`MONEDA` sigue duplicado** en tres pantallas (ver
  entrada anterior); esta sesión no lo tocó tampoco.
- **"Cargos" sigue en la barra inferior** aunque es tan secundario como
  el perfil del negocio. Moverlo es cambiarle la navegación a quien ya
  la conoce: merece decidirse aparte.
