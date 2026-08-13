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

## Tematización por negocio: temas, color y portada (2026-07-28)

> Misma rama y misma sesión que la entrada anterior. El pedido era
> acercarse a cómo Goldie deja personalizar la página del negocio.

### Qué se construyó
- **`src/tema/colores.ts`** — luminancia WCAG, contraste, el color de
  texto que va encima del acento, el aviso al dueño y los ocho presets.
  **Sin librería de color**: los tonos derivados los hace el navegador
  con `color-mix(in oklch, …)`. Ver `../DECISIONES.md` #12.
- **Perfil público tematizado** — el color se aplica en el contenedor del
  perfil, nunca en `:root` (es el mismo bundle que sirve el panel del
  staff). La hoja de reserva de Vaul necesita las variables aparte
  porque se monta en un portal fuera de ese árbol.
- **Dos temas** (`estandar`, `vitrina`) como **composiciones** de las
  mismas secciones, que se extrajeron a `publico/secciones.tsx`. Un tema
  desconocido cae en `estandar` en vez de romper la página.
- **Panel**: selector de tema con miniaturas dibujadas en CSS, selector
  de color (presets + `react-colorful`) con vista previa y aviso de
  contraste, y subida de portada.
- **Firma "Turnio" fija** al pie del perfil, sin interruptor
  (`../DECISIONES.md` #17).
- 51 tests en verde (venían 36).

### Dependencia nueva: `react-colorful`
2 KB, accesible por teclado. Justificación: un picker a mano es trabajo
real y el `<input type="color">` nativo se comporta distinto entre el
WebView de Android y el de iOS, que es exactamente el escenario de esta
app. Se evaluaron y **descartaron** `chroma-js` y `culori` (ver arriba).

### Hallazgo de accesibilidad sobre el propio sistema de diseño
Al escribir la validación de contraste quedó a la vista que la menta de
Turnio (`#10b981`) da **2.54** contra blanco: el botón primario del panel
(`bg-menta text-white`) está por debajo de WCAG AA, y ni siquiera llega
al mínimo de 3 para elementos de interfaz. **No se tocó**: cambiar el
color de marca afecta a la app y a la landing y es una decisión de
producto, no un arreglo al pasar. Queda como pendiente explícito, y el
preset "Menta" del selector usa `#047857` (5.48) en vez del color de
marca justamente por esto.

### Pendientes que deja
- **El color de marca de Turnio no pasa AA** (arriba). Es la deuda más
  grande que abre esta sesión.
- **Nadie redimensiona ni recorta las imágenes** en el cliente (ya venía
  de la entrada anterior; con la portada pesa más, porque en Vitrina
  ocupa la primera pantalla).
- **Solo dos temas.** La arquitectura aguanta más, pero cada uno es
  diseño y mantenimiento real.
- `temas.tsx` y `secciones.tsx` disparan el warning de `oxlint` sobre
  fast refresh (mezclan componentes y constantes exportadas), igual que
  `AuthContext.tsx` y `Toast.tsx`. Se dejó así a propósito: separar el
  catálogo de la implementación haría que agregar un tema toque dos
  archivos, que es justo lo que la organización actual evita.

### Nota: la suite dependía de la zona horaria de la máquina (2026-07-28)
El CI del PR #5 destapó dos tests del perfil público en rojo que pasaban
en local: comparan horas ya formateadas (`"09:00"`) contra un instante
UTC, así que solo pasaban en una máquina configurada en `America/Bogota`
y fallaban en el runner, que corre en UTC. Es un bug latente anterior a
esta tanda; no se había visto porque el CI de frontend venía fallando
antes de llegar al paso de tests, por el drift de `schema.ts`.

Se arregló fijando `process.env.TZ = "America/Bogota"` en el ámbito de
módulo de `vite.config.ts` — antes de que Node arranque los workers y
cachee la zona, que es por lo que no sirve ponerlo en `test.env`. Es
además la zona del backend (`TIME_ZONE`), así que la suite corre en la
misma que el producto. Verificado con `TZ=UTC npx vitest run`.

## Plantillas por rubro: barbería, spa y clínica (2026-07-28)

> A partir del material de `stitch_booking_page_ui_system/` (tres
> plantillas de Stitch con su `DESIGN.md`).

### Qué cambió, y por qué fue más que "tres paletas"
Las plantillas anteriores (`estandar`/`vitrina`) eran composiciones con
la paleta de Turnio. Estas tres son **diseños completos**, y la de
barbería es **modo oscuro** — con lo cual todo componente del perfil que
usara un token fijo (`bg-white`, `text-primary`) ahí desaparecía o
deslumbraba.

Eso obligó a lo que era el trabajo real de esta tanda: una capa de tokens
semánticos propios del perfil (`--color-perfil-*`, `--radius-perfil`,
`--font-perfil-titulo`, declarados en `src/index.css`) y la reescritura de
`secciones.tsx` contra ellos. La regla queda escrita en la cabecera de ese
archivo: **ningún color de Turnio dentro del perfil público**.

- **`src/tema/plantillas.ts`** — el catálogo: paleta, radios, tipografía,
  portada de muestra y estilo de tarjeta por plantilla, más el degradado
  ante un tema desconocido.
- **Una sola composición** para las tres (enfoque "Themed Core" del
  `DESIGN.md`). Se borró `publico/temas.tsx`.
- **La hoja de reserva** adopta la plantilla: superficie, radio superior
  y chips de hora con el primario del negocio. Como vive en un portal
  fuera del árbol del perfil, hay que volver a declararle las variables.
- **Portadas de muestra** en `public/plantillas/*.webp` (1,7 MB → 42–85
  KB al convertir a WebP), con aviso visible "Foto de muestra".
- **Serif de barbería** con `import()` dinámico: quien abre un spa no la
  descarga.
- **Selector del panel** rehecho: cada opción se pinta con las variables
  reales de su plantilla, así que no puede desincronizarse del perfil.
- Se borró `variablesDeTema()` de `colores.ts`, que quedó sin uso.
- 50 tests en verde.

### Pendientes que deja
- **Solo tres plantillas, y una composición.** Si algún rubro pide otra
  disposición (y no solo otra paleta), hay que decidir si se vuelve a
  separar el eje layout — ver `../DECISIONES.md` #16, que esta tanda
  revierte en parte.
- **Las portadas de muestra son fotos genéricas.** Están marcadas como
  tales en la página, pero un negocio que nunca sube la suya se ve igual
  que otro del mismo rubro.
- **`FONDO_POR_TEMA` en el backend duplica un color de acá.** Ningún test
  puede verificar que coincidan; está anotado en los dos archivos.

## Arreglo de layout: el perfil público en pantallas grandes (2026-07-28)

> Reportado por el humano viendo la plantilla de barbería en desktop:
> "el carrusel no se ve bien en pantallas más grandes".

Diagnóstico confirmado con capturas (Chrome headless contra el dev
server + backend real, no solo mirando el código): el encabezado usaba
ancho completo con `padding`, pero el contenido de abajo vivía en una
caja `max-w-2xl` **centrada**. En cualquier pantalla más ancha que
~800px eso desalineaba el título del resto del perfil y dejaba el
carrusel —angosto, con la barra de scroll nativa visible— flotando en
medio de un vacío enorme.

- Encabezado y contenido comparten `--width-perfil-contenido` (1200px,
  tomado del propio `DESIGN.md` de origen), un solo token para que sus
  bordes coincidan siempre.
- El carrusel es una grilla real desde `md` (no una tira de scroll
  angosta); en mobile sigue con `scroll-snap`, ahora con `hide-
  scrollbar`.
- Desde `lg`, servicios queda en una columna ancha y equipo/horario/
  contacto en una columna fija a la derecha, sticky.

**Bug encontrado al verificar visualmente, no al leer el código**: el
botón "Reservar" salía siempre verde sin importar la plantilla —
`Button`'s variante `negocio` seguía leyendo `--color-acento` (el token
de la tanda de "color único" anterior a las plantillas), que ya no
pinta nadie. Corregido a `--color-perfil-primario`. Ver
`../DECISIONES.md` #24.

Confirmado con capturas en barbería (1920/1280/834/390px) y en clínica
(el negocio de prueba estaba en ese tema al momento de verificar).

## Registro y validación de servicios realizados (2026-07-28)

> Pedido explícito del humano, fuera del orden de fases habitual: ver
> `../CONTRATO.md` 5.13 y `../DECISIONES.md` #25–#27 para el diseño y
> `../backend/ROADMAP-BACKEND.md` para el lado backend, entregado en la
> misma sesión.

- **`src/permisos/catalogo.ts`**: nueva capacidad `puede_aprobar_servicios`
  (grupo propio "Servicios realizados", separado de "Agenda" — operar el
  calendario no es dar fe de que un trabajo se hizo de verdad).
- **`src/ui/EstadoRegistroServicio.ts`**: badges de `pendiente`/`aprobado`/
  `rechazado`, mismo molde que `EstadoCita.ts` pero **reutilizando** los
  tokens de color ya existentes (`agendada`/`completada`/`cancelada`) en
  vez de crear unos nuevos en `../design/tokens.css` — evita tocar un
  archivo que también usa `landing/` para una necesidad que ya tenía
  color.
- **`/servicios/mios`** (`MisServiciosPage`, sin `capacidad`: cualquier
  miembro activo puede haber hecho un servicio, incluido el operador
  único): formulario para registrar (servicio del catálogo propio,
  cliente, teléfono opcional, fecha/hora con `<input type="datetime-
  local">` — **no** el `DateTimePicker` existente, que está acoplado a
  slots futuros de disponibilidad vía `huecos_disponibles` y no sirve
  para capturar un momento ya ocurrido — observaciones, evidencia
  opcional) + lista del propio historial con el motivo de rechazo
  visible cuando aplica.
- **`/servicios/validar`** (`ValidarServiciosPage`, `capacidad=
  "puede_aprobar_servicios"`): cola de pendientes con toggle a "Todos",
  aprobar por confirmación simple, rechazar por modal con motivo
  obligatorio (`<textarea required>` + validación propia para el caso
  de solo-espacios, que el `required` nativo no cubre).
- **Evidencia fotográfica sin dependencia nueva**: no había picker de
  fotos reutilizable ni `@capacitor/camera` instalado. Mismo patrón
  inline que `ConfiguracionNegocioPage` (input oculto + ref + chequeo
  de 5 MB en cliente + `cuerpoMultipart`), con `capture="environment"`
  para que el navegador móvil ofrezca la cámara sin plugin nativo.
- **Navegación** (`src/permisos/shell.ts`): dos ítems nuevos,
  declarados en las tres listas de `SHELLS` para que aparezcan sin
  importar el `tipo` del cargo (igual que `NEGOCIO`) — la capacidad
  decide, no el tipo. `MIS_SERVICIOS` tiene **dos variantes**: principal
  para `operativo` (es su pantalla más usada) y secundaria para
  `administracion`/`recepcion` (ahí la barra inferior de móvil ya tenía
  sus cinco entradas principales llenas — ver el comentario de
  `secundaria` en `shell.ts` — y cortar pelo no es el trabajo diario de
  quien administra). `VALIDAR_SERVICIOS` es secundaria en las tres:
  gateada por capacidad, no por tipo.
- Actualizados `shell.test.ts` (dos aserciones que asumían la lista
  exacta de rutas del shell operativo) y `permisos/catalogo.ts`; 50
  tests de Vitest en verde, `tsc -b` limpio.
- **Wart de contrato encontrado al regenerar tipos**: agregar un segundo
  campo `estado` (choices) en el schema —el de `RegistroServicio`, junto
  al ya existente de `Cita`— hizo que drf-spectacular renombrara el
  enum genérico `EstadoEnum` a `CitaEstadoEnum` (y el nuevo pasó a
  llamarse `RegistroServicioEstadoEnum`). Rompió `EstadoCita.ts` en
  build, no en tests — corregido ahí. Queda como recordatorio: agregar
  un segundo choices-enum en el backend puede renombrar un tipo
  generado que ya se estaba usando en otra pantalla, y solo `tsc -b`
  lo atrapa.
- **Verificado en vivo** (Chromium vía Playwright contra el dev server +
  backend real, dos sesiones de navegador con cuentas distintas — un
  barbero registrando, un dueño con la capacidad validando, para
  respetar la regla de no-autoaprobación del backend): registrar dos
  servicios, aprobar uno, rechazar el otro (primero sin motivo —
  bloqueado por validación nativa del navegador —, luego con motivo),
  confirmar que el barbero ve el estado y el motivo en su propio
  historial, y que "Validar servicios" no aparece en la navegación de
  un cargo sin la capacidad. Cero errores de consola.

### Pendiente
Ningún picker de fotos compartido todavía: si un tercer flujo necesita
subir una imagen, vale la pena extraer el patrón inline (ya se repite
tres veces: logo/portada del negocio, fotos de galería, evidencia de
servicio) a un componente de `src/ui/`.

## Filtros de consulta y registro a nombre de otro en servicios realizados (2026-07-28)

> Segundo pedido del humano sobre el mismo módulo, misma sesión. Ver
> `../CONTRATO.md` 5.13 y `../DECISIONES.md` #28–#29.

- **`src/pages/servicios/filtrosPeriodo.ts`**: cálculo de rango
  (día/semana/mes, semana empieza en lunes — mismo criterio que
  `DiaSemana.LUNES = 0` del backend y que `DIAS_CORTOS` en
  `AgendaPage`), navegación (`moverPeriodo`) y formato (`YYYY-MM-DD`
  para la API, etiqueta legible para la UI). Con tests propios
  (`filtrosPeriodo.test.ts`, 9 casos: límites de semana/mes, años
  bisiestos, cruce de año) — es justo el tipo de lógica "fácil de
  romper sin darse cuenta" que el criterio de testing del proyecto pide
  cubrir.
- **`src/pages/servicios/FiltroPeriodo.tsx`**: el control de UI (toggle
  Día/Semana/Mes + navegación con flechas + atajo "Hoy"), compartido
  entre `MisServiciosPage` y `ValidarServiciosPage` — ambas necesitan
  exactamente el mismo cálculo, así que vive una sola vez.
- **Filtro de estado pasa de 2 a 3 vías** en ambas pantallas:
  Pendientes / **Completados** / Todos. "Completados" es la etiqueta
  que pidió el humano — el valor que viaja a la API sigue siendo
  `aprobado` (ver `CONTRATO.md` 5.13); no valía la pena renombrar el
  enum del backend, ya usado en rutas (`.../aprobar/`) y tests, por una
  preferencia de copy en una sola pantalla.
- **`ValidarServiciosPage`** suma un filtro por barbero
  (`SelectCustom`, con "Todo el equipo" como opción para no filtrar),
  poblado desde `GET /api/negocios/equipo/` — mismo endpoint mínimo que
  ya usa `AgendaPage` para su selector de empleado, sin exponer email
  ni capacidades.
- **`MisServiciosPage`** gana dos cosas ligadas a la misma capacidad:
  - Un selector "¿Quién realizó el servicio?" en el formulario de
    registrar, **obligatorio y visible solo con
    `puede_aprobar_servicios`** — sin ella, el formulario no pregunta
    nada, sigue siendo siempre uno mismo.
  - Manda **siempre** `?empleado=<su propio id>` al listar, sin
    importar si tiene la capacidad — si no, un administrador vería en
    "Mis servicios" lo mismo que en "Validar servicios" (el backend le
    da visibilidad de todo el negocio con esa capacidad). Ver
    `../DECISIONES.md` #29.
  - Consecuencia: tras registrar, ya no se antepone el resultado a
    mano a la lista local — puede no ser "propio" (si se registró a
    nombre de otro) o caer fuera del período que se está mirando. Se
    recarga con `cargar()`.
- **Verificado en vivo** (mismo método que la tanda anterior: Chromium
  vía Playwright, dos sesiones — barbero sin selector de empleado,
  dueño con selector obligatorio): confirmado que el barbero no ve el
  selector, que el dueño no puede enviar sin elegir, que un registro
  hecho por el dueño a nombre de un barbero **no** aparece en el "Mis
  servicios" del propio dueño, que el filtro por barbero en "Validar
  servicios" funciona, y que el tab "Completados" muestra lo recién
  aprobado. Cero errores de consola. 59 tests de Vitest en verde
  (211 backend), `tsc -b` limpio.

## Refactorización Global de UI/UX (2026-08-01)

### Qué se completó
- **Layout Global & Sidebar (`Layout.tsx`)**:
  - Sidebar con fondo blanco `bg-white`, borde derecho sutil `border-r border-slate-200/80`.
  - Ítem de navegación seleccionado resaltado con píldora `bg-emerald-50 text-emerald-700 font-semibold` e indicador vertical izquierdo de 3px `bg-emerald-500`. Espaciado compacto `gap-1`.
  - Ancho de contenedor principal restringido a `max-w-6xl` centrado en pantalla.
- **Vista "Inicio" (Dashboard) (`DashboardPage.tsx`)**:
  - Tarjetas de métricas con borde suave `border-slate-200/80 rounded-2xl bg-white p-5 shadow-sm`, números grandes `text-3xl font-extrabold text-slate-900`, íconos en círculos tonales e indicadores de tendencia.
  - Banner "Agenda de hoy" en Azul Índigo `#1E1B4B` con esquinas `rounded-2xl` y llamado a la acción positivo cuando no hay turnos.
  - Accesos rápidos interactivos con hover micro-efecto e ícono en caja menta. Próximas citas con estado vacío de altura reducida (`min-h-[160px]`).
- **Vista "Agenda" (`AgendaPage.tsx`)**:
  - Selector de días con píldoras en Verde Esmeralda sólido (`bg-emerald-500 text-white shadow-sm shadow-emerald-200`) en día activo y bordes delgados en inactivos.
  - Filtro de empleados en formato **Segmented Control** compacto (`bg-slate-100 p-1 rounded-xl flex gap-1`).
  - Estado vacío de citas acotado con icono de calendario rodeado por aura verde menta y botón `+ Agendar cita` centrado.
- **Vista "Servicios" y Catálogo con Imágenes (`ServiciosPage.tsx`, `ModalCatalogo.tsx`, `catalogoServicios.ts`)**:
  - Incorporadas imágenes de alta resolución en `catalogoServicios.ts` vía `obtenerImagenServicio`.
  - Tarjetas de servicios enriquecidas con miniatura de imagen, precio destacado y distintivos de duración.
  - Estado vacío de servicios rediseñado en tarjeta blanca compacta con 2 opciones visuales claras (Elegir del Catálogo Prediseñado / Crear Servicio Personalizado).
  - `ModalCatalogo.tsx` actualizado para listar cada servicio sugerido con su miniatura fotográfica.
- **Vista "Perfil del Negocio" (`ConfiguracionNegocioPage.tsx`)**:
  - Selector de plantillas de diseño con tarjeta seleccionada en borde Verde Menta `border-2 border-emerald-500 ring-2 ring-emerald-500/20` y badge flotante **"Seleccionado"** en la esquina superior derecha.
  - Formulario de datos en **Grid de 2 columnas** (`grid grid-cols-1 md:grid-cols-2 gap-4`) con botón de guardar a la derecha.
- **Verificación**: 59 tests de Vitest en verde, `npx tsc --noEmit` sin errores.

## Ajuste fino contra specs de Stitch: Agenda y Servicios (2026-08-01)

> Continuación de la refactorización de arriba: el humano trajo mockups
> nuevos generados en Stitch (`agenda_turnio(_desktop)`,
> `servicios_turnio(_desktop)`, `inicio_turnio(_desktop)`,
> `perfil_del_negocio_turnio(_desktop)`) con un sistema de diseño nuevo
> ("Emerald Nordic": Hanken Grotesk + paleta Material 3 propia). Decisión
> del humano: **no** adoptar la fuente ni la paleta nuevas (se quedan
> Plus Jakarta Sans y los tokens actuales de `design/tokens.css`) — sí
> adoptar la estructura, densidad y jerarquía visual de cada pantalla,
> traducida a los tokens/clases que ya usa el proyecto.

- **`DashboardPage.tsx` y `ConfiguracionNegocioPage.tsx`** ya estaban
  muy cerca de los mockups por la refactorización anterior (mismo
  autor); no se tocaron hoy salvo una limpieza de imports sin usar en
  `DashboardPage.tsx`.
- **`AgendaPage.tsx`**: el estado vacío del día pasó del tratamiento
  compacto anterior (icono pequeño en tarjeta con borde) a uno más
  expresivo, calcado del mockup: aura radial `radial-gradient` detrás,
  círculo blanco flotante de 96px con el icono de calendario relleno en
  menta, y CTA en píldora `rounded-full` a ancho de botón (no de
  tarjeta).
- **`ServiciosPage.tsx`**: dos cambios de comportamiento, no solo de
  estilo:
  - El bento de arranque (Catálogo Prediseñado / Servicio
    Personalizado) **ahora es siempre visible**, no solo cuando el
    catálogo está vacío — en el mockup es el atajo más usado incluso
    con servicios ya cargados (agregar uno más desde el catálogo).
  - Las tarjetas de servicio con imagen grande pasaron a **filas
    horizontales compactas** (miniatura 56px + nombre + duración +
    precio + menú), que es el patrón de lista del mockup — la tarjeta
    vertical con imagen de banner que había quedó descartada para este
    catálogo con muchos ítems.
- **Iconos**: `auto_awesome` y `add_circle_outline` no existen en
  `@material-symbols/svg-400` con esos nombres exactos (el generador
  los descarta en silencio — ver `scripts/generar-iconos.mjs` — y
  `Icon` los habría renderizado vacíos). Se cambiaron a `stars` y
  `add_circle` respectivamente, que sí están en el set instalado.
  Si vuelve a pasar con un icono nuevo: `npm run iconos` avisa por
  consola qué nombres descartó.
- **Verificación en vivo**: dev server (`npm run dev`) + Edge headless
  (`msedge.exe --headless --virtual-time-budget=...`) pilotado con
  `puppeteer-core` (instalado con `--no-save`, no quedó en
  `package.json`) contra un negocio de prueba registrado por la API
  pública. Capturas en mobile (390px) y desktop (1440px) de las 4
  pantallas, sin errores de consola. `tsc -b` limpio.

## Segunda pasada: shell compartido y Perfil del negocio a fondo (2026-08-01)

> El humano marcó que `ConfiguracionNegocioPage.tsx` seguía muy lejos
> del mockup, y que el `Layout.tsx` compartido (navbar móvil + sidebar
> desktop) también necesitaba trabajo — es la causa raíz de que
> pantallas por lo demás cercanas al mockup "se sintieran distintas".

- **`Layout.tsx` — sidebar (desktop)**: el ítem activo pasó de una
  píldora flotante (`rounded-xl` + indicador absolutamente posicionado
  + icono en su propia caja con fondo) a una "pestaña" pegada al borde
  izquierdo: `border-l-4` (transparente en reposo, así no hay salto de
  layout al activarse) + `rounded-r-xl` + icono sin caja, solo cambia de
  color. Calca `sidebar-active` de `inicio_turnio_desktop_1/code.html`.
- **`Layout.tsx` — navbar (móvil)**: el activo pasó de "barra indicadora
  arriba + icono en caja cuadrada + texto suelto" a una sola píldora
  `rounded-full` que envuelve icono y etiqueta juntos (`bg-emerald-500/15`),
  igual que las cuatro variantes mobile del mockup. El contenedor de la
  barra ganó `rounded-t-xl`. **No** se tocó el header superior (avatar +
  saludo + menú de cuenta): el pedido fue específicamente navbar y
  sidebar, no ese header.
- **`ConfiguracionNegocioPage.tsx` — reescritura real, no solo estilo**:
  - Título y copy iguales al mockup: "Configuración del Perfil" /
    "Personaliza la apariencia y los datos públicos de tu negocio."
    (antes: "Perfil del negocio" / "Lo que ven tus clientes...").
  - Tarjetas de plantilla: imagen `h-32` (antes `h-24`), borde grueso
    `border-2 border-emerald-500` en la seleccionada en vez de
    `ring`+`shadow`, badge "Seleccionado" **inline junto al título** en
    vez de superpuesto sobre la imagen. Badge "Visualización en vivo"
    agregado junto al `h2` de la sección (existe en el mockup, no
    existía acá).
  - Los campos de texto se consolidaron en **una sola tarjeta grande**
    "Detalles del Negocio" (`rounded-2xl p-6 md:p-8`, grid de 2
    columnas, botón "Guardar cambios" a la derecha con separador
    arriba) en vez de una tarjeta angosta genérica — así se ve en las
    dos variantes (mobile y desktop) del mockup.
  - **Deliberadamente no se copió el set de campos del mockup**: trae
    "Categoría", "Correo de contacto" y "Descripción corta", que
    **no existen en `MiNegocio`** (ver `backend/openapi.yaml` —  ese
    schema solo tiene `nombre`, `ciudad`, `direccion`, `telefono`, más
    `logo`/`portada`/`color_acento`/`tema`). Inventar esos campos habría
    violado la regla de oro del contrato. Quedan como posible pedido a
    backend si en algún momento se quieren de verdad, no como una tarea
    pendiente de este cambio.
  - La tarjeta de "Tu enlace" (arriba de todo) **se mantuvo** aunque no
    aparece en el mockup: es funcionalidad real y documentada como "lo
    primero que importa en esta pantalla" (ver más arriba en este mismo
    archivo, sección de imágenes/perfil de Fase 2) — omitirla habría
    sido una regresión, no un ajuste de fidelidad visual.
  - Logo / Portada / Color de tu negocio / Fotos del local se dejaron
    como tarjetas separadas después del formulario consolidado: el
    mockup de referencia no las mostraba, pero son funcionalidad ya
    construida y valiosa que ningún mockup de esta tanda contradice
    explícitamente.
- **Verificado en vivo** de nuevo con el mismo método (Edge headless +
  `puppeteer-core --no-save` + negocio de prueba por API), capturas de
  Perfil del negocio, Agenda e Inicio en mobile y desktop. `tsc -b`
  limpio, 59 tests de Vitest en verde.

## Tercera pasada: el shell seguía sin calcar el mockup (2026-08-01)

> El humano comparó dos capturas lado a lado (el mockup real,
> `turnio_business_management_app/code.html`, idéntico a
> `inicio_turnio_desktop_1`, contra la app corriendo) y señaló que
> "el navbar y el sidebar" seguían distintos — el pedido anterior se
> había quedado corto.

- **`Layout.tsx` — wordmark del sidebar**: pasó de un badge cuadrado
  "T" + nombre del negocio a texto plano **"Turnio"** en verde
  (`font-headline-lg`, calcado del mockup). El nombre del negocio
  **no desapareció**: se movió a una línea pequeña en mayúsculas justo
  encima del bloque de usuario, en el pie de la barra — perderlo del
  todo habría sido peor para un producto multi-tenant que el mockup
  (genérico, de un solo negocio) no necesitaba resolver.
- **`Layout.tsx` — TopAppBar de escritorio, nueva**: no existía
  ninguna barra superior en desktop; cada página ponía su propio
  `<h1>` como primer elemento del contenido. Ahora hay una barra
  sticky (`hidden lg:flex`) con el título de la sección (derivado de
  `permisos/shell.ts` haciendo match de `location.pathname` contra
  `navegacion` — un solo lugar que ya sabe la ruta de cada pantalla,
  no un título nuevo por página) + iconos de búsqueda/notificación
  **decorativos** (no hay funcionalidad detrás; se dejaron como
  `<span>`, no `<button>`, para no fingir que algo es clicable cuando
  no lo es).
- **Consecuencia que había que resolver**: con la TopAppBar mostrando
  ya el título de la sección, el `<h1>` propio de `AgendaPage.tsx`,
  `ServiciosPage.tsx` y `ConfiguracionNegocioPage.tsx` quedó
  **duplicado en desktop** (dos veces "Agenda", por ejemplo). Se le
  agregó `lg:hidden` a esos tres títulos (y a su icono de cabecera,
  donde aplica) — siguen apareciendo en mobile, que no tiene
  TopAppBar propia. El subtítulo de cada página (conteo, fecha,
  descripción) se queda visible siempre: no es un duplicado, es
  información que la TopAppBar no muestra.
- **Verificado en vivo** una vez más (mismo método), capturas de
  Agenda, Servicios y Perfil del negocio en desktop confirmando que ya
  no hay título repetido y que el sidebar/TopAppBar calcan el mockup.
  `tsc -b` limpio, 59 tests de Vitest en verde.

## Cuarta pasada: overflow del `Separator`, header móvil y "Tu enlace" (2026-08-01)

- **`Layout.tsx` — `Separator` desbordaba el sidebar**: `w-full` en un
  elemento horizontal calcula el 100% del contenedor y luego el `mx-3`/
  `mx-2` de alrededor **se suma** a ese ancho — no se resta —, así que
  el separador se salía por los dos lados. El humano tampoco quería ver
  esa línea, así que se quitaron los dos usos (antes de la nav, antes
  del bloque de usuario) sin reemplazarlas por otra línea: solo
  espaciado (`mt-3` en la nav). El import de `Separator` se fue del
  archivo — ya no se usa en `Layout.tsx`.
- **`Layout.tsx` — wordmark del sidebar alineado con la TopAppBar**:
  ambos bloques comparten ahora `h-14` + `items-center` (antes el
  wordmark tenía `pt-8 pb-2`, la TopAppBar `py-3` — alturas y
  padding-top distintos, texto en líneas distintas). Como los dos
  contenedores son `sticky top-0` (arrancan en el mismo `y`), igualar
  la altura los deja en la misma línea sin cálculos de píxeles sueltos.
- **`Layout.tsx` — header móvil, ahora sí calcado del mockup**: el
  pedido anterior había dejado este header explícitamente afuera (el
  humano solo pidió "navbar y sidebar" esa vez); esta vez trajo la
  captura del mockup mobile de Perfil del negocio y pidió igualarlo
  también. Pasó de "avatar + saludo personalizado + menú de tres
  puntos" a "icono de grilla (abre el mismo menú de cuenta de antes,
  con el ajuste secundario y cerrar sesión) + wordmark 'Turnio' +
  campana decorativa", igual que el resto de mockups mobile.
  **El saludo personalizado ("Hola, X") desapareció del chrome de
  móvil** — no tiene equivalente en ningún mockup mobile (todos usan
  la misma barra genérica) y ya vive como contenido propio de
  `DashboardPage` en desktop (`hidden lg:block`). No se replicó en
  mobile a propósito: es exactamente lo que muestra el mockup.
- **`ConfiguracionNegocioPage.tsx` — la tarjeta "Tu enlace" se fusionó
  con "Diseño de tu página"**: a pedido explícito del humano ("se ve
  más premium, más fiel al diseño"), la tarjeta separada con el enlace
  completo + botones "Copiar"/"Ver" desapareció. La acción de **ver**
  el enlace se convirtió en el botón "Vista previa" del encabezado de
  la sección de plantillas (mismo lugar donde ya se elegía cómo se ve
  la página — tiene sentido que previsualizar viva ahí). La acción de
  **copiar** se mantuvo como ícono compacto al lado, sin etiqueta: no
  se pidió explícitamente conservarla, pero quitar del todo la manera
  de copiar el enlace (la forma más común de compartirlo por WhatsApp)
  habría sido una regresión real, no solo un ajuste visual — se avisa
  acá por si se prefiere quitarla también.
- **Verificado en vivo**: mismo método (Edge headless + negocio de
  prueba), capturas de Inicio y Perfil del negocio en mobile
  confirmando el header nuevo y la fusión de "Tu enlace". `tsc -b`
  limpio, 59 tests de Vitest en verde.

## Quinta pasada: por qué "no aparecían" citas ya agendadas, y date picker real (2026-08-01)

> El humano reportó (con un curl copiado del navegador) que un par de
> citas no se veían en la Agenda. La API respondía bien — se replicó el
> curl contra el backend local y devolvía las dos citas — así que no
> era un bug de auth ni de datos: eran citas agendadas para el 10 y 11
> de agosto, y la tira de selector de día de `AgendaPage.tsx` solo
> mostraba una ventana fija de 7 días desde hoy (`proximosDias()`), sin
> flechas de semana ni selector de fecha. Esas fechas literalmente no
> tenían pastilla para hacer clic — no había forma de llegar ahí.

- **`src/ui/CalendarioMes.tsx` (nuevo)**: la grilla de mes (navegación +
  días + botón "Hoy") que antes vivía duplicada a mano dentro de
  `DateTimePicker.tsx` se extrajo a un componente compartido, sin lógica
  de hora — la usan tanto `DateTimePicker` (fecha y hora, para crear una
  cita) como el `DatePicker` nuevo (solo fecha).
- **`src/ui/DatePicker.tsx` (nuevo)**: selector de un día suelto sobre
  `CalendarioMes`, con su propio disparador (`trigger`, cualquier
  elemento — no se impuso un botón fijo para no repetir el error de
  antes de un sub-componente que no reenvía `ref`/props a través de
  `asChild` de Radix).
- **`AgendaPage.tsx` — la tira de 7 días ahora se puede recentrar**:
  `proximosDias()` pasó de "siempre desde hoy" a recibir una fecha de
  inicio (`inicioVentana`, estado nuevo). Un ícono de calendario al
  final de la tira abre el `DatePicker`; elegir una fecha ahí llama a
  `irAFecha()`, que mueve tanto la selección como el inicio de la
  ventana — así el día elegido queda como la primera pastilla visible,
  no solo "seleccionado en el aire" sin representación en la tira.
- **Bug de posicionamiento que el humano encontró con una captura**: el
  `Popover.Content` de `DateTimePicker` (y ahora también el de
  `DatePicker`) no tenía límite de alto. Cuando Radix lo volteaba hacia
  arriba por falta de espacio abajo (el caso típico: el campo de
  fecha/hora está cerca del fondo de un modal), el contenido —
  navegación de mes + grilla de días + grilla de horas, bastante alto —
  se salía por el borde superior de la pantalla, dejando el título del
  mes casi invisible. Se corrigió con el patrón estándar de Radix:
  `max-h-(--radix-popover-content-available-height) overflow-y-auto` —
  esa variable CSS la calcula Radix según el espacio real disponible
  hacia el lado que volteó, así que el popover ahora se ajusta al hueco
  que tiene en vez de desbordarlo.
- **Verificado en vivo**: registrado un servicio de prueba (por API)
  para poder abrir el formulario real de "Agendar cita" y disparar el
  `DateTimePicker` pegado al fondo del modal — antes se cortaba, ahora
  se ve completo. También el `DatePicker` nuevo de la Agenda: abrirlo,
  saltar al 10 de agosto, y confirmar que la tira se recentra y el
  filtro de citas cambia. `tsc -b` limpio, 59 tests de Vitest en verde.

## Fase 3: Caja, comisiones automáticas y auditoría (2026-08-05)

> Rama `feature/fase3-caja-comisiones`, mismo diseño acordado con el
> humano en `/home/iber/.claude/plans/lucky-bubbling-balloon.md`
> (aprobado tras 3 preguntas de producto — todas resueltas con la
> opción recomendada). Lado backend ya documentado en
> `../backend/ROADMAP-BACKEND.md`; acá va lo que le tocó a esta capa.

### Qué se completó
- **`src/permisos/catalogo.ts`**: `puede_cobrar` y `puede_ver_reportes`
  dejaron de estar marcadas `proximamente` (tenían el chip "Pronto" sin
  ningún enforcement real desde que se declararon en Fase 1). Se agregó
  la capacidad nueva `puede_editar_comisiones` al grupo "Dinero", junto
  a `puede_editar_precios` — el ciclo "agrego capacidad en el backend →
  rompe la compilación de `catalogo.ts` → la traduzco" ocurrió de
  verdad en esta tanda, no se saltó regenerando tipos después.
- **`src/permisos/shell.ts`**: `Caja` entra a la navegación **principal**
  de `administracion`/`recepcion` (gateada por `puede_cobrar`) — es el
  momento de conversión del producto (cerrar el día, ver cuánto le toca
  a cada barbero), no algo para esconder. `Cargos` le cedió su lugar
  (pasó a `secundaria: true`): se configura una vez, no es trabajo
  diario. La barra inferior de móvil sigue en el límite de 5 entradas
  principales para `administracion`/`recepcion` (Inicio, Agenda,
  Servicios, Caja, Equipo) — verificado con un test nuevo en
  `shell.test.ts`, no a ojo.
- **`src/api/types.ts`**: alias `MovimientoCajaInput`, mismo patrón que
  `ServicioInput` para el wart conocido de serializers read/write
  mezclados (ver `CLAUDE.md`).
- **`src/ui/EstadoCaja.ts`** y **`src/ui/moneda.ts`** (nuevos):
  `formatearMoneda` reemplaza el formateo de pesos que ya estaba
  duplicado suelto en `ServiciosPage.tsx`/`ModalCatalogo.tsx`/
  `publico/secciones.tsx` — Caja fue el cuarto lugar que lo necesitó,
  el punto en que valía la pena extraerlo. Los usos existentes no se
  migraron en esta tanda.
- **`src/pages/caja/`** (nuevo): `CajaPage` (contenedor con toggle
  "Hoy"/"Historial" — una sola ruta, no dos como Mis-servicios/Validar,
  porque Caja es del negocio como un todo, no hay una versión "mía" vs.
  "ajena"), `CajaHoy` (abrir caja, resumen del día, registrar
  ingreso/egreso, vincular un `RegistroServicio` aprobado con
  autocompletado de comisión, aviso de servicios aprobados sin cobrar,
  cerrar caja) y `CajaHistorial` (reusa `FiltroPeriodo`/
  `filtrosPeriodo.ts` de `../servicios/` tal cual, sin tocarlo).
- **`src/App.tsx`**: ruta `/caja` gateada con `capacidad="puede_cobrar"`,
  mismo criterio que `EmpleadosPage`/`ConfiguracionCargosPage`.
- **Tests nuevos**: `src/ui/moneda.test.ts` (formatea números y strings
  numéricos, una entrada no numérica no explota), `src/pages/caja/
  CajaHoy.test.tsx` (5 tests: sin caja abierta el 404 de `/actual/` se
  trata como estado vacío y no como error; un error real sí muestra
  `EstadoError`; el formulario oculta método de pago y el selector de
  vínculo cuando el tipo es egreso; elegir un `RegistroServicio` fija
  el empleado de comisión como texto no editable y autocompleta
  concepto/monto; el `POST` de un movimiento manda el body esperado),
  y dos casos nuevos en `shell.test.ts` (Caja principal y gateada por
  capacidad, Cargos ahora secundaria). Suite completa: 68 tests en
  verde.

### Decisión técnica: mock de `apiClient` sin mockear `conReintentoDeAuth`
`CajaHoy.test.tsx` mockea `../../api/client` (`apiClient.GET`/`POST`)
pero deja correr la implementación real de `conReintentoDeAuth`, que
lee `response.status` para decidir si reintenta tras un 401 y (en este
componente) para distinguir "sin caja abierta" (404) de un error real.
Por eso cada respuesta mockeada necesita `{ data, error, response:
{ status } }` aunque el test no use `response` directamente — omitirlo
rompe en un `TypeError` dentro de `conReintentoDeAuth`, no en la
aserción del test, lo cual confundiría a quien lo debuguee después.

### Trampa encontrada: dos botones con el mismo nombre accesible
Con `movimientos: []`, `CajaHoy` renderiza **dos** botones "Registrar
movimiento" a la vez: el del header y el de la acción de
`EstadoVacio`. `screen.findByRole("button", { name: "Registrar
movimiento" })` revienta porque matchea dos elementos. Se resolvió con
`findAllByRole(...)[0]` en vez de agregarle un `aria-label` distinto a
uno de los dos solo para que el test lo pudiera diferenciar — cambiar
el markup de producción para acomodar un test es la dirección
equivocada cuando ambos botones son legítimamente el mismo texto para
la persona que usa la pantalla.

### Verificación
`npm run test` (68 tests), `npx tsc -b` (limpio), `npm run build`
(limpio), `npm run lint` (solo los 3 warnings preexistentes de
`only-export-components`, ninguno nuevo). **La verificación manual en
navegador no se hizo desde esta sesión** — el humano pidió no
validarla acá, la hace él directamente. Sí se corrió una verificación
end-to-end completa contra el backend real en Docker (`curl`, sin
navegador): registrar negocio → crear servicio con
`porcentaje_comision` → registrar y aprobar un `RegistroServicio` como
un segundo miembro → abrir caja → registrar movimiento vinculado
(comisión calculada en `20000.00` = `40000 × 50%`, `empleado_comision`
autoasignado al barbero) → intentar vincular el mismo registro dos
veces (`400`) → cerrar caja → confirmar `resumen` completo (totales,
por método de pago, comisión por empleado, contador de sin-cobrar en
`0`) → histórico con filtro de fechas → gating 403 para quien no tiene
`puede_cobrar`/`puede_editar_comisiones`. De paso salió a la luz que la
base de datos de Docker tenía pendientes las migraciones
`usuarios.0007` y `caja.0001` (se habían generado en la sesión de
backend pero nunca se aplicó `migrate` sobre el contenedor corriendo)
— aplicadas con `docker compose exec backend python manage.py
migrate`, sin tocar código.

### Pendiente
- Verificación manual en navegador de `CajaPage` con dos sesiones
  (una con `puede_cobrar`, otra sin ella) — queda a cargo del humano.
- Migrar los usos existentes de formateo de moneda suelto
  (`ServiciosPage.tsx`, `ModalCatalogo.tsx`, `publico/secciones.tsx`) a
  `formatearMoneda` — no urgente, anotado en el comentario del propio
  `ui/moneda.ts`.

## 2026-08-07 — Rediseño del módulo de dinero (frontend)

La otra mitad del cambio con ruptura que entregó backend el mismo día
(ver `../backend/ROADMAP-BACKEND.md` y `../CONTRATO.md` 5.13/5.14). La
regla que ordena todo: **el servicio genera una deuda (`Venta`), el pago
genera el movimiento de caja**.

### Qué desapareció
- **`MisServiciosPage` y `ValidarServiciosPage`**, con sus rutas
  `/servicios/mios` y `/servicios/validar`. El circuito de "registrar
  trabajo → alguien lo aprueba" ya no existe: cobrar es aprobar.
- **El formulario de "Registrar movimiento"** de `CajaHoy`. Era la
  puerta por la que entraba un ingreso que ninguna venta explicaba. Hay
  un test que verifica que el botón **no** existe.
- `ui/EstadoRegistroServicio.ts` y la capacidad `puede_aprobar_servicios`
  del catálogo (entró `puede_anular_venta`, en el grupo "Dinero"; el área
  "Servicios realizados" se disolvió con ella).

### Qué entró
- **`pages/caja/` reorganizada en tres vistas**: *Cobros* (la cola de
  cobro, y la que abre por defecto), *Hoy* (el estado del cajón) e
  *Historial*. Recepción aterriza directo en `/caja` — desde que existe
  una cola de cobro real, la agenda es lo segundo que mira.
- **`CobrosPendientes`** — trae `?estado=pendiente` y `?estado=parcial`
  en dos llamadas (el filtro del backend acepta un valor); las parciales
  van primero porque ya tienen plata puesta. Cobrar actualiza la fila en
  memoria en vez de recargar todo: en el mostrador, con el cliente
  esperando, el refresco completo se nota.
- **`ModalCobrar`** con pago parcial y mixto — el monto arranca en el
  saldo completo (el caso normal) y quien parte el pago lo baja. Dos
  pasadas por el modal son un pago mixto, igual que en el backend.
- **`ModalCierre`** — el arqueo, con la diferencia calculada **mientras
  se teclea**: quien contó mal se entera ahí, no después de cerrar. Lo
  no-efectivo se lista aparte, sin diferencia asociada.
- **`ModalEgreso`** con categoría obligatoria, **`ModalDeshacer`**
  (devolver/anular, ambas con motivo) y **`ModalVenta`** para la cuenta
  sin cita, con varias líneas y **un empleado por línea**.
- **`MiTrabajoPage`** (`/mi-trabajo`) reemplaza a "Mis servicios". Deja
  de ser un formulario y pasa a ser lo que el barbero de verdad quería:
  su día, su producción y su comisión, separando la ganada de la que
  todavía está por cobrarse. Suma **solo sus líneas**: en una cuenta
  hecha entre dos, la mitad del otro no es suya.
- **Agenda**: `en_atencion` y `no_show` con sus acciones, y `completar`
  con su respuesta nueva (`{cita, venta}`) — el toast dice cuánto quedó
  por cobrar, leído de la venta y no del precio del catálogo, que son dos
  números que pueden diferir. La cita muestra el estado de su cuenta y
  nada más: se cobra en Caja.

### Decisiones y hallazgos
- **`ACCIONES_POR_ESTADO` no ofrece todo lo que el backend acepta.**
  Desde `agendada` el backend permite ir a `en_atencion` directo; la UI
  no lo ofrece porque saltarse "Confirmar" es un caso de borde y una fila
  de cuatro botones en un teléfono se toca mal. La lista de acciones es
  una decisión de producto, no un espejo de la máquina de estados.
- **Bug encontrado y corregido: bucle de redirecciones en el shell.**
  Recepción aterriza en `/caja`, que exige `puede_cobrar`, pero el dueño
  puede crear un cargo de recepción sin esa capacidad. Como
  `RutaProtegida` redirige a `shell.inicio`, esa persona rebotaba de
  `/caja` a `/caja` para siempre. `shellDe()` ahora cae a la primera
  entrada de la navegación **ya filtrada**. La regla general: el `inicio`
  de un shell sale siempre de la navegación filtrada, nunca de la
  declarada. Hay test, y el de "todo shell arranca en una ruta que él
  mismo tiene" ahora corre **con y sin** capacidades — el caso que
  fallaba era el de sin.
- **Bug encontrado por el humano al probarlo: el selector de "¿quién lo
  hizo?" salía vacío para recepción.** La cola de cobro pedía el equipo a
  `GET /api/negocios/empleados/`, que es la vista de **gestión** y exige
  `puede_gestionar_empleados` incluso para leer — recepción recibía 403 y
  la lista quedaba en cero, justo para el cargo que más usa esa pantalla.
  `CONTRATO.md` 5.4 ya decía la regla ("si solo necesitas nombres, usa
  `/equipo/`") y no la seguí. Corregido a `GET /api/negocios/equipo/`,
  con test de regresión: el mock revienta ante cualquier endpoint no
  declarado, así que volver al equivocado falla el test en vez de
  aparecer en producción. **Lección para la próxima pantalla que liste
  gente**: la pregunta no es "¿qué endpoint devuelve empleados?" sino
  "¿con qué capacidad va a entrar quien mira esta pantalla?".
- **"Atendiendo" (`en_atencion`) se quitó de la UI** — decisión del
  humano al probarlo, y tiene razón: marcarlo es un toque más por cliente
  a cambio de nada. El barbero sabe a quién tiene en la silla y el
  sistema no hace nada distinto por saberlo. El estado sigue existiendo
  en el dominio y su endpoint funciona; ganaría sentido el día que
  alguien **que no está haciendo el trabajo** necesite ver el local en
  vivo (una recepción con sala de espera en un salón grande). La tabla
  `ACCIONES_POR_ESTADO` dejó de ser un espejo de `TRANSICIONES_VALIDAS`
  y pasó a ser explícitamente otra cosa: el backend define qué es
  **posible**, esa tabla define qué **se ofrece**.
- **Hallazgo colateral, corregido en la primitiva**: el trigger de
  `SelectCustom` es un `<button>` de Radix, y el `<label>` de al lado no
  lo nombraba (un `<button>` no se asocia con `htmlFor`). Un lector de
  pantalla anunciaba "botón, Efectivo" sin decir de qué campo — con tres
  selectores seguidos en el modal de gasto, indistinguibles. Se le
  cableó `aria-labelledby` + `aria-describedby`. Salió al escribir el
  test de arriba, que no podía encontrar el combo por su nombre
  accesible: **la consulta accesible fallando era el síntoma, no un
  problema del test**.
- **Defecto de contrato reportado y corregido del lado backend**:
  `Cita.venta_id`/`venta_estado` salían no-nulables en el schema pese a
  ser `null` en toda cita sin venta. Se corrigió en el serializer
  (`allow_null=True`) en vez de castear en el frontend — el tipo
  generado ahora dice la verdad. De paso se les fijó nombre estable a
  `MetodoPagoEnum`, `VentaEstadoEnum` y `CategoriaEgresoEnum` en
  `ENUM_NAME_OVERRIDES`.
- **`RutaProtegida` acepta `capacidades` (una lista, basta cualquiera).**
  `/caja` la abre tanto quien cobra como quien solo ve reportes, y
  modelarlo con dos rutas al mismo componente habría sido peor.
- **`FiltroPeriodo` y `filtrosPeriodo` se mudaron a `src/ui/`** (como
  `FiltroPeriodo.tsx` y `periodos.ts`). Vivían en `pages/servicios/`
  cuando sus consumidores eran esas pantallas; ahora los usan el
  histórico de caja y "Mi trabajo", que no comparten sección.
- **`dinero.ts` declara `METODOS_PAGO` y `CATEGORIAS_EGRESO` como
  `Record` completos** sobre el enum del schema, no como listas sueltas:
  si el backend agrega un método de pago, el frontend **deja de
  compilar** hasta que alguien decida cómo se llama en la UI. Mismo
  criterio que `permisos/catalogo.ts`.

### Verificación
- **72 tests en verde** (venían 70), `tsc -b` limpio, `oxlint` sin
  errores nuevos y `npm run build` OK. Los tests de `CajaHoy` se
  reescribieron enteros: los nuevos fijan que no hay forma de registrar
  un ingreso a mano, que el arqueo deja el Nequi fuera del cajón, y que
  la diferencia se calcula antes de enviar nada.
- **Prueba de humo completa contra el backend real en Docker** (`curl`,
  sin navegador), recorriendo los mismos endpoints que llama la UI:
  registrar negocio → servicio con 40% de comisión → horario → agendar
  → confirmar → completar (nace la venta de `$35.000`, con precio y
  comisión congelados) → **completar otra vez y recibir la misma venta**
  (idempotencia) → cola de cobro → cobrar sin caja abierta (`400`) →
  abrir caja con base `$100.000` → **pago mixto** `$15.000` efectivo +
  `$20.000` Nequi (`parcial` → `pagada`, 2 pagos, comisión devengada una
  sola vez: `$14.000`) → gasto de `$50.000` → **arqueo esperado
  `$65.000`**, con los `$20.000` de Nequi fuera del cajón y listados
  aparte → cerrar contando `$63.000` y obtener `diferencia = -2.000`.

### La app no se podía probar desde un teléfono (corregido)

Al intentar abrirla desde un celular de la misma red, la interfaz
cargaba pero **ningún dato**: el perfil público decía "este negocio no
existe" y el login no entraba. Nada apuntaba a la causa, y no era el
contenedor —que ya publica `0.0.0.0:8001`—. Eran tres cosas apiladas:

1. `src/api/client.ts` caía en `http://localhost:8001` cuando
   `VITE_API_BASE_URL` no está definida. En el teléfono, `localhost` es
   **el teléfono**. Ahora deriva el backend del host desde el que se
   sirvió la app, así que funciona desde cualquier dispositivo y
   sobrevive a que el router cambie la IP.
2. `DJANGO_ALLOWED_HOSTS` traía solo `localhost,127.0.0.1`, así que
   Django respondía `400` a cualquier petición por IP. Con `DEBUG=1`
   ahora acepta cualquier host; con `DEBUG=0` la lista explícita vuelve
   a ser obligatoria, que es donde importa.
3. `vite` solo escucha en `localhost` por defecto. `server.host: true`
   en `vite.config.ts` lo deja fijo, sin depender de pasar `--host`.

Vale anotarlo porque **esto es una app Capacitor**: probar en un
teléfono real es parte del ciclo normal, no un caso excepcional, y tres
piezas de configuración lo estaban impidiendo con un síntoma que parecía
un bug de datos.

### Pendiente
- **Verificación manual en navegador**, que no se hizo en esta tanda: no
  hay automatización de navegador en este entorno, así que lo verificado
  es la suite, el build y el contrato real por HTTP. Vale la pena mirar
  a ojo, con dos sesiones (una con `puede_cobrar`, otra sin), la cola de
  cobro en un teléfono angosto y la fila de cuatro acciones de una cita
  `confirmada`. **Desde el arreglo de arriba, esto ya se puede hacer en
  un celular de verdad**, que es donde el diseño angosto se juzga.
- **Devoluciones parciales no tienen entrada propia en la UI.**
  `ModalDeshacer` soporta el modo `devolver` y está cableado, pero hoy
  solo se llega a él por "Anular". Falta decidir dónde vive el botón:
  el candidato natural es el detalle de una venta ya pagada, que todavía
  no existe como pantalla.
- **Sin pantalla de detalle de venta.** `VentaCard` muestra items,
  estado y saldo, que alcanza para cobrar; ver los pagos uno por uno
  (útil para conciliar un mixto) necesitaría una vista propia.
- Migrar los usos existentes de formateo de moneda suelto
  (`ServiciosPage.tsx`, `ModalCatalogo.tsx`, `publico/secciones.tsx`) a
  `formatearMoneda` — sigue sin urgir.

## 2026-08-07 — Onboarding: el primer minuto en Turnio (adelanto de Fase 5)

Pedido explícito del humano, y adelanta parte de Fase 5. La motivación
que dio fue el dueño que es su propio y único recurso: "siento que igual
debe pasar por un flujo que no es necesario si tú mismo eres el dueño".

### El problema resultó ser más grande que el planteo

Al medirlo, un negocio recién registrado queda así:

```
horarios del negocio: 0 franjas
servicios: 0
perfil público: HTTP 200
```

O sea: **el enlace público nace vivo y muerto a la vez**. Responde, se
ve bien, se puede compartir — y no puede producir una sola reserva,
porque sin horario `huecos_disponibles` devuelve lista vacía. Nada se lo
decía al dueño, que caía en un panel vacío. Y le pasaba igual al dueño
con cinco barberos, así que el arreglo vale más que ahorrarle clics al
operador único: el enlace **es** el MVP, y se entregaba roto por defecto.

### Qué se construyó
- **`onboarding/estadoNegocio.tsx`** — un provider que responde una sola
  pregunta: ¿este negocio puede recibir una reserva? (tiene horario **y**
  servicios). Se consulta una vez por sesión y vive por encima de las
  rutas: `Layout` se remonta en cada navegación, así que preguntarlo ahí
  serían dos requests por clic de menú.
- **`onboarding/BienvenidaPage.tsx`** — cuatro pasos: equipo → horario →
  servicios → tu enlace. Cada paso **guarda al terminarlo**, no todo al
  final: quien abandona conserva lo hecho y retoma donde iba.
- **Puerta en `RutaProtegida`** — nadie aterriza en el panel con el
  negocio incompleto. **Solo se le muestra a quien puede resolverlo**
  (`puede_configurar_horarios` **y** `puede_editar_precios`): mandar a un
  barbero al wizard sería encerrarlo en una pantalla donde no puede hacer
  nada, y el negocio incompleto no es problema suyo.
- Los pasos reusan lo que ya existía: el catálogo semilla con
  `POST /api/servicios/lote/`, `PUT /api/agenda/horario-negocio/` y
  `POST /api/negocios/empleados/`. Lo único nuevo es el envoltorio.

### Decisiones
- **"Solo yo" no se persiste en ninguna parte.** Decide qué pasos se
  muestran y nada más. El `CLAUDE.md` de la raíz es explícito en que el
  operador único es el caso n=1 del mismo diseño y no un modo aparte;
  guardar la respuesta sería crear ese modo por la puerta de atrás, y
  quedaría mentiroso el día que contrate a alguien. Hay test.
- **No se marca "onboarding hecho".** La condición es el estado real del
  negocio, así que la puerta **reaparece** si alguien se queda sin
  servicios — que es lo correcto, porque su enlace volvió a estar muerto.
  Es lo que hace que abandonar el wizard no deje un negocio roto para
  siempre, y es también por lo que se decidió **no sembrar un horario por
  defecto** al registrar (decisión del humano): el wizard lo pide.
- **Salir siempre es posible** ("Configurar esto después"). Encerrar a
  alguien en un wizard es peor que un negocio incompleto, y la puerta lo
  vuelve a traer.
- **El paso de horario es más simple que el editor de Agenda a
  propósito**: un rango, igual para todos los días marcados. Sin horario
  partido ni horario por empleado — existen en el modelo y se ajustan
  después. Meterlos acá convertiría el primer minuto en una hoja de
  cálculo.
- **Un preset mentía y se corrigió antes de entregar**: decía "sábado
  más corto" pero aplicaba el mismo rango a todos los días, porque el
  paso maneja un solo rango. Una etiqueta que miente es peor que no
  ofrecer el atajo — quien confía en ella publica un horario que no es el
  suyo. Quedó "Solo entre semana", que sí es lo que hace.

### Verificación
84 tests en verde (venían 76), `tsc` limpio y build OK. Ocho tests
nuevos: los cuatro de la puerta (redirige, deja pasar, no encierra al
barbero, no decide mientras carga) y cuatro del wizard.

Prueba contra el backend real recorriendo las llamadas del wizard sobre
un negocio recién registrado: **de 0 huecos ofrecidos a 39** el día
siguiente, después de horario + servicios.

### Pendiente
- **Sin lista de "primeros pasos" en el dashboard.** La puerta cubre lo
  que impide reservar; lo que solo *mejora* el perfil (logo, fotos,
  plantilla, comisiones) no tiene dónde recordarse. Es el complemento
  natural y no se hizo en esta tanda.
- El paso de equipo crea empleados de a uno con `POST`. El registro
  acepta `empleados[]` en una sola llamada, pero eso solo sirve dentro
  del registro, no después.
- Verificación en navegador, como el resto de esta sesión.

## 2026-08-12 — Inicio en móvil: portada, bandeja de acciones y botón flotante

Pedido del humano: mejorar cómo se ve la app **en teléfono**, tomando
como referencia una pantalla de una app de finanzas (portada a sangre
completa con el dato grande, bandeja de accesos incrustada, tarjetas
blancas apiladas, barra inferior con botón flotante al centro) —
**calcando la estructura, no los colores**: la paleta de Turnio se
mantiene tal cual.

### Qué se hizo

**La estructura de la referencia, con el vocabulario de Turnio.** Nada
de paleta nueva: el degradado de la portada es `--color-primary` →
`--color-primary-container` (los dos indigos que ya existían), el botón
flotante es `--color-secondary` (la menta), y las tarjetas usan
`--color-outline-variant` y `--color-on-surface`. No entró ni un `#hex`
suelto.

- **`DashboardPage` — portada (`Portada`).** Sangra fuera del `px-5` del
  `main` con `-mx-5` y se come el `padding` de la barra de estado ella
  misma, para que el degradado empiece en el pixel cero. Lleva el saludo
  y el nombre a la izquierda, el menú de cuenta en un botón redondo a la
  derecha, y al centro el dato del día en tres líneas (fecha / número
  grande / de qué se compone).
- **Bandeja de acciones (`BandejaAcciones`).** La tarjeta blanca
  incrustada en el pie de la portada, cuatro accesos con icono en
  círculo. Los candidatos van ordenados por cuántas veces al día se
  tocan y se toman los **primeros cuatro que la persona pueda usar**: un
  empleado sin caja no ve un hueco, ve su cuarta acción corrida.
- **`EquipoDelDia`.** La fila horizontal de avatares de la referencia,
  con la carga de cada empleado hoy. Sale de las citas **que la pantalla
  ya cargó**, no de `GET /api/negocios/equipo/`: una segunda petición
  para mostrar las mismas dos o tres personas no se paga sola, y quien
  no tiene citas hoy no aporta a una fila que habla de la carga de hoy.
- **`TurnosDeHoy`.** La lista de la referencia, cinco filas y "Ver
  todos". Cada fila: avatar, cliente, servicio · empleado, y a la
  derecha la hora con el estado debajo.
- **`Layout` — botón flotante de agendar.** Parte la barra inferior por
  la mitad y sobresale con `translate` (que no ocupa espacio en el
  layout, así que las entradas siguen repartiéndose el ancho). Navega a
  `/agenda?nueva=1`.
- **`Layout` — cabecera móvil.** Deja de dibujarse en Inicio: la portada
  lleva su propio saludo y su propio menú de cuenta, y una barra encima
  le quitaría el sangrado completo. El resto de pantallas la conservan;
  sin ella perderían el acceso a cerrar sesión.
- **`AgendaPage` — `?nueva=1`.** Abre el formulario al entrar y
  **consume el parámetro** (`replace`), para que volver atrás o recargar
  no lo vuelva a abrir solo. Se hizo por la URL y no por estado
  compartido porque el formulario necesita servicios, equipo y horarios
  ya cargados: duplicarlo en el `Layout` sería duplicar esas peticiones.

**El escritorio no se tocó.** La cuadrícula de métricas, el banner y las
dos columnas siguen igual, ahora tras `hidden lg:*`. En escritorio hay
ancho para leer tres tarjetas de un vistazo; en un teléfono las mismas
tres se apilan y empujan la agenda fuera de la pantalla.

### Decisiones técnicas

- **`space-y-8` de la página no se podía sobrescribir con `mt-4`.** El
  primer intento le puso `mt-4!` a cada tarjeta móvil. Revisando el CSS
  emitido: en Tailwind 4 `space-y-*` aplica **`margin-block-end` al
  hermano anterior**, no `margin-block-start` al siguiente — el `mt-4`
  no le ganaba a nada porque no competía con nada. Quedó un contenedor
  propio (`space-y-4 lg:hidden`) que envuelve las tres piezas, que
  además les quita el `lg:hidden` repetido a cada una. Ver `DECISIONES.md` #49.
- **La cabecera en Inicio se oculta con `hidden`, no se desmonta.** Un
  `esInicio && <header>` habría sido lo mismo visualmente, pero la
  prueba de regresión puede afirmar sobre la clase y no sobre la
  ausencia — y la ausencia es indistinguible de "el componente se rompió".

### Verificación

89 tests en verde (venían 84), `tsc` limpio, `oxlint` sin avisos nuevos
y build OK. Cinco tests nuevos:

- `Layout.test.tsx` — el botón flotante navega a `/agenda?nueva=1`
  (el string es el contrato con `AgendaPage`: renombrarlo de un solo
  lado hace que el botón navegue y no pase nada más), no aparece sin
  `puede_gestionar_agenda`, y la cabecera cede el borde en Inicio.
- `AgendaPage.test.tsx` — `?nueva=1` abre el formulario y consume el
  parámetro; se ignora para quien no puede gestionar la agenda.

Se revisó también el CSS del build para confirmar que las utilidades
nuevas se emitieron (`bg-linear-to-b`, `from-primary`,
`to-primary-container`, `rounded-b-3xl`, `divide-outline-variant`):
Tailwind no falla ante una clase que no reconoce, simplemente no la
escribe, y así fue como se encontró lo del `space-y-8`.

### Pendiente

- **Sin verificación en navegador real**, que es justamente lo que
  `DECISIONES.md` #24 dice que hace falta para dar por bueno un cambio
  de frontend. No hay driver de navegador instalado en este entorno.
  Falta mirar en un teléfono: que el degradado llegue de verdad bajo la
  barra de estado, que el botón flotante no tape la última fila de la
  lista, y que la fila de equipo desborde bien con seis o más empleados.
- **Solo Inicio recibió el rediseño.** Agenda, Caja, Servicios y Equipo
  siguen con su layout de antes en teléfono. La portada y la bandeja son
  el patrón; aplicarlo al resto es la tanda siguiente.
- El botón flotante siempre agenda. Si más adelante hay una acción más
  frecuente por pantalla (cobrar dentro de Caja), habría que decidir si
  el botón cambia de acción según la sección o se queda fijo.

## 2026-08-12 — Onboarding: pantalla de bienvenida y pantalla de cierre

Segunda tanda del mismo pedido (ver la entrada anterior). El humano dejó
dos mockups en `frontend/public/ombording*/` —la primera vista del
wizard y la de "todo listo"— y una foto propia para la portada
(`public/portada.jpeg`), con la misma instrucción: calcar la estructura,
mantener la paleta de Turnio.

### Qué se hizo

- **`PantallaBienvenida` (nueva).** Primera vista del onboarding: la foto
  ocupa el 45% superior de la pantalla y se funde con el fondo por un
  degradado, con la píldora de paso arriba a la derecha; abajo, hoja
  redondeada con titular, bajada y **dos** promesas en tarjetas con icono
  en círculo, y el botón "Comenzar configuración".
- **`PasoEnlace` (rehecho).** La pantalla de cierre del mockup: el visto
  en círculo con halo, "¡Todo listo, {nombre}!", la tarjeta del enlace
  con su botón de copiar, y "Ir a mi negocio" fijo abajo.
- **`BienvenidaPage`.** `bienvenida` entra como paso real de la máquina,
  y las dos pantallas compuestas se renderizan **fuera** del marco del
  wizard (el marco tiene `px-5 py-8` y barra de progreso: adentro, la
  foto quedaría con márgenes y el botón flotando a media pantalla).
- **La foto.** El original de 2752×1536 y **2,4 MB** se recortó a la zona
  con la que se compone (la persona y la tarjeta flotante de la app) y se
  reescaló a 1200px: **176 kB**, catorce veces menos. El original quedó
  íntegro en `design/onboarding/portada-original.jpeg`. Esto es un bundle
  Capacitor: el peso no se paga en una CDN, se paga en el espacio del
  teléfono de cada dueño.

### Dónde se respetó el mockup y dónde no

**Geometría, calcada**: repartos, radios, tamaños de círculo, jerarquía y
posición de cada bloque.

**Paleta y tipografía, de Turnio**:
- El verde oscuro del mockup (`#006c49`) es su color de marca, no el
  nuestro. El botón principal usa `Button` sin variante, que ya es
  `bg-menta` — y de hecho el `primary-container` del mockup **es**
  `#10b981`, la menta de Turnio: las dos paletas son primas.
- El titular va en `text-primary` (el indigo), que es el color de titular
  del resto de la app.
- Los tamaños salen de la escala de `design/tokens.css`, no de los
  literales del mockup. El `body-md` del mockup es de 14px y el de Turnio
  de 16px; se usa el de Turnio por la misma razón que la paleta.

**Las dos promesas dicen otra cosa.** El mockup ofrece "Agenda
Inteligente" y **"Gestión de Clientes"**. La ficha de clientes es Fase 4:
no existe. Quedaron las dos cosas que el producto sí hace el primer día —
la agenda por empleado y el enlace de reservas— que además son la tesis
del producto. La primera pantalla de la app es el peor lugar para
prometer algo que no se va a encontrar.

**"Ir al Dashboard" quedó como "Ir a mi negocio".** Es el texto que ya
ship*ea* y "Dashboard" no es una palabra que aparezca en ninguna otra
parte de la app; la sección se llama "Inicio".

**Se cayó la lista "Qué hacer con él".** Los tres consejos que tenía
`PasoEnlace` (pégalo en Instagram, mándaselo a un cliente, no necesitan
cuenta) no están en el mockup y no se reemplazaron por nada. **Es una
pérdida real** —era la única parte del producto que explica qué hacer con
el enlace— y está anotada acá para que sea una decisión y no un descuido.
Restaurarla es cambiar una constante.

**La píldora cuenta pasos reales.** El mockup dice "Paso 1 de 5" fijo; el
wizard tiene un paso menos para quien no gestiona equipo. La píldora lee
el largo real de la lista de pasos visibles. Hay test.

**No se hizo el confeti** del `code.html` de cierre. No aparece en la
captura, así que no afecta al calco, y la pantalla ya tiene tres
animaciones (el visto que entra, el halo que late, los bloques que
suben). Era el accesorio de más.

### Verificación

91 tests en verde (venían 89), `tsc` limpio, `oxlint` sin avisos nuevos y
build OK. Los cuatro tests que ya existían del wizard se actualizaron
para cruzar la pantalla nueva, más dos nuevos: la píldora cuenta los
pasos reales de esa persona, y salir funciona desde la primera pantalla
(este último con la ruta de destino montada, para afirmar que **navega** y
no solo que el botón responde).

Se verificó contra el CSS del build que las utilidades nuevas se
emitieron (`h-[45dvh]`, `bg-menta/20`, `via-background/20`,
`from-transparent`, `to-background`, `animate-zoom-in`).

### Pendiente

- **Sigue sin verificación en navegador real** (ver la entrada anterior y
  `DECISIONES.md` #24). Lo que más falta mirar acá: cómo cae el recorte
  de la foto en un teléfono angosto —`object-cover` sobre una foto que
  es apaisada de origen— y si en una pantalla de 640px de alto el
  contenido de la bienvenida entra sin scroll.
- El texto alternativo de la foto es vacío a propósito (es ambiente), lo
  que está bien, pero conviene confirmarlo con un lector de pantalla real.

## 2026-08-12 — Consistencia entre Inicio y el resto (revisión en dispositivo)

El humano probó lo anterior **en un teléfono real** y trajo capturas.
Dos cosas que ninguna prueba iba a atrapar y que se ven de inmediato en
pantalla.

### 1. El botón de agendar no quedaba centrado

Con las cinco entradas de la barra (Inicio, Agenda, Servicios, Caja,
Equipo), partir la lista por la mitad deja tres a la izquierda y dos a la
derecha: el botón terminaba corrido a la derecha del centro real.

Se arregló por los dos lados:

- **La barra ahora centra por estructura**, no por índice: es una grilla
  `1fr auto 1fr` con un grupo de entradas a cada lado. El botón queda en
  el centro exacto sin importar cómo se reparta la lista. Sin botón
  (quien no puede agendar) vuelve a ser una sola fila.
- **`Equipo` pasó a `secundaria`** en `shell.ts`, con lo que la barra
  queda en cuatro entradas y se reparten dos y dos. Es la que menos se
  toca de las cinco —se da de alta a alguien cuando entra a trabajar, no
  todos los días— y sigue a un toque desde Inicio, que la tiene en su
  bandeja de accesos, y en la barra lateral completa en escritorio.

Hay test en `shell.test.ts`: **ningún shell puede pasar de cuatro
entradas principales**. Agregar una sección nueva es exactamente el
cambio que rompe esto, y es un cambio que compila, funciona, y solo se
ve mal.

### 2. Inicio parecía de otra app

Inicio abría con la portada indigo a sangre completa y el resto de
pantallas con una barra blanca y el wordmark en menta. Al navegar entre
secciones, la franja de arriba cambiaba de color: dos lenguajes visuales
en la misma app.

**El header móvil pasó a indigo** (`bg-primary`), con los dos botones en
el mismo círculo `bg-white/15` que usa la portada para su botón de
cuenta. El wordmark se queda en menta —es la marca, y sobre el indigo
mantiene contraste de sobra al tamaño al que se dibuja.

Se mantuvo plano y `sticky`, sin las esquinas redondeadas de la portada:
una barra que se queda fija y una portada que se va con el scroll son dos
cosas distintas y está bien que se vean distintas. Lo que tenía que
igualarse era el material, no la silueta.

**No se tocó ninguna pantalla**, solo el `Layout`: el título de sección
sigue viviendo en el cuerpo de cada página, así que no hay títulos
duplicados entre la barra y el contenido.

### Verificación

92 tests en verde (venían 91), `tsc` limpio, `oxlint` sin avisos nuevos,
build OK, y las utilidades nuevas confirmadas en el CSS del build
(`grid-cols-[1fr_auto_1fr]`, `bg-white/15`).

### Nota de método

Las dos cosas de esta entrada las encontró **mirar la app en un teléfono**,
no la suite ni la revisión de código — igual que `DECISIONES.md` #24. Un
botón descentrado y dos encabezados de distinto color son estados
perfectamente válidos para el compilador y para los tests.

## 2026-08-12 — El logo en Inicio y la franja de la barra de estado

Tercera revisión en dispositivo del mismo trabajo. Dos detalles, uno de
composición y otro que no era CSS.

### 1. Inicio se había quedado sin el wordmark

La portada llevaba el saludo en la primera línea y el resto de pantallas
el wordmark, así que Inicio era la única sin la marca y la línea de
arriba cambiaba de contenido al navegar.

La primera fila de la portada pasó a ser **la misma** que el encabezado:
menú de cuenta / "Turnio" / campana, con la misma altura (`h-10`) y el
mismo margen lateral. El saludo bajó una línea. El encabezado móvil pasó
de `px-4` a `px-5` (`--spacing-margin-mobile`, el mismo del `main` y el
de la portada) para que el wordmark no se corra 4px al cambiar de
pantalla.

### 2. La franja blanca de la barra de estado no era CSS

Arriba del indigo quedaba una banda clara donde va la hora y la isla
dinámica. No venía de un `padding` ni de un `safe-area`: era la meta
**`theme-color`** de `index.html`, que seguía en `#f8f9ff` de cuando la
app era blanca arriba. Ahora es `#1e1b4b`, el mismo `--color-primary` del
encabezado.

`viewport-fit=cover` ya estaba, así que no hizo falta tocarlo.

**Se verificó que no afecta al perfil público**, que es el que tiene
plantillas de color propias: `backend/apps/publico/views_shell.py`
**borra** esta meta y pone la del tema del negocio antes de servir el
HTML, y lo hace con un regex sobre el nombre de la tag, no sobre su
valor (`_META_THEME_COLOR`). Cambiar el color de acá no toca ese camino.
El test del backend usa un `index.html` de prueba propio, así que tampoco
depende del valor real.

**Test nuevo** (`src/tema/barraDeEstado.test.ts`): el `theme-color` de
`index.html` tiene que ser igual a `--color-primary` de
`design/tokens.css`. Es un literal en un HTML que ningún token alimenta —
si alguien cambia el color de marca, esto se queda con el viejo en
silencio y la franja de arriba deja de coincidir. Es la misma deriva del
preámbulo de `tokens.css`, en una franja de 40px que es fácil no mirar.

`tsconfig.app.json` suma `"node"` a `types` para ese test (compara dos
archivos fuente y necesita `node:fs`; `design/` está fuera de la raíz de
Vite, así que `?raw` da "Denied ID"). `@types/node` ya estaba.

### Verificación

93 tests en verde (venían 92), `tsc` limpio, `oxlint` sin avisos nuevos,
build OK, y confirmado que `dist/index.html` sale con el color nuevo —
que es el archivo que el backend lee para el shell del perfil público.

### Pendiente

- **iOS nativo no queda cubierto por `theme-color`**: esa meta la
  respetan Android/Chrome y las PWA, pero la barra de estado del
  contenedor de Capacitor en iOS se controla con `@capacitor/status-bar`.
  No se instaló: es una dependencia nueva y todavía no hay plataformas
  nativas agregadas (`npx cap add` sigue pendiente). Cuando se agreguen,
  hay que configurarla ahí con el mismo `#1e1b4b`.
