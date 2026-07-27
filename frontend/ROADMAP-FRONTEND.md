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
