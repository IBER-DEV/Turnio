# CLAUDE.md — Instrucciones del proyecto (raíz, compartida)

## Rol y equipo
Turnio es un SaaS multi-tenant para administración de barberías,
salones de belleza y centros estéticos. Backend en Django + Django
REST Framework; frontend y apps móviles (web admin, app cliente, app
empleado) en Capacitor + React.

**El proyecto lo construyen dos personas en paralelo, cada una con su
propia sesión de Claude Code:** una persona en `backend/`, otra en
`frontend/`. Este archivo (`CLAUDE.md` en la raíz) aplica a ambas.
Cada carpeta tiene además su propio `CLAUDE.md` con reglas específicas
de esa capa — Claude Code carga el de la raíz junto con el de la
carpeta donde se esté trabajando.

## Principio de diseño más importante
El caso más común es un dueño con VARIOS empleados (patrón típico de
barberías/salones en Colombia), no un operador único. El sistema debe
soportar bien ambos casos, pero no se diseña pensando en un solo
usuario como escenario central: la agenda maneja calendarios y
disponibilidad POR EMPLEADO desde el inicio, no como algo agregado
después. El modo de un solo operador es simplemente el caso n=1 dentro
de este mismo diseño (un negocio con un único empleado, que es también
el dueño), no un modo especial separado. Esto aplica tanto al modelo
de datos (backend) como a la UI (frontend): ninguna pantalla debe
asumir "un solo empleado" como caso por defecto.

Además, la reserva de citas por parte del cliente NO es una feature de
fase tardía: es el reemplazo directo de "llamar o escribir por WhatsApp
para pedir cita", que es el problema principal que el producto busca
resolver. Debe estar disponible desde el MVP (ver fases más abajo).

**Precisión sobre el MVP (2026-07-28, decisión del humano):** el
reemplazo de WhatsApp es el **enlace único y público del negocio**
(`turnio.app/{slug}`) — el dueño lo pega en su bio de Instagram o lo
manda por WhatsApp Business, y el cliente reserva ahí sin llamar. **No**
es un marketplace donde el cliente descubre negocios que no conocía:
eso necesita densidad de oferta que la plataforma no tiene todavía, y
construirlo antes es resolver un problema que ningún usuario real tiene
todavía. El endpoint de búsqueda (`GET /api/publico/negocios/`) ya
existe y se queda —no se revierte—, pero como infraestructura para el
buscador de Fase 6+, no como el flujo principal de Fase 2. Ver Fase 2
más abajo y `frontend/ROADMAP-FRONTEND.md` para el detalle de por qué.

## Cómo está organizado este repo
Monorepo con dos carpetas hermanas:
- `backend/` — Django + DRF. Ver `backend/CLAUDE.md` y
  `backend/ROADMAP-BACKEND.md`.
- `frontend/` — React + Capacitor. Ver `frontend/CLAUDE.md` y
  `frontend/ROADMAP-FRONTEND.md`.

Archivos compartidos en la raíz (los edita cualquiera de las dos
partes, respetando su formato):
- `CLAUDE.md` — este archivo.
- `ROADMAP.md` — estado del proyecto **por fase**, vista conjunta. El
  detalle día a día de cada lado vive en su propio sub-roadmap, no
  acá, para que las dos sesiones de Claude Code no compitan por las
  mismas líneas del mismo archivo.
- `CONTRATO.md` — el contrato entre backend y frontend (ver siguiente
  sección).
- `DECISIONES.md` — bitácora de **decisiones técnicas de arquitectura**
  con su contexto y lo que se descartó. Se agrega una entrada cuando una
  decisión responda a "¿por qué está hecho así?" y no a "¿qué falta?"
  (eso es roadmap) ni a "¿cómo le hablo al otro lado?" (eso es contrato).
  El propio archivo explica el criterio de reparto. Nunca se borran
  entradas: una decisión revertida se anota con otra entrada nueva.

## El contrato entre backend y frontend (léelo antes de asumir nada)
Como las dos partes se desarrollan en paralelo y potencialmente sin
que una sesión de Claude Code lea el código de la otra, **ninguna de
las dos debe adivinar cómo se comunican**. La fuente de verdad es:
- `backend/openapi.yaml`: schema autogenerado desde el código real del
  backend (`drf-spectacular`). Nunca se edita a mano; se regenera con
  el comando documentado en `CONTRATO.md`.
- `CONTRATO.md`: convenciones que el schema no captura (flujo de auth,
  formato de errores, modelo de capacidades, convenciones de nombres).

Regla de oro: **todo cambio de forma en un endpoint (backend) exige
regenerar `openapi.yaml` y anotar el cambio en el historial de
`CONTRATO.md` en el mismo commit.** El frontend nunca debe copiar
campos "porque seguro son así": si algo no está en el schema o en
`CONTRATO.md`, es una pregunta para el humano o una tarea pendiente
para backend, no una suposición.

## Coordinación entre las dos sesiones de Claude Code
- Cada sesión trabaja dentro de su carpeta (`backend/` o `frontend/`)
  y no edita archivos de la otra carpeta, salvo los tres archivos
  compartidos de la raíz listados arriba.
- Si backend necesita algo del frontend (o viceversa) que no existe
  todavía, se anota como "bloqueo/duda abierta" en `ROADMAP.md` (si
  concierne a ambas partes) o en el sub-roadmap propio — no se
  implementa unilateralmente del lado que no le corresponde.
- Ramas con prefijo por área: `feature/backend-*`, `feature/frontend-*`
  (ver "Flujo de trabajo con git" más abajo).

## Multi-tenancy (principio compartido)
Shared DB con campo `tenant_id` en todos los modelos de negocio del
backend (no schema-per-tenant). Todo endpoint filtra automáticamente
por el tenant del usuario autenticado; nunca se exponen datos cruzados
entre negocios. El frontend nunca debe intentar "elegir" un tenant
explícitamente en sus requests: el tenant siempre se deriva del token
de autenticación del lado del servidor. Detalle de implementación en
`backend/CLAUDE.md`.

## Gestión del roadmap (CRÍTICO — no te lo saltes)
1. Al INICIO de cada sesión, lee primero `ROADMAP.md` (vista conjunta)
   y luego el sub-roadmap de tu área (`backend/ROADMAP-BACKEND.md` o
   `frontend/ROADMAP-FRONTEND.md`) antes de escribir código.
2. Al FINAL de cada sesión o tarea significativa, actualiza **tu**
   sub-roadmap con: qué se completó, qué quedó pendiente, decisiones
   técnicas y su justificación, y bloqueos/dudas abiertas. Si en el
   camino tomaste una decisión de arquitectura (elegir un patrón,
   descartar una dependencia, aceptar una limitación a sabiendas),
   además va como entrada en `DECISIONES.md` — en el sub-roadmap queda
   el estado, en `DECISIONES.md` queda el porqué, que es lo que nadie
   puede reconstruir después leyendo el código.
3. Actualiza `ROADMAP.md` (raíz) solo cuando una fase completa cambia
   de estado, o cuando el bloqueo/decisión concierne a ambas partes.
4. Nunca borres historial en ningún roadmap, solo agrega.
5. Si una decisión de arquitectura ya tomada (ej. la estrategia de
   multi-tenancy, o el contrato OpenAPI) está siendo contradicha por
   una nueva instrucción, dilo explícitamente antes de proceder.

## Fases del proyecto (trabaja en este orden, un sprint a la vez)
- Fase 0: Setup, Docker, modelos base (Tenant, Negocio, Usuario,
  capacidades), auth JWT, registro de negocio con alta de empleados
  desde el inicio. *(Solo backend; frontend no tenía tareas aquí.)*
- Fase 1: Servicios, Empleados con capacidades individuales, Agenda con
  calendario por empleado, app Capacitor mínima para el negocio.
- Fase 2: Perfil público del negocio en su enlace único (`/{slug}`),
  reserva en línea sin cuenta, app Capacitor para el cliente. La
  búsqueda/descubrimiento de negocios (marketplace) se pospone a Fase
  6+ — ver principio de diseño más arriba.
- Fase 3: Caja, Comisiones automáticas, auditoría, soporte offline en
  esos flujos.
- Fase 4: Clientes (lado negocio), Reportes, panel administrativo,
  consentimiento de datos (Ley 1581 de 2012).
- Fase 5: Planes/suscripción, cobro recurrente, onboarding, push.
- Fase 6+: multi-sucursal, WhatsApp, inventario avanzado, fidelización,
  **marketplace** (búsqueda/descubrimiento de negocios, calificaciones,
  promociones, filtros), IA — solo después de validar las fases
  anteriores con negocios reales. El marketplace necesita densidad de
  oferta que no existe todavía; antes de eso, cada negocio se comparte
  por su propio enlace.

No avances a una fase nueva sin que la anterior esté funcional y
probada, salvo instrucción explícita del humano. Backend y frontend
pueden ir a ritmos distintos dentro de la misma fase (ej. backend
termina Servicios antes de que frontend termine su pantalla), pero la
fase no se da por completada en `ROADMAP.md` hasta que ambos lados
entreguen lo que les toca.

## Flujo de trabajo con git
- Una rama por feature/sprint, con prefijo de área:
  `feature/backend-agenda`, `feature/frontend-agenda`, etc.
- Commits pequeños y descriptivos.
- Antes de cerrar una tarea, corre los tests de tu área y actualiza tu
  sub-roadmap en el mismo commit o en uno inmediatamente posterior. Si
  tocaste la forma de la API, regenera `backend/openapi.yaml` y
  actualiza `CONTRATO.md` en el mismo commit.

## Qué NO hacer
- No implementes multi-sucursal, IA, o marketplace (búsqueda/
  descubrimiento de negocios, calificaciones, promociones, filtros)
  antes de que se indique explícitamente que se llegó a la Fase 6. El
  perfil público en su enlace único y la reserva sin cuenta SÍ son
  parte del MVP (Fase 2), no se excluyen — es la parte de "búsqueda"
  del cliente (encontrar un negocio que no conoce) la que se pospone,
  no la reserva.
- No agregues dependencias nuevas sin justificarlas brevemente en el
  sub-roadmap de tu área.
- No asumas que el negocio tiene un único empleado por defecto; diseña
  (o construye la UI) para varios empleados desde el inicio y deja que
  el caso de un solo empleado funcione como consecuencia natural del
  mismo modelo.
- No asumas la forma de un endpoint, un flujo de auth o un campo sin
  haber consultado `CONTRATO.md` / `backend/openapi.yaml` primero.
