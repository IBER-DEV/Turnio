# ROADMAP — Backend (Turnio)

> Detalle de trabajo del lado backend. Para el estado conjunto del
> proyecto (ambas partes) ver [`../ROADMAP.md`](../ROADMAP.md). Para el
> contrato con el frontend ver [`../CONTRATO.md`](../CONTRATO.md).
>
> Reglas: leer completo al empezar una sesión de backend; al terminar,
> agregar una entrada nueva (nunca borrar las anteriores); si un
> cambio afecta la forma de la API, regenerar `openapi.yaml` y anotarlo
> también en `../CONTRATO.md`.

## Fase 0 — COMPLETADA (2026-07-24)

### Qué se completó
- Repo git inicializado (rama `main`), `.gitignore`, `README.md`.
- Docker: `docker-compose.yml` (servicios `db` Postgres 16 y `backend`
  Django), `backend/Dockerfile`. Backend expuesto en el host en el
  puerto **8001** (el 8000 estaba tomado por otro proyecto local,
  `driveriq`, corriendo en esta misma máquina). El servicio `db` no
  publica puerto al host (los puertos 5432-5434 ya estaban en uso por
  otros proyectos locales); solo es accesible dentro de la red de
  Docker Compose vía el hostname `db`.
- Proyecto Django `config` en `backend/`, con apps en `backend/apps/`:
  - `apps.common`: `TenantScopedModel` (abstract base con FK a
    `Tenant`, para que todo modelo de negocio futuro —Servicio, Cita,
    Caja, etc.— lo herede en vez de repetir el campo), y
    `permissions.py` con `TieneMembresiaActiva` / `requiere_capacidad()`
    para el filtrado y los permisos por capacidad en la API.
  - `apps.tenants`: modelo `Tenant` (UUID pk, pensado para que en el
    futuro (Fase 6, multi-sucursal) un Tenant tenga varios `Negocio`
    sin migración de datos).
  - `apps.negocios`: modelo `Negocio` (hereda `TenantScopedModel`, slug
    autogenerado y único), `services.py` con `registrar_negocio()` y
    `agregar_empleado()`, serializers, vistas (`RegistroNegocioView`,
    `EmpleadoListCreateView`) y urls.
  - `apps.usuarios`: `Usuario` (custom user model, `email` como
    `USERNAME_FIELD`, sin `tenant` propio porque un usuario podría en
    el futuro pertenecer a varios negocios) y `MiembroNegocio` (vínculo
    Usuario↔Negocio con las capacidades booleanas: `puede_cobrar`,
    `puede_ver_reportes`, `puede_editar_precios`,
    `puede_gestionar_empleados`, `puede_gestionar_agenda`; constraint
    único usuario+negocio).
- Auth JWT con `djangorestframework-simplejwt` (login por email,
  access token 8h, refresh 14 días, rotación de refresh tokens).
- Endpoint `POST /api/negocios/registro/`: crea Tenant + Negocio +
  Usuario dueño (con **todas** las capacidades, caso operador único) y,
  opcionalmente en el mismo request, empleados adicionales con
  capacidades específicas (caso multi-empleado). Devuelve tokens JWT
  del dueño.
- Endpoint `GET/POST /api/negocios/empleados/`: lista/agrega empleados
  del negocio del usuario autenticado, siempre filtrado por su
  membresía activa (nunca expone empleados de otro tenant); crear
  requiere la capacidad `puede_gestionar_empleados`.
- 13 tests (pytest + pytest-django) cubriendo modelos, la capa de
  servicios (capacidades del dueño vs. empleado) y los endpoints
  (incluyendo aislamiento entre tenants y rechazo por falta de
  capacidad). Todos pasan corriendo dentro del contenedor Docker.
- Verificación manual end-to-end contra el contenedor corriendo:
  registro → login → listado de empleados, con curl.
- `drf-spectacular` agregado para generar `openapi.yaml` (contrato
  vivo con el frontend, ver `../CONTRATO.md`) + Swagger UI en
  `/api/docs/`.

### Dependencias añadidas (justificación)
- `djangorestframework` + `djangorestframework-simplejwt`: API REST y
  auth JWT, pedidas explícitamente en la arquitectura.
- `psycopg2-binary`: driver de Postgres.
- `python-dotenv`: cargar `.env` en `settings.py` sin lógica manual.
- `django-cors-headers`: el frontend Capacitor (web admin, apps
  cliente/empleado) consumirá la API desde otro origen; se necesita
  desde el primer endpoint público.
- `drf-spectacular`: genera el contrato OpenAPI real desde el código
  (`backend/openapi.yaml`), para que backend y frontend (dos Claude
  Code distintos, trabajando en paralelo) no se desincronicen sobre la
  forma de la API.
- `pytest` + `pytest-django` + `pytest-cov`: requeridos explícitamente
  para tests de servicios y endpoints.
- **No se agregó Celery/Redis todavía**: el stack técnico del plan los
  lista, pero nada en Fase 0 los usa (recordatorios, cálculo async de
  comisiones y reportes son de fases posteriores). Se agregan cuando
  haya un consumidor real, para no cargar infra sin uso.

### Pendiente / a medio hacer
- No hay superusuario creado por defecto ni fixture de datos demo.
- No hay CI configurado todavía (el plan lo menciona como parte de
  Fase 0 "Setup... CI básico" en `plan-accion.md`, pero no está en las
  instrucciones obligatorias de `CLAUDE.md`; queda pendiente de
  confirmación con el humano si se quiere GitHub Actions u otro).
- `SECRET_KEY` en `.env.example` es un valor de desarrollo débil
  (genera warning de `InsecureKeyLengthWarning` en los tests JWT); hay
  que generar una clave fuerte antes de cualquier despliegue real.
- `EmpleadoListCreateView` asume que el usuario autenticado tiene
  exactamente una membresía activa (caso típico hoy). Si en el futuro
  un mismo usuario pertenece a varios negocios a la vez (no solo
  multi-sucursal bajo un mismo tenant), `obtener_membresia_activa()`
  tomará la primera y habrá que decidir cómo el cliente elige "negocio
  activo" (ej. header o parámetro explícito).

### Decisiones técnicas y su justificación
- `Tenant` y `Negocio` como modelos separados (no fusionados) desde
  Fase 0, aunque hoy sea 1:1, para que el multi-sucursal de Fase 6 no
  requiera migrar datos ni cambiar la forma en que se filtra por
  tenant en el resto de la API.
- `TenantScopedModel` abstracto en `apps.common`: no es una
  abstracción especulativa, es literalmente lo que pide la arquitectura
  ("todo modelo de negocio debe tener tenant_id") aplicado de forma
  que Fase 1+ no repita el campo a mano en Servicio/Cita/Caja.
- Capacidades modeladas como booleanos planos en `MiembroNegocio`
  (no como tabla de permisos dinámica/JSON) porque el conjunto de
  capacidades es conocido y pequeño; evita sobre-ingeniería para el
  tamaño actual del proyecto.
- Contrato API como OpenAPI autogenerado (`drf-spectacular`) en vez de
  un documento a mano: con dos Claude Code trabajando en paralelo sin
  verse el código, un doc manual se desincroniza tarde o temprano; el
  schema generado desde el código real no puede mentir.

### Bloqueos o dudas abiertas para el humano
1. ¿Se quiere CI (GitHub Actions) ya en Fase 0, o se pospone hasta que
   el repo tenga remoto en GitHub?
2. Confirmar que el puerto 8001 (en vez de 8000) para el backend en
   local no choca con ninguna convención ya establecida en otras
   herramientas del equipo.

---

## Fase 1 — Núcleo operativo multi-empleado — backend COMPLETADO (2026-07-24)

> El backend de Fase 1 está listo; la fase completa (ver `../ROADMAP.md`)
> sigue abierta hasta que el frontend entregue su app Capacitor mínima.

### Qué se completó
- **`apps.servicios`**: modelo `Servicio` (hereda `TenantScopedModel`;
  `nombre`, `descripcion`, `categoria` texto libre, `precio`,
  `duracion_minutos`, `porcentaje_comision`, `activo`). `services.py`
  con `crear_servicio()` y `calcular_comision()` (esta última no se
  invoca todavía desde ningún flujo automático: la ejecución real al
  completar una cita y registrar el cobro es de Fase 3, cuando exista
  Caja). `ServicioViewSet` (CRUD) en `GET/POST/PATCH/DELETE
  /api/servicios/`: leer solo requiere pertenecer al negocio; escribir
  requiere `puede_editar_precios`.
- **Empleados**: `MiembroNegocio` ganó el campo `especialidad` (texto
  libre, informativo, no es una capacidad). Nuevo
  `EmpleadoDetailView` en `GET/PATCH /api/negocios/empleados/{id}/`
  para ver/editar capacidades y especialidad de un empleado puntual;
  editar requiere `puede_gestionar_empleados`, igual que crear.
- **`apps.agenda`**:
  - `HorarioTrabajo`: bloque recurrente semanal de disponibilidad por
    empleado (`miembro`, `dia_semana`, `hora_inicio`, `hora_fin`). No
    modela excepciones puntuales (vacaciones, incapacidad) todavía.
  - `Cita`: `negocio`, `empleado`, `servicio`, `fecha_hora_inicio`,
    `fecha_hora_fin` (calculada desde la duración del servicio),
    `estado` (máquina de estados `agendada → confirmada →
    completada`, con `cancelada` alcanzable desde `agendada` o
    `confirmada`), y datos mínimos del cliente inline
    (`nombre_cliente`, `telefono_cliente`) porque el módulo de
    Clientes formal es de Fase 4.
  - `services.py`: `crear_horario()` (valida hora_inicio < hora_fin),
    `empleado_disponible()` (cruza horario semanal + citas existentes,
    excluyendo canceladas), `agendar_cita()` (si no se pasa
    `empleado`, asigna el primero disponible entre los miembros
    activos del negocio — "cualquiera disponible"), y
    `cambiar_estado_cita()` (valida la transición contra
    `TRANSICIONES_VALIDAS` antes de guardar).
  - API: `GET/POST/PATCH/DELETE /api/agenda/horarios/` y
    `GET/POST /api/agenda/citas/` +
    `POST /api/agenda/citas/{id}/confirmar|completar|cancelar/`
    (acciones dedicadas, no `PATCH estado=`). Escribir/transicionar
    requiere `puede_gestionar_agenda`; leer solo requiere pertenecer
    al negocio.
- `backend/conftest.py`: fixtures compartidas de test
  (`negocio_con_dueno`, `servicio_de_prueba`,
  `cliente_autenticado_dueno`) para no repetir el boilerplate de
  registro+login en cada archivo de tests nuevo.
- 36 tests en total (23 nuevos de Fase 1) cubriendo: cálculo de
  comisión, aislamiento de tenant en Servicios y Citas, permisos por
  capacidad (`puede_editar_precios`, `puede_gestionar_agenda`,
  `puede_gestionar_empleados`), disponibilidad real vs. fuera de
  horario vs. cruce de citas, asignación automática "cualquiera
  disponible", y las cuatro transiciones de estado de `Cita`
  (incluida una transición inválida rechazada).
- `openapi.yaml` regenerado y validado sin errores ni warnings (se
  ajustaron los tres `ModelViewSet` nuevos con el guard
  `swagger_fake_view` en `get_queryset()`, para que drf-spectacular
  pueda introspectar el tipo de sus parámetros de ruta sin depender de
  `request.membresia`, que no existe durante la generación del schema).

### Decisiones técnicas y su justificación
- **`categoria` de `Servicio` es texto libre**, no un catálogo/enum
  separado: los tipos de negocio (barbería, salón, spa) tienen
  categorías muy distintas y fijarlas de antemano sería sobre-diseño;
  se revisita si Fase 4 (Reportes) necesita agrupar por categoría de
  forma más estricta.
- **`especialidad` vive en `MiembroNegocio`, no en un modelo aparte**:
  es un atributo del empleado dentro de ese negocio, igual que sus
  capacidades; crear un modelo "Empleado" separado hubiera duplicado
  la relación Usuario↔Negocio que `MiembroNegocio` ya resuelve.
- **`Cita` no tiene FK a un modelo `Cliente`**: ese módulo es de Fase 4.
  Se capturan `nombre_cliente`/`telefono_cliente` inline para no
  bloquear Fase 1 en una dependencia de una fase posterior; cuando
  exista `Cliente`, la migración natural es agregar una FK opcional y
  no romper las citas ya creadas (los campos inline pueden quedarse
  como "nombre capturado en el momento" incluso con cliente vinculado).
- **"Cualquiera disponible" se resuelve en el momento de crear la
  cita, no con un campo `empleado` nulo permanente**: una vez creada,
  toda `Cita` tiene un empleado concreto asignado. Esto simplifica
  reportes y agenda por empleado (Fase 4) porque nunca hay que
  re-resolver "a quién quedó asignada esta cita".
- **`calcular_comision()` existe pero no se invoca automáticamente
  todavía**: construirla ahora sin usarla evita que Fase 3 tenga que
  re-derivar la fórmula, pero disparar el cálculo real pertenece al
  flujo de Caja (registrar cobro), que no existe aún. No es código
  muerto especulativo: es la función que Fase 3 va a llamar, ya
  probada.
- **Sin excepciones puntuales de horario (vacaciones, incapacidad) en
  esta fase — decisión confirmada por el humano (2026-07-24)**: son un
  problema distinto al almuerzo (ver abajo): `HorarioTrabajo` modela un
  patrón *semanal recurrente*; una incapacidad es una excepción de
  *fecha específica* que rompe ese patrón y requeriría un concepto
  nuevo (algo como `BloqueoAgenda` con rango de fechas y motivo). El
  costo de no tenerlo hoy es bajo a escala de un piloto (el dueño
  reagenda manualmente), así que se espera a que un negocio real lo
  pida antes de diseñarlo, en vez de adivinar la forma de la
  excepción (¿día completo?, ¿rango de horas?, ¿requiere aprobación?).
- **El almuerzo NO requería una feature nueva — ya estaba resuelto**:
  se verificó que (a) `HorarioTrabajo` no tiene ningún
  `unique_together`/constraint que impida dos bloques el mismo
  `(miembro, dia_semana)`, y (b) `empleado_disponible()` ya usa
  `.filter(...).exists()` (no `.get()`), por lo que evalúa correctamente
  contra **todos** los bloques del día. Un descanso de almuerzo se
  modela con dos filas de `HorarioTrabajo` el mismo día (ej. 8-12 y
  13-18); una cita que cruce el hueco entre bloques correctamente no
  encuentra disponibilidad. Se agregó
  `test_empleado_soporta_dos_bloques_el_mismo_dia_para_modelar_el_almuerzo`
  para fijar este comportamiento como contrato de test, ya que antes
  era una garantía implícita sin cobertura.

### Pendiente / a medio hacer
- `HorarioTrabajoViewSet` y `CitaViewSet` asumen que solo quien tiene
  `puede_gestionar_agenda` puede tocar el horario de **cualquier**
  empleado del negocio, incluyendo el propio. No hay todavía un modo
  "autogestión" donde un empleado sin esa capacidad pueda ver/editar
  únicamente su propio horario — es una mejora razonable de UX que no
  bloquea el MVP (el dueño o quien tenga esa capacidad puede cargar el
  horario de todos).
- `Cita` no valida que `fecha_hora_inicio` no esté en el pasado ni que
  el negocio esté abierto ese día/hora (no existe todavía un concepto
  de "horario del negocio" separado del horario por empleado). Queda
  como refinamiento de validación antes de exponer reserva de clientes
  en Fase 2.
- Excepciones puntuales de horario (vacaciones/incapacidad): pendiente
  a propósito, ver decisión arriba. No es un bloqueo, es un "no
  todavía" confirmado.

### CI (GitHub Actions) — resuelto (2026-07-24)
Se agregó `.github/workflows/backend-ci.yml`: corre en cada push/PR
que toque `backend/**`, contra un servicio Postgres 16. Pasos:
1. `makemigrations --check --dry-run` (falla si falta una migración).
2. `migrate`.
3. Regenera el schema OpenAPI a un archivo temporal y hace `diff`
   contra `backend/openapi.yaml` committeado — **falla el build si el
   contrato no se regeneró** después de un cambio de API, forzando en
   CI la regla de oro de `CONTRATO.md` en vez de depender de que se
   recuerde a mano.
4. `pytest`.

Verificado localmente (fuera de GitHub Actions) que los tres comandos
clave pasan limpio: `makemigrations --check --dry-run` sin cambios,
`spectacular --validate` + diff sin diferencias, y la suite completa
(37 tests).

### Bloqueos o dudas abiertas para el humano
(ninguno pendiente de esa sesión — CI resuelto, almuerzo verificado
y confirmado sin cambios, vacaciones/incapacidad pospuesto a
propósito por decisión explícita del humano)

---

## Fase 1 — ajuste posterior: endpoint "quién soy" (2026-07-24)

El compañero de frontend preguntó cómo sabría la UI qué mostrar sin
tener roles fijos, y al explicar el flujo (login → listar empleados →
buscarse por email) quedó claro que era un workaround frágil: el login
no devuelve email/capacidades, así que el frontend tenía que recordar
el email escrito en el formulario para poder identificarse después en
la lista de empleados. Se decidió (confirmado por el humano) cerrar
ese hueco con un endpoint dedicado en vez de dejar que el frontend
construyera sobre el workaround.

### Qué se completó
- `GET /api/negocios/mi-membresia/` (`MiMembresiaView`, sin capacidad
  requerida — solo pertenecer a un negocio activo): devuelve la
  membresía del usuario autenticado con `negocio` anidado
  (`MiMembresiaSerializer`). Resuelve `request.membresia` (ya
  adjuntada por `TieneMembresiaActiva`) directamente, sin queryset.
- **Bug encontrado y corregido en el camino**: `TieneMembresiaActiva.has_permission`
  no comprobaba `request.user.is_authenticated` antes de resolver la
  membresía, así que un request sin token (usuario `AnonymousUser`)
  hacía explotar `obtener_membresia_activa()` con `AttributeError` →
  `500`, en vez del `401` que la sección 4 de `CONTRATO.md` ya
  documentaba. Afectaba a **todos** los endpoints protegidos por esta
  permission o por `requiere_capacidad(...)` (empleados, servicios,
  horarios, citas), no solo al nuevo endpoint. Se agregó el chequeo de
  `is_authenticated` al inicio del método, más un test dedicado en
  `apps/common/tests/test_permissions.py` que fija el comportamiento
  correcto para no volver a perderlo.
- 4 tests nuevos (2 de `mi-membresia`, 2 de la regresión de permisos).
  Suite completa: 41 tests.
- `openapi.yaml` y `CONTRATO.md` actualizados (nueva sección 3.1).

### Decisión y justificación
- El endpoint devuelve `negocio` **anidado**, no solo las capacidades:
  el frontend necesita el nombre/ciudad/slug del negocio en el primer
  render (ej. header de la app) tanto como las capacidades, y evitar
  un segundo request para eso.
- No requiere ninguna capacidad especial (solo pertenecer a un negocio
  activo): es información sobre uno mismo, no una acción sobre el
  negocio.

---

## Fase 1 — ajuste posterior: schema mal documentado en creación de empleados (2026-07-24)

Detectado por el frontend (rama `feature/frontend-fase1`) al generar
tipos TypeScript desde `openapi.yaml`: `POST /api/negocios/empleados/`
documentaba su body de entrada como `MiembroNegocio` (con campos de
solo lectura, sin `password`), cuando el comportamiento real siempre
usó `EmpleadoAltaSerializer`.

**Causa raíz**: `@extend_schema` estaba puesto sobre el método
`create()` de `EmpleadoListCreateView`, una `generics.ListCreateAPIView`.
A diferencia de un `ViewSet` (donde el router mapea el verbo HTTP
directamente al método `create`), en las vistas genéricas de DRF el
método que efectivamente resuelve el POST es `post` — definido por
`ListCreateAPIView` y que internamente llama a `self.create(...)`.
drf-spectacular inspecciona `post`, no `create`, así que la anotación
nunca se aplicaba y caía a inferencia automática desde
`serializer_class`.

**Fix**: `@extend_schema_view(post=extend_schema(...))` a nivel de
clase — el patrón que la propia documentación de drf-spectacular
recomienda para anotar "métodos derivados" de mixins que no están
directamente expuestos como el verbo HTTP. Sin cambio de
comportamiento (el endpoint siempre aceptó `EmpleadoAlta`; solo el
schema estaba mal). `openapi.yaml` regenerado y `CONTRATO.md`
actualizado con la explicación completa, incluyendo el aviso de
revisar cualquier otra vista `generics.*APIView` con un método
sobrescrito por si tiene el mismo problema. Suite completa (41 tests)
sigue en verde.

## Escritura en lote: horario semanal y alta de servicios (2026-07-25)

> Pedido que venía anotado como duda abierta desde frontend (punto 5 de
> `../ROADMAP.md`). Lo resolvió la misma persona que hizo el frontend,
> así que se implementó de una en vez de quedar en la cola.

### Qué se agregó
- **`PUT /api/agenda/horarios/semana/`** — reemplaza el horario semanal
  completo de un empleado en una sola transacción. Body: `{miembro,
  franjas: [{dia_semana, hora_inicio, hora_fin}]}`.
- **`POST /api/servicios/lote/`** — crea varios servicios; entran todos
  o ninguno.

Lógica en `services.reemplazar_horario_semanal` y
`servicios.services.crear_servicios_en_lote`, siguiendo la regla de
capa de servicios: las vistas solo orquestan HTTP.

### Por qué
El frontend estaba resolviendo ambas cosas con **N llamadas HTTP** (un
POST/DELETE por franja al editar la semana, un POST por servicio al dar
de alta desde el catálogo). Funcionaba, pero no era atómico: con la red
de un local comercial era esperable que entraran 7 de 10 servicios, o
que un empleado quedara con media semana cargada, sin forma de saber
qué reintentar.

### Decisiones de diseño
- **Semántica de reemplazo, no de agregado**, en el horario semanal: la
  lista enviada *es* el horario del empleado. Se eligió sobre un
  "agregar varias franjas" porque es lo que el editor de la UI necesita
  (el usuario ve y edita la semana completa), y porque un endpoint que
  agrega obligaría igual a borrar por separado lo que se quitó — que es
  justo el problema de atomicidad que se venía a resolver.
- **Endpoint aparte en vez de aceptar lista en el `POST` normal**: hacer
  que `POST /api/servicios/` acepte objeto o lista habría dejado el
  schema con un `oneOf` que el frontend tendría que desambiguar en cada
  llamada. Un `/lote/` explícito es más feo de nombre pero más claro de
  consumir.
- **Validación de solapamientos dentro del servicio**, no del
  serializer: es regla de negocio (dos franjas del mismo empleado no
  pueden cruzarse), no validación de forma del payload.
- Se mantiene todo el CRUD de a uno: sigue siendo el camino correcto
  para editar un solo elemento.
- Borrar horarios **no** toca las citas ya agendadas: la `Cita` guarda
  su propia fecha/hora y no se recalcula. Hay test que lo cubre
  indirectamente (el reemplazo no falla con citas existentes).

### Tests
19 tests nuevos (55 en total, antes 36), priorizando la capa de
servicios como manda `CLAUDE.md`. Cubren: creación de la semana
completa, que reemplaza y no acumula, dos franjas el mismo día (caso
del almuerzo), rechazo de franjas cruzadas y de hora invertida,
**que un fallo no deja estado parcial** (el caso que motivó el
endpoint), lista vacía como "sin disponibilidad", atomicidad del lote de
servicios, y aislamiento por tenant (pasar el `miembro` de otro negocio
responde 400 sin tocar datos ajenos).

### Contrato
`openapi.yaml` regenerado y `../CONTRATO.md` actualizado: nueva sección
5.5 (convención de escritura en lote) + entrada en el historial.

## Cierre de fuga de datos: directorio de equipo vs. gestión (2026-07-25)

> Salió de una pregunta del humano sobre la UI ("si un empleado no puede
> gestionar equipo, ¿debería siquiera ver esa pantalla?"). Al revisarlo,
> el problema real no era la pantalla sino el endpoint.

### El problema
`GET /api/negocios/empleados/` exigía solo `TieneMembresiaActiva`, y
`MiembroNegocioSerializer` devuelve `email` + los cinco flags `puede_*`
de cada miembro. Es decir: **cualquier empleado sin permisos podía
consultar los correos y la matriz de permisos de todo el equipo.**
Ocultar la pantalla en el frontend no habría arreglado nada — el dato
seguía a un `curl` de distancia. Mismo problema en
`GET /api/negocios/empleados/{id}/`.

No se podía simplemente cerrar el endpoint: la agenda lo usa
legítimamente para el filtro por empleado, el selector de "a quién
asignar" y el editor de horarios.

### La solución
Partirlo en dos endpoints con responsabilidades distintas:
- **`GET /api/negocios/equipo/`** (nuevo) — `MiembroEquipoSerializer`:
  solo `id`, `nombre`, `especialidad`, `activo`. Cualquier miembro.
- **`/empleados/`** — sigue con datos completos, pero ahora exige
  `puede_gestionar_empleados` para leer, no solo para escribir.

Se prefirió dos endpoints sobre un solo endpoint que devuelva más o
menos campos según quién pregunte: esto último habría dejado el schema
OpenAPI mintiendo (una forma declarada, dos formas reales) y obligaría
al frontend a defenderse de campos ausentes en cada uso.

### Es un cambio con ruptura
Cualquier consumidor que usara `/empleados/` solo para obtener nombres
debe migrar a `/equipo/`. El frontend ya lo hizo (Agenda y editor de
horarios). Anotado como tal en `../CONTRATO.md`.

### Tests
5 nuevos (60 en total): que listar y ver detalle de empleados ahora dan
403 sin la capacidad, que `/equipo/` sí lo puede ver cualquier miembro,
que `/equipo/` **no** expone email ni capacidades (se afirma el set
exacto de claves, no solo la ausencia), y que no cruza tenants.

## Citas propias: cerrar el hueco de "veo mis citas pero no puedo confirmarlas" (2026-07-25)

> Lo detectó el humano usando la app: un empleado sin
> `puede_gestionar_agenda` veía sus citas del día pero no podía
> confirmarlas. Preguntó si lo arreglaba el frontend — no: el backend
> respondía 403, así que ocultar los botones era lo correcto dado ese
> backend. El hueco estaba en el modelo de permisos.

### Diagnóstico
`puede_gestionar_agenda` se estaba usando para dos cosas distintas:
administrar la agenda del negocio (crear citas, editar horarios de
cualquiera) y tocar una cita puntual. Un barbero raso necesita lo
segundo sobre lo suyo sin tener lo primero.

### Decisión: propiedad implícita, sin capacidad nueva
Se evaluó agregar `puede_gestionar_agenda_propia` como sexto flag. Se
descartó (decisión del humano) porque sería un flag en `true` para
prácticamente todo empleado: ruido en la matriz de capacidades, una
migración y un switch más en la UI, a cambio de nada. El razonamiento
de fondo: **no es un permiso que el dueño conceda, es propiedad** — uno
siempre puede actuar sobre su propio trabajo.

Se incluyeron las tres transiciones, `cancelar` incluida (también
decisión del humano): cubre "me enfermé" y "el cliente no llegó" sin
depender de que el dueño esté disponible.

### Implementación
Nueva factory `requiere_capacidad_o_ser_titular(capacidad, campo)` en
`apps/common/permissions.py`, que resuelve en `has_object_permission`:
pasa si tiene la capacidad, o si el objeto es suyo. Se dejó genérica
porque el mismo patrón va a hacer falta en Fase 3 (un empleado
consultando su propia comisión).

`CitaViewSet.get_permissions` la usa **solo** para
`confirmar`/`completar`/`cancelar`. `create`/`update`/`destroy` siguen
con `requiere_capacidad`, y está documentado por qué: en `create` no
hay objeto contra el cual comprobar propiedad, así que usar ahí la
factory dejaría crear citas a cualquier miembro.

### Tests
5 nuevos (65 en total). Se verificó que **3 de ellos fallan con
`403 == 200`** contra los permisos anteriores (los otros 2, los de
restricción, ya pasaban) — o sea que la suite mide el hueco real y no
algo trivialmente cierto. Cubren: confirmar/completar/cancelar la
propia cita sin la capacidad, que la cita de otro empleado sigue dando
403, y que crear citas sigue exigiendo la capacidad.

### Contrato
Ampliación, no ruptura: quien antes podía, sigue pudiendo. `CONTRATO.md`
sección 5.3 reescrita + entrada en el historial. `openapi.yaml`
regenerado (cambia la descripción del endpoint).

## El horario pasa a ser del negocio, con el del empleado como excepción (2026-07-26)

> Salió de una observación del humano usando la app: "al usuario le toca
> asignarle el horario a sus empleados uno por uno, cuando lo normal es
> que un negocio maneje el mismo horario para todos". Y acto seguido, la
> corrección que reencuadró el problema: **"los horarios son de los
> negocios, no de empleados"**.

### El diagnóstico, y por qué la primera solución era la equivocada
La lectura inicial fue "hay que poder aplicar el mismo horario a varios
empleados de una", y se empezó a implementar como una escritura en lote:
`PUT .../semana/` recibiendo `miembros: []` y copiando las mismas franjas
a cada uno. Eso automatizaba el síntoma. El horario seguía viviendo N
veces —una por empleado—, así que cambiar la hora de apertura del local
obligaba a re-aplicarla a todo el equipo, y cada empleado nuevo entraba
sin disponibilidad hasta que alguien se acordara de configurárselo.

La causa real era que **no existía el concepto de horario del negocio**.
Ya estaba anotado como hueco conocido en la sección de Fase 1 de este
mismo archivo ("`Cita` no valida que el negocio esté abierto ese día/hora
porque no existe todavía un concepto de horario del negocio separado del
horario por empleado"); no se había conectado con este problema.

### Tensión con una decisión de arquitectura ya tomada
"Agenda por empleado desde el inicio" está registrado en `../ROADMAP.md`
y en `../CLAUDE.md`. Se señaló explícitamente la contradicción antes de
proceder, como manda la regla 5 de gestión del roadmap. **La decisión del
humano fue el punto medio, no la lectura literal**: el negocio manda, el
empleado puede diferir. La disponibilidad por empleado sigue existiendo y
sigue siendo lo que resuelve la agenda — solo que ahora casi siempre se
deriva del negocio en vez de cargarse a mano. Se descartó explícitamente
la variante de eliminar `HorarioTrabajo` (rompía al barbero de medio
tiempo, al de solo sábados y a los turnos rotativos).

### Qué se implementó
- **Modelo `HorarioNegocio`** (`agenda.0003_horarionegocio`): mismo shape
  que `HorarioTrabajo` pero colgando de `Negocio`. Admite varios bloques
  el mismo día (cierre de mediodía del local), igual que el del empleado.
- **`services.reemplazar_horario_negocio()`** y extracción de
  `_validar_franjas()`, que ahora comparten el horario del negocio y el
  del empleado: la validación de la semana (horas coherentes, sin cruces
  dentro del día) es independiente de a quién se le aplique.
- **`services._franjas_vigentes()`** — la resolución de la herencia, que
  es el corazón del cambio. `empleado_disponible()` ahora la usa en vez
  de leer `HorarioTrabajo` directo.
- **`GET/PUT /api/agenda/horario-negocio/`** (`HorarioNegocioView`,
  `APIView` anotada con `@extend_schema_view`): leer solo requiere
  pertenecer al negocio, escribir requiere `puede_gestionar_agenda`. El
  negocio sale del token, nunca del body.
- **`PUT /api/agenda/horarios/semana/` pasa a recibir `miembros: []`**
  (ver "sobre la generalización" abajo).

### Decisiones técnicas y su justificación
- **Se pregunta si el empleado tiene horario propio en TODA la semana, no
  día por día.** Si se preguntara por día, un empleado configurado "solo
  sábados" heredaría el lunes del negocio — exactamente lo contrario de
  lo que quiso decir quien lo configuró así. Hay test dedicado
  (`test_horario_propio_de_un_dia_no_hace_heredar_los_demas`) porque es
  la clase de sutileza que alguien "arregla" de buena fe filtrando por
  día en el mismo query.
- **El horario propio reemplaza, no interseca con el del negocio.** Si el
  local abre 9–18 y a alguien se le puso 8–20, vale 8–20. Se evaluó
  intersecar (más "correcto" en el sentido de que el local está cerrado a
  las 8) y se descartó: hay quien abre temprano con llave propia, y sobre
  todo, un recorte silencioso es imposible de explicar en la UI —
  "configuré las 8 y el sistema agenda desde las 9" es un bug reportado,
  no una feature entendida.
- **`franjas: []` cambió de significado**: antes dejaba al empleado sin
  disponibilidad, ahora le quita la excepción y lo devuelve a heredar. La
  palanca para "esta persona no atiende" es `activo=False`, que ya
  existía y expresa exactamente eso. Tener dos formas de decir "no
  trabaja" sería peor que reusar la que ya está.
- **`empleado_disponible()` ahora chequea `activo`.** No es un extra: con
  herencia, un miembro inactivo sin franjas propias tomaría las del local
  y quedaría agendable. Antes quedaba fuera por accidente (no tenía
  franjas), no por diseño.

### Sobre la generalización de `/semana/` a `miembros: []`
Se mantuvo aunque la herencia le quita la mayor parte de su razón de ser
original. Sigue sirviendo al caso real de "los tres de medio tiempo
comparten turno", es coherente con el principio del proyecto de tratar al
equipo como plural (un empleado es el caso n=1), y ya estaba escrita y
probada. Es un cambio con ruptura: quien mande `miembro` singular recibe
`400`. El único consumidor era el modal del frontend, que se reescribió
en el mismo cambio.

### Tests
16 nuevos (81 en total, antes 65), priorizando la capa de servicios.
Cubren la herencia (empleado sin horario propio, empleado recién dado de
alta disponible sin configurarle nada), la excepción (propio reemplaza y
no amplía; propio de un día no hace heredar los demás), el inactivo que
no debe quedar agendable por herencia, `franjas: []` devolviendo a
heredar, y del lado del lote: varios empleados de una, empleado repetido
sin duplicar franjas, atomicidad con varios, y un id ajeno colado entre
ids propios que no debe pasar ni a medias.

Verificado además de punta a punta contra el contenedor: negocio nuevo →
no se puede agendar sin horario → se carga el horario del negocio una
sola vez → se agenda "cualquiera disponible" con **cero** horarios
propios cargados → se marca a la empleada como excepción y deja de tomar
citas el lunes → se le vacía el horario propio y vuelve a heredar.

### Contrato
`openapi.yaml` regenerado y validado. `../CONTRATO.md`: nueva sección 5.7
(la jerarquía de horarios y sus reglas de resolución), sección 5.6
actualizada, y entrada de historial marcada como **cambio con ruptura**
con los cuatro puntos que rompen.

### Pendiente / a medio hacer
- El hueco de "`Cita` no valida que el negocio esté abierto" queda **a
  medias a propósito**: ya existe el dato contra el cual validar, y de
  hecho la disponibilidad heredada lo usa. Pero no se agregó una
  validación explícita de "el negocio está cerrado ese día" para el caso
  de un empleado con horario propio fuera del horario del local, porque
  esa es justamente la excepción que se decidió permitir (ver arriba).
- Sigue sin haber excepciones puntuales de fecha (vacaciones,
  incapacidad). El modelo nuevo no las acerca ni las aleja.
- Los negocios ya existentes en una base de datos con datos quedan sin
  `HorarioNegocio` cargado y con el horario propio de cada empleado
  intacto, así que **siguen funcionando igual que antes** (todos son
  excepciones). No se escribió una migración de datos que promueva "el
  horario que comparten todos" a horario del negocio: con el proyecto
  todavía sin negocios reales en producción, adivinar esa promoción es
  más riesgoso que dejar que el dueño cargue el horario del local una vez.

## Auditoría del modelo de permisos: dos capacidades nuevas y cierre de una escalada (2026-07-26)

> El humano preguntó si era momento de introducir **roles**, a partir de un
> caso concreto: *"un dueño quiere que uno de sus empleados gestione las
> citas pero no el horario del negocio"*, y pidió evaluar qué otros
> permisos harían falta sí o sí antes de seguir agregando de a uno.

### La respuesta sobre roles: no, y el caso citado es la evidencia
Los roles agrupan capacidades. No dicen nada sobre **alcance** (sobre qué
objetos se puede actuar), que es el eje donde estaban saliendo los
problemas: el de "citas propias" del 25 y este de "ver la agenda ajena".
Con roles habría hecho falta igual la excepción de propiedad por encima
del rol. Se mantiene la decisión de arquitectura registrada (capacidades,
no roles fijos), con un disparador explícito para reabrirla: cuando el
formulario de alta pase de ~8 flags, o cuando se repita la misma
combinación una y otra vez. Si el dolor real es lo tedioso del alta, la
salida barata son **presets de UI** sobre las capacidades existentes —
cero cambios de modelo.

Nota honesta: este cambio nos deja en 7 capacidades, cerca de ese umbral.

### Lo que encontró la auditoría
Se revisaron todos los gates de todas las vistas. `puede_gestionar_agenda`
estaba decidiendo cuatro cosas distintas (horario del local, horario de
empleados, operar citas, supervisar citas ajenas), y aparecieron dos
problemas más:

- **Escalada de privilegios, explotable en ese momento**:
  `EmpleadoDetailView` es un `RetrieveUpdateAPIView` con
  `MiembroNegocioSerializer` —cuyos flags `puede_*` son escribibles— y su
  queryset es `negocio.miembros.all()`, que incluye la propia membresía
  del solicitante. Cualquiera con `puede_gestionar_empleados` podía
  concederse el resto de capacidades con un `PATCH` sobre sí mismo.
- **Fuga de la libreta de clientes**: `GET /api/agenda/citas/` no
  filtraba por miembro y `CitaSerializer` incluye `nombre_cliente` y
  `telefono_cliente`. Cualquier empleado podía exportarse los clientes de
  todo el negocio — relevante dado el modelo de alquiler de silla /
  comisión que describe `../ESTRATEGIA-COMPETITIVA.md`.

### Qué se implementó
- **`puede_configurar_horarios`** — `PUT /api/agenda/horario-negocio/` y
  todo `/api/agenda/horarios/` (incluido `/semana/`). `puede_gestionar_agenda`
  se queda con operar citas.
- **`puede_ver_agenda_completa`** — `CitaViewSet.get_queryset()` filtra a
  `empleado=membresia` sin ella. Se filtró en el **queryset** y no en un
  permiso a propósito: así acota también `retrieve` y las transiciones, y
  una cita ajena responde `404` en vez de `403` — que además es la
  respuesta correcta según `../CONTRATO.md` 5.2, porque un `403`
  confirmaba que la cita existía.
- **`negocios.services.validar_cambio_de_capacidades()`** — las dos
  reglas anti-escalada, en la capa de servicios y llamada desde los dos
  serializers que aceptan flags (`MiembroNegocioSerializer` en edición y
  `EmpleadoAltaSerializer` en alta).

### Decisiones y su justificación
- **La escalada se cerró con reglas, no con una capacidad nueva.** No
  hay nada que conceder: es un límite sobre cómo se ejerce una capacidad
  que ya existe. Agregar un flag habría sido responder a un problema de
  alcance con más agrupación, justo lo que se le criticó a los roles.
- **Quitar una capacidad que uno no tiene sí se permite.** Reducir
  permisos ajenos no amplía los propios, y bloquearlo dejaría a un
  administrador sin poder frenar a alguien con más capacidades que él —
  exactamente cuando más falta hace.
- **Solo cuentan los cambios reales.** Reenviar una capacidad con el
  valor que ya tenía no se considera intento de auto-ascenso; si no, un
  `PATCH` idempotente del frontend rebotaría sin motivo.
- **`puede_gestionar_agenda` conservó el nombre** en vez de renombrarse a
  `puede_gestionar_citas`. Es su uso más frecuente, y así la migración de
  datos no toca a nadie que ya la tuviera.
- **No se separó `puede_editar_precios`** (catálogo vs. precios): en una
  barbería pequeña la distinción es marginal. **Pero queda anotado como
  bloqueante de Fase 3**, ver abajo.

### Migración de datos
`0003_miembronegocio_puede_configurar_horarios_and_more` incluye un
`RunPython` que pone las dos capacidades nuevas en `true` para quien ya
tenía `puede_gestionar_agenda`. Esas membresías no notan nada. Para el
resto **sí hay cambio de comportamiento** —un empleado raso deja de ver
la agenda del negocio— y ese es precisamente el objetivo.

### Tests
23 nuevos (104 en total, antes 81), en dos archivos:
- `apps/negocios/tests/test_escalada_privilegios.py` (8)
- `apps/agenda/tests/test_capacidades.py` (15)

**Se verificó que miden el hueco real**: neutralizando
`validar_cambio_de_capacidades`, los 3 tests de restricción fallan con
`200 == 400` y los 5 de "esto sigue permitido" pasan igual — o sea que la
suite distingue las dos direcciones y no afirma algo trivialmente cierto.

Un test viejo cambió de expectativa: `test_empleado_sin_gestionar_agenda_no_puede_tocar_la_cita_de_otro`
pasó de esperar `403` a `404`, con el porqué escrito en su docstring.

Hay además un test de deriva (`test_el_alta_de_empleados_cubre_todas_las_capacidades_del_modelo`)
que falla si se agrega una capacidad al modelo y se olvida en
`EmpleadoAltaSerializer`, que fue justo el tipo de despiste que este
cambio pudo cometer (y de hecho cometió con `MiMembresiaSerializer`: lo
atrapó su propio test antes de llegar al frontend).

Verificado además de punta a punta contra el contenedor: 13 casos
cubriendo el escenario de la recepcionista, la visibilidad de la libreta
de clientes y los seis casos de escalada.

### Pendiente / a medio hacer
- **Bloqueante de Fase 3**: `porcentaje_comision` vive en `Servicio` y es
  escribible por `puede_editar_precios`. Hoy es inerte porque
  `calcular_comision()` no se invoca en ningún flujo, pero cuando exista
  Caja, quien pueda editar servicios podrá subirse su propia comisión.
  **Separar antes de conectar el cálculo real.**
- `puede_cobrar` y `puede_ver_reportes` siguen declarados y sin
  enforcement (son de Fase 3 y 4). La UI ya muestra sus interruptores, o
  sea que el dueño los activa y no pasa nada. Decidir si se ocultan hasta
  que sirvan o se marcan como "próximamente".
- Nada impide que alguien con `puede_gestionar_empleados` **desactive**
  (`activo=False`) al dueño o a sí mismo. Es denegación de servicio, no
  escalada, y no se abordó en este cambio.
- El alta de empleados en `POST /api/negocios/registro/` no aplica las
  reglas anti-escalada porque no hay solicitante todavía. Es correcto —el
  dueño se crea con todo en ese request— pero conviene recordarlo si
  alguna vez ese endpoint deja de ser el registro inicial.

## Las capacidades se mudan a `Cargo`, y nace el discriminador de dominio (2026-07-26)

> Decisión del humano, corrigiendo el enfoque del mismo día: los roles en
> el frontend fueron "muy precipitado". Quiere una tabla de cargos en el
> backend que **el dueño gestione él mismo**, manteniendo cero
> complejidad, y que el backend le mande al frontend el **tipo de
> usuario** para decidir qué pantalla cargar sin encadenar condicionales
> por permiso — arquitectura PBAC y UI state-driven desde el principio.

### Sobre la decisión de arquitectura registrada
`CLAUDE.md` prohíbe "un enum cerrado de roles (Dueño/Empleado/
Recepcionista)". Se señaló explícitamente antes de proceder y **no hay
contradicción**: `Cargo` es por tenant y editable por el dueño, no un
catálogo global en el código. Lo que se prohibía era fijar los roles;
acá los fija cada negocio. Se actualizó `CLAUDE.md` (backend y frontend)
para que la regla diga lo que ahora es cierto.

### El modelo
- **`apps.usuarios.Cargo`**: `negocio`, `nombre`, `tipo` y las siete
  capacidades. Único por `(negocio, nombre)`.
- **`MiembroNegocio` pierde los siete flags** y gana `cargo`
  (`on_delete=PROTECT`). Es la **única fuente de verdad**: no hay
  excepciones por persona. Se descartó el modelo mixto (cargo que siembra
  + override individual) porque obliga a responder qué pasa al editar un
  cargo que alguien ya tenía modificado, y esa pregunta no tiene
  respuesta buena.
- **`MiembroNegocio.tiene(capacidad)`**: el único camino para preguntar
  por un permiso. Evita que cada llamador se acuerde de atravesar el
  cargo y de que puede ser nulo.
- **`Cargo.tipo`** (`administracion` / `recepcion` / `operativo`): el
  discriminador de dominio, expuesto en `mi-membresia.tipo`.

### Decisiones y su justificación
- **El discriminador es explícito, no derivado de las capacidades.**
  Derivarlo habría evitado un campo, pero entonces darle "ver agenda
  completa" a un barbero le cambiaría toda la pantalla inicial sin que
  nadie lo pidiera. Con un campo, la decisión es del dueño y es estable.
- **`tipo` nunca filtra datos.** Está escrito en el docstring del modelo
  y en `CONTRATO.md` 5.10: si el tipo fuera la barrera, bastaría pedir
  otra ruta. Sirve para dibujar, no para proteger.
- **`tipo` se serializa con `ChoiceField`, no `CharField`**, para que
  drf-spectacular emita el enum y el frontend reciba una unión de
  literales. Un `string` suelto habría dejado el routing sin tipar, que
  es justo lo que este cambio venía a resolver.
- **La escalada de privilegios ahora tiene dos puertas.** Editar el cargo
  propio y mudarse a otro cargo son la misma escalada; cerrar solo una no
  sirve de nada. `validar_cambio_de_capacidades` cubre la primera,
  `validar_asignacion_de_cargo` la segunda. **Recortar y renombrar el
  cargo propio sí se permite** — la regla es contra ampliarse.
- **El alta dentro del registro usa un serializer aparte**
  (`EmpleadoAltaRegistro`, sin `cargo`). En ese request los cargos del
  negocio todavía no existen, así que aceptar un id habría permitido
  colar el de **otro** negocio: el endpoint es `AllowAny` y no hay
  solicitante contra el cual validar tenant.
- **Borrar un cargo ocupado responde 400 con explicación**, no el
  `IntegrityError` crudo que daría `PROTECT` (un 500 sin decir qué hacer).
- **El default al dar de alta sin cargo es el operativo**, el más
  acotado: alguien recién llegado no debería arrancar pudiendo de más.

### Migración de datos
`0004_cargos` reordena lo que Django autogeneró: el autogenerado ponía
los `RemoveField` **antes** de crear `Cargo`, con lo cual los permisos de
todo el mundo se perdían. El orden correcto es crear el modelo, agregar
el FK, repartir la gente y recién entonces borrar las columnas.

Cada negocio recibe un cargo por cada combinación distinta de capacidades
que tuviera su gente. Las combinaciones reconocibles se bautizan
(Administración, Recepción, Barbero o estilista); las arbitrarias quedan
como "Cargo 1", "Cargo 2" — feo pero honesto: inventarle un nombre bonito
a una combinación arbitraria sería peor que dejar que el dueño la
renombre. **Nadie gana ni pierde permisos.**

Verificado contra la base de desarrollo, que tenía datos reales de las
pruebas anteriores: 0 miembros sin cargo, 9 cargos creados en 3 negocios,
con los nombres esperados.

### Tests
116 en total (antes 104). Los que existían se adaptaron con una fixture
nueva, `empleado_con`, que arma "un empleado que solo puede X" creando el
cargo y metiéndolo ahí — para que los tests sigan leyéndose como
capacidades y no como plomería de cargos.

Nuevos, sobre lo que el modelo cambia de verdad: que editar un cargo
alcanza a todos los que lo ocupan, que el negocio nace con sus tres
cargos y el dueño en administración, que `mi-membresia` trae `tipo` y
`cargo`, aislamiento por tenant en cargos, borrado protegido, nombre
único, y las cinco variantes de escalada por las dos puertas.

Verificado además de punta a punta contra el contenedor: 13 casos, desde
el negocio que nace configurado hasta las dos puertas de escalada.

### Pendiente / a medio hacer
- **Sigue vigente el bloqueante de Fase 3**: `porcentaje_comision` está
  en `Servicio` y lo controla `puede_editar_precios`. Separar antes de
  conectar el cálculo real de comisiones.
- No hay forma de **duplicar un cargo** ("como Recepción pero sin caja").
  Con tres cargos no molesta; con diez sí.
- Un cargo borrado no deja rastro de quién lo tenía. No hay auditoría de
  cambios de permisos — `CLAUDE.md` la exige desde el MVP solo para Caja
  y Comisiones (Fase 3), pero cambiar permisos es igual de sensible.
- `Cargo.tipo` tiene tres valores fijos en el código. Es a propósito —el
  frontend necesita conocerlos para montar shells— pero significa que un
  negocio no puede inventarse una experiencia nueva, solo un cargo nuevo
  dentro de una de las tres.

---

## Fase 2 — Descubrimiento y reserva — backend público COMPLETADO (2026-07-28)

> Primera superficie del proyecto **sin autenticación**. Todo lo que sigue
> está escrito con esa premisa: no es "unos endpoints más", es exponer el
> negocio a internet abierto.

### Qué se completó
- **`apps.publico`**, app nueva con cuatro endpoints bajo `/api/publico/`:
  búsqueda de negocios, perfil público, disponibilidad y reserva. Sin
  modelos propios — es una capa de presentación sobre lo que ya existe.
- **`agenda.services.huecos_disponibles()`**: las horas libres de un día
  para un servicio.
- **`SLUGS_RESERVADOS`** en `apps.negocios.models` + `_slug_ocupado()`.
- **Throttling por IP** (`ScopedRateThrottle`), el primero del proyecto.

### Decisiones y su justificación
- **Serializers públicos escritos a mano, sin reutilizar los internos.**
  Es la decisión más importante del módulo y la más fácil de erosionar.
  Reusar `ServicioSerializer` habría publicado `porcentaje_comision`;
  reusar `MiembroEquipoSerializer` habría publicado `activo`. Con
  serializers propios, un campo nuevo en un modelo **no aparece solo** en
  la web pública: alguien tiene que decidir agregarlo. Hay tests que
  afirman el set exacto de claves, no solo la ausencia de una.
- **`huecos_disponibles` carga todo de una y cruza en memoria.** Es el
  único endpoint público que no se puede cachear —cambia con cada
  reserva—, así que la versión ingenua (llamar a `empleado_disponible`
  por cada hueco y empleado) serían ~360 consultas por request en un día
  de 9 horas con 5 empleados. Se cargan horarios y citas del día en tres
  queries y se cruza en Python.
- **La disponibilidad no dice con quién.** Devuelve solo horas. Nombrar
  al empleado sería una promesa que otra reserva simultánea puede romper
  entre que se muestra y se confirma; además delataría la ocupación
  individual de cada persona.
- **Reservar un hueco tomado responde `400` con mensaje genérico.** No
  distingue "se acaba de ocupar" de "nunca estuvo disponible". La
  diferencia convertiría el endpoint en un oráculo: con suficientes
  intentos se reconstruye la agenda completa del local.
- **La respuesta de reserva no lleva el `id` de la cita.** Hoy el cliente
  no puede hacer nada con él —cancelar sin cuenta necesitaría un token de
  acceso, que es una decisión aparte— y un id expuesto sin uso solo
  invita a probar los vecinos.
- **Un negocio inactivo responde `404` en todo**, no solo desaparece del
  listado. Darlo de baja tiene que sacarlo de internet, no dejarlo
  accesible por URL directa.
- **Dos ritmos de throttling.** Leer es barato y frecuente (un cliente
  indeciso mira varios días): 120/min. Escribir es caro y humanamente
  lento: 10/hora, que corta el llenado automático de una agenda sin
  estorbarle a nadie real. Se aplican por `throttle_scope` y no
  globalmente, para que el staff autenticado no se tope con límites
  pensados para internet abierto.
- **Slugs reservados, no validación al vuelo.** El perfil público vivirá
  en `turnio.app/{slug}`, así que el slug comparte espacio de nombres con
  las rutas de la app. Se incluyeron nombres que todavía no se usan
  (`ayuda`, `precios`, `blog`): liberarlos después es trivial, recuperar
  uno que ya tomó un negocio real significa cambiarle una URL que quizá
  ya repartió. También se cubrió el nombre de puros símbolos, que dejaba
  el slug vacío y el perfil en la raíz del sitio.

### Tests
24 nuevos (140 en total, antes 116). Más de la mitad son negativos, que
es lo que corresponde en una superficie sin auth: que la comisión no se
filtre, que el email y el cargo del equipo no se filtren, que las citas
existentes tapen huecos **sin aparecer**, que un negocio inactivo dé 404,
que reservar dos veces el mismo hueco no delate al primero, que no se
pueda consultar el servicio de otro negocio.

Los dos de throttling **se verificó que miden lo real**: quitando el
`throttle_scope` de la vista de reserva, el test falla con `400 == 429`.

Detalle que costó: `override_settings(REST_FRAMEWORK=…)` **no** cambia
los límites, porque DRF lee `SimpleRateThrottle.THROTTLE_RATES` una sola
vez al importar. El síntoma fue un test que pasaba aislado y fallaba con
la suite completa. Se resolvió parcheando el diccionario de la clase con
`monkeypatch.setitem`, y queda explicado en el docstring del fixture.

### Pendiente / a medio hacer
- **La búsqueda no pagina** y `GET /api/publico/negocios/` sin filtros
  devuelve todos los negocios activos. A la escala actual está bien; a
  mil negocios no. Es el primer endpoint que va a necesitar paginación de
  verdad, y `CONTRATO.md` sección 4 exige documentarla antes de activarla.
- **La búsqueda es `icontains` sobre el nombre.** No hay búsqueda por
  servicio ("quién hace barba"), ni por cercanía, ni tolerancia a errores
  de tipeo. Las tres son esperables en cuanto haya volumen real.
- **El throttling usa el caché por defecto**, que es `LocMemCache`: los
  contadores son por proceso. Con más de un worker, el límite efectivo se
  multiplica por el número de procesos. Antes de exponer esto a internet
  hay que poner Redis detrás del caché — es el primer consumidor real que
  justifica agregarlo (hasta ahora se había evitado a propósito).
- **No hay confirmación por ningún canal.** El cliente reserva y no
  recibe nada; el negocio se entera al mirar su agenda. Es el hueco más
  visible del flujo para un uso real, y depende de decidir el canal
  (email, WhatsApp, SMS) — que toca el punto de Fase 6 sobre WhatsApp.
- **`Cita` sigue sin validar que la fecha no esté en el pasado** a nivel
  de modelo. `huecos_disponibles` no ofrece horas pasadas, pero un POST
  directo con una fecha vieja pasa si el empleado tenía horario ese día
  de la semana. Estaba anotado desde Fase 1 y ahora importa más, porque
  el endpoint es público.

## Corrección de contrato + cáscara HTML del perfil público (2026-07-28)

> Rama `feature/backend-fase2-publico`. Dos piezas encontradas por el
> lado de frontend al retomar Fase 2, resueltas del lado backend porque
> les corresponde a ellas.

### `NegocioPublico.servicios/profesionales/horario` mentían en el schema
Estaban declarados `type: string` cuando siempre devolvieron listas de
objetos — el mismo tipo de bug que el `@extend_schema` sobre `create()`
en vez de `post` de Fase 1: el schema queda sintácticamente válido y
semánticamente falso, y ni `--validate` ni el CI lo atrapan. Causa: son
`SerializerMethodField` y drf-spectacular no puede inferir su forma sin
`@extend_schema_field`. Se anotaron los tres métodos de
`NegocioPublicoSerializer`, se regeneró `openapi.yaml` y se agregó la
entrada correspondiente al historial de `CONTRATO.md`. La respuesta de
la API **no cambió**, solo el schema.

### `PerfilPublicoShellView`: por qué el SPA necesita una excepción
Decisión del humano tras revisar el plan de compartir `turnio.app/{slug}`
por WhatsApp/Instagram: los crawlers de esas plataformas leen el HTML
crudo y no ejecutan JavaScript. El `index.html` que compila Vite es
genérico ("Turnio", sin más), así que compartir el enlace de cualquier
negocio se veía idéntico — roto para el caso de uso que Fase 2 existe
para resolver.

`apps/publico/views_shell.py` agrega `PerfilPublicoShellView`, la única
vista de este proyecto que no es DRF: intercepta `GET /{slug}/`, busca
el negocio (mismas reglas que el resto de `apps.publico`: solo
`activo=True`), lee `frontend/dist/index.html` ya compilado
(`npm run build`) y le inyecta `<title>` y meta tags Open Graph con
`escape()` (nombre del negocio es texto de un tercero — sin escapar es
XSS reflejado en la página más compartida del producto). React monta
después exactamente igual; esta vista no duplica `PerfilNegocioPage`,
solo le da al crawler (y a la primera pintura) una respuesta que ya dice
de qué negocio se trata. Sin `frontend/dist/` construido, responde `404`
en vez de reventar.

Va como catch-all al final de `config/urls.py` (`<slug:slug>/`, un solo
segmento): cualquier ruta literal (`admin/`, `api/...`) se resuelve
primero, y `SLUGS_RESERVADOS` (`Negocio._slug_ocupado`) ya garantiza que
ningún negocio puede robarse `login`, `agenda`, etc.

### El montaje de Docker que hacía falta
`docker-compose.yml` solo montaba `./backend:/app`. Con `WORKDIR /app`,
`BASE_DIR.parent / "frontend"` no existía dentro del contenedor — la
vista habría dado `404` siempre, incluso con `frontend/dist/` bien
construido en el host. Se agregó `./frontend/dist:/frontend/dist:ro`
(solo `dist/`, no todo `frontend/`, para no arrastrar `node_modules`; de
solo lectura porque el backend nunca escribe ahí).

El servido de `/assets/*` y `/favicon.svg` en `config/urls.py` queda
detrás de `if settings.DEBUG`, con `django.views.static.serve` — que la
propia documentación de Django marca como inseguro/ineficiente para
producción. Es a propósito: no existe todavía ningún pipeline de
despliegue en este repo (`docker-compose.yml` es solo `db` + `backend`),
así que inventar una solución de estáticos "de producción" ahora sería
resolver un problema que no se ha planteado. Queda como bloqueo abierto
(ver `../ROADMAP.md`, decisión #8) para cuando se decida cómo se
despliega esto de verdad.

### Refinamiento: las rutas del propio SPA también necesitan el shell
Verificando en vivo (`docker compose up`, curl real) apareció algo que
los tests con `index.html` de prueba no podían mostrar: `GET /login/`
contra Django respondía `404`. No es una regresión — nunca existió esa
ruta en `urls.py`, así que el comportamiento no cambió — pero sí es un
hueco real para el día en que Django sea el único origen en producción:
refrescar la página en `/login` o `/agenda` (rutas de React Router, no
de Django) rompería.

`SLUGS_RESERVADOS` ya existe justo para esto: es la lista de segmentos
que un negocio nunca puede tomar como slug porque le pertenecen al SPA.
`PerfilPublicoShellView` ahora la consulta primero — si el segmento es
una ruta reservada, sirve el shell genérico (sin meta tags de negocio,
para que un crawler no confunda `/login` con un perfil) y deja que React
Router decida qué hacer con esa ruta; si no es reservada, sigue el
camino de siempre (buscar el negocio, 404 si no existe).

### Verificación en vivo (no solo tests con mocks)
Los tests de `test_shell.py` apuntan `_DIST_INDEX` a un archivo de
prueba — determinista, pero no prueba que el contrato real (JSON del
backend) y lo que el frontend espera encajen de punta a punta. Se
levantó `docker compose up`, se registraron dos negocios reales por la
API, se les cargó servicio y horario, y se ejecutó el flujo completo:

- `GET /api/publico/negocios/{slug}/` — forma exacta que espera
  `PerfilNegocioPage` (arreglos, no strings).
- `GET .../disponibilidad/` — huecos reales generados desde el horario
  cargado.
- `POST .../reservar/` — reserva exitosa, y un segundo intento al mismo
  hueco confirma el `400` con el mensaje genérico documentado.
- `GET /{slug}/`, `GET /login/`, `GET /agenda/` contra Django directo:
  meta tags reales en el primero, shell genérico sin meta tags en los
  otros dos, sin 404.

Los dos negocios y su cita de prueba se borraron de la base al terminar.

### Tests
7 nuevos en `apps/publico/tests/test_shell.py` (31 en el módulo, 147 en
el proyecto): meta tags con los datos reales del negocio, que el resto
del shell compilado sobrevive intacto (React sigue teniendo `#root`
donde montar), negocio inactivo → 404, slug inexistente → 404,
`frontend/dist/` sin construir → 404 en vez de 500, que el nombre del
negocio no puede inyectar HTML, y que una ruta reservada del SPA sirve
el shell genérico en vez de 404. Ninguno depende de que `npm run build`
se haya corrido de verdad: apuntan `views_shell._DIST_INDEX` a un
`index.html` de prueba vía `monkeypatch`.

### Duda abierta para el humano
El marketplace de búsqueda (`BuscarNegociosView`) se pospuso a Fase 6+
del lado de producto (ver `../ROADMAP.md` decisión #8), pero el endpoint
sigue vivo y con throttling propio. ¿Se deja tal cual hasta entonces, o
se retira del menú de navegación pública para no ofrecer un flujo que
el producto ya no prioriza? No se tocó nada del lado de rutas/UI de
búsqueda en esta sesión — es pregunta para quien lleve frontend.

## Imágenes del negocio: sesión cortada en la capacidad (2026-07-28)

> Rama nueva `feature/backend-fase2-imagenes-negocio`, creada sobre
> `feature/frontend-sistema-diseno` — cuyo PR #4 ya se mergeó a `main`
> mientras se trabajaba en esta rama (ver ese roadmap). Se abrió aparte
> para no seguir agregando commits a un PR que ya estaba en revisión.

### Por qué existe esta sesión
Cerrando Fase 2 quedaron dos huecos anotados en `../ROADMAP.md` decisión
#8: el enlace compartido no tiene `og:image` (el preview de WhatsApp/
Instagram va sin imagen) y no hay forma de mostrar fotos del negocio en
el perfil público. Los dos dependen de lo mismo: **no existe ningún
campo de imagen en `Negocio` ni `Servicio`**, y tampoco existe **ningún
endpoint para editar el negocio** — ni el logo, ni el nombre, ni la
dirección. Antes de tocar imágenes había que resolver el permiso.

Decisiones tomadas con el humano antes de escribir código:
1. **Capacidad nueva `puede_editar_negocio`**, no reusar
   `puede_gestionar_empleados` ni `puede_editar_precios`. Quien decide
   el nombre/logo del local no es necesariamente quien administra el
   equipo ni quien pone precios.
2. **Alcance: logo + galería de fotos** (no solo logo). Implica un
   modelo `FotoNegocio` aparte (varias fotos, con orden), no un segundo
   `ImageField` en `Negocio`.

### Lo único que se hizo (deliberadamente poco)
La sesión se cortó a propósito en el primer paso, con instrucción
explícita de dejar todo documentado para retomar:

- `apps.usuarios.models.CAPACIDADES`: se agregó `"puede_editar_negocio"`
  a la tupla.
- `Cargo.puede_editar_negocio` (`BooleanField(default=False)`), con
  comentario explicando por qué está separada de
  `puede_gestionar_empleados`.
- Migración generada: `apps/usuarios/migrations/0005_cargo_puede_editar_negocio.py`.
- **No hizo falta tocar nada más del lado de permisos**: `CargoSerializer`
  (`fields = [..., *CAMPOS_CAPACIDADES]`), `sembrar_cargos_iniciales`
  (usa `list(CAMPOS_CAPACIDADES)` para Administración), y las dos
  funciones anti-escalada (`validar_cambio_de_capacidades`,
  `validar_asignacion_de_cargo`) son todas genéricas sobre
  `CAMPOS_CAPACIDADES` — agregar el campo a la tupla y al modelo alcanzó
  para que todo el resto del sistema de capacidades lo reconociera solo.
  Verificado corriendo la suite completa: **147 passed, sin tocar ningún
  test** (el que fija que el dueño recibe todas las capacidades del
  registro, `test_registrar_negocio_otorga_todas_las_capacidades_al_dueno`,
  itera `CAMPOS_CAPACIDADES` genéricamente y ya lo cubrió).
- `openapi.yaml` **regenerado**: `puede_editar_negocio` ya aparece en
  `Cargo` y `PatchedCargo`. Es lo correcto del lado backend — el schema
  debe reflejar lo que el backend realmente devuelve.
- `frontend/src/api/schema.ts` **NO se regeneró, a propósito**. Ver
  advertencia abajo.
- `CONTRATO.md`: entrada agregada al historial (sección 6) con esta
  misma explicación.

### Advertencia para quien retome: hay drift de contrato intencional
`catalogo.ts` (frontend) deriva `Capacidad` del schema y tiene
`DEFINICIONES: Record<Capacidad, …>` — el comentario del propio archivo
dice que si el backend agrega una capacidad, **eso debe dejar de
compilar** hasta traducirla. Es el comportamiento correcto, pero
significa que:

- El CI de frontend (que verifica que `schema.ts` esté regenerado
  contra `openapi.yaml`) **fallará** contra esta rama tal como está,
  porque `openapi.yaml` ya tiene la capacidad y `schema.ts` no.
- **No regenerar `schema.ts` todavía es la decisión correcta**: hacerlo
  ahora rompería la compilación de todo el frontend (no solo de la
  pantalla nueva) hasta escribir la traducción, y esta sesión no llega
  a esa parte.
- **La rama no se mergea así.** El siguiente paso obligatorio es
  regenerar `schema.ts` y traducir la capacidad en `catalogo.ts` **en el
  mismo commit** — nunca por separado, o queda un commit intermedio con
  el frontend roto.

### Lo que falta para que esto sirva de algo (plan completo, en orden)

**Backend:**
1. `pip install Pillow` (`requirements.txt`) — Django no puede validar
   `ImageField` sin él.
2. `MEDIA_ROOT` / `MEDIA_URL` en `settings.py`. Servir `/media/` en
   `DEBUG` (mismo patrón que se usó para `frontend/dist/` en
   `config/urls.py` — ver la vista `PerfilPublicoShellView` de esta
   misma fase para el precedente de "solo en DEBUG, producción queda
   pendiente"). `.gitignore` ya tiene `/backend/media/` reservado desde
   antes.
3. `Negocio.logo = models.ImageField(upload_to=..., blank=True, null=True)`.
4. Modelo nuevo `FotoNegocio` (`negocio` FK, `imagen`, `orden` — mínimo
   viable; evaluar límite de fotos por negocio para no dejar subir
   cientos).
5. Migraciones de `apps.negocios`.
6. `PATCH /api/negocios/mi-negocio/` — no existe ningún endpoint de
   edición del negocio hoy, hay que crearlo desde cero (nombre,
   dirección, teléfono, ciudad, logo). Gate: `puede_editar_negocio`.
   Usar `parser_classes` con `MultiPartParser` para el logo.
7. Endpoints de fotos: subir, borrar, reordenar. Mismo gate.
8. Serializers públicos (`apps/publico/serializers.py`): agregar `logo`
   y `fotos` a `NegocioPublicoSerializer`. Ojo con URLs absolutas — un
   `ImageField.url` es relativo, y el perfil público lo consume un
   crawler que no tiene contexto de dominio; hay que construirlo con
   `request.build_absolute_uri()` igual que ya hace
   `PerfilPublicoShellView` con `og:url`.
9. `views_shell.py`: agregar `og:image` con la URL absoluta del logo
   (si existe) — ese es el objetivo final de todo esto.
10. Tests: capacidad, permisos del PATCH, subida/borrado/reorden de
    fotos, `og:image` presente cuando hay logo y ausente cuando no.
11. Regenerar `openapi.yaml` otra vez (esta ronda si va a tener forma
    real de request/response) y actualizar `CONTRATO.md`.

**Frontend (bloqueado hasta que el backend tenga los endpoints):**
1. Regenerar `schema.ts` + traducir `puede_editar_negocio` en
   `catalogo.ts` (`DEFINICIONES`, `GRUPOS` — probablemente un área nueva
   "Perfil del negocio" o sumarla a un área existente) **en el mismo
   commit**.
2. Nav: agregar entrada en `permisos/shell.ts` gateada por la capacidad
   (ver patrón de `EQUIPO`/`CARGOS` en ese archivo), ruta sugerida
   `/configuracion/negocio`.
3. Pantalla nueva: editar nombre/dirección/teléfono, subir logo,
   gestionar fotos (subir, borrar, reordenar).
4. Perfil público (`PerfilNegocioPage`): mostrar el logo en vez de
   `Avatar` con iniciales cuando exista, y el carrusel de fotos
   (Blossom, evaluado y compatible con React 19 — ver entrada anterior
   de `../frontend/ROADMAP-FRONTEND.md`).

### Duda abierta para el humano
¿Límite de fotos por negocio y peso máximo por imagen? No se decidió
todavía — afecta el modelo `FotoNegocio` y la validación del endpoint de
subida, así que hay que resolverlo antes del paso 4 del plan de backend.

## Imágenes del negocio: plan ejecutado (2026-07-28, misma rama)

> Retoma exactamente donde quedó la entrada anterior. Los 11 pasos de
> backend que quedaron escritos allá están **todos hechos**; lo que sigue
> documenta cómo, y en qué se desvió del plan.

### La duda abierta, resuelta
**10 fotos por negocio, 5 MB por imagen** (decisión del humano,
2026-07-28). Diez alcanza para mostrar el local y algunos trabajos sin
convertir el perfil en un álbum que hay que bajar por 4G antes de poder
reservar; 5 MB cubre una foto de celular sin comprimir. Viven como
constantes en `apps.negocios.models` (`MAX_FOTOS_POR_NEGOCIO`,
`PESO_MAXIMO_IMAGEN_BYTES`) y están documentadas en `CONTRATO.md` 5.12.

### Qué se construyó
- **Pillow 10.4.0** en `requirements.txt` (única dependencia nueva: sin
  ella `ImageField` ni siquiera pasa la validación de modelos).
- **`MEDIA_ROOT`/`MEDIA_URL`** en `settings.py`, servidos bajo `/media/`
  **solo con `DEBUG=1`** en `config/urls.py`, con el mismo comentario que
  ya tenía `frontend/dist/`: no es despliegue, es desarrollo.
- **`Negocio.logo`** (`ImageField`, `blank=True`) y **`FotoNegocio`**
  (`negocio` FK con `related_name="fotos"`, `imagen`, `orden`,
  `creado_en`), migración `negocios/0002_negocio_logo_fotonegocio.py`.
- **`GET`/`PATCH /api/negocios/mi-negocio/`** — no existía **ningún**
  endpoint para editar el negocio, ni el nombre. Leer solo pide
  pertenecer al negocio; editar exige `puede_editar_negocio`.
- **Fotos**: `GET`/`POST /api/negocios/mi-negocio/fotos/`,
  `DELETE .../fotos/{id}/` y `PUT .../fotos/orden/`.
- **Superficie pública**: `NegocioPublicoSerializer` gana `logo` y
  `fotos` con URLs absolutas; `PerfilNegocioView` prefetchea `fotos`.
- **`og:image`** en `views_shell.py` — el objetivo final de toda la
  tanda: compartir el enlace por WhatsApp ahora muestra la imagen del
  negocio.
- **24 tests nuevos** (`apps/negocios/tests/test_imagenes.py` + tres en
  `apps/publico/tests/`). Suite completa: **171 passed**, de 147.
- **`openapi.yaml` regenerado** y **`CONTRATO.md` 5.12 + historial**.

### Decisiones técnicas y desvíos del plan escrito
1. **`logo` sin `null=True`**, contra lo que decía el paso 3 del plan. La
   documentación de Django desaconseja `null` en campos basados en
   cadenas: `""` ya significa "sin logo" y admitir además `NULL` daría
   dos formas de decir lo mismo. Hacia afuera la API sí devuelve `null`
   (`allow_null` declarado en los serializers), que es lo que el frontend
   necesita para tiparlo.
2. **Nombres de archivo aleatorios** (`uuid4().hex`) bajo
   `negocios/<id>/logo/` y `negocios/<id>/fotos/`. Dos razones: el nombre
   original viene de internet y `FileField` lo usaría tal cual para
   escribir en disco, y un path estable haría que el navegador —o el
   crawler de WhatsApp— siguiera sirviendo el logo viejo tras
   reemplazarlo.
3. **El borrado de archivos vive en `services.py`**, no en señales ni en
   `Model.delete()`. Django no borra archivos huérfanos desde 1.3, así
   que sin esto cada cambio de logo dejaría basura permanente en
   `MEDIA_ROOT`. `actualizar_negocio` borra el logo reemplazado **después**
   del `save()` (si la escritura falla, el negocio conserva el archivo
   que ya tenía), y `eliminar_foto` borra archivo y fila juntos.
4. **Reordenar exige la lista completa de ids**, no un `PATCH orden=n`
   por foto. El orden es propiedad del conjunto: con una lista parcial
   habría que inventar dónde caen las que faltan, y dos clientes
   reordenando a medias dejarían un orden que ninguno pidió. Idempotente
   y "el último request gana, entero". Mismo criterio que
   `PUT /api/agenda/horarios/semana/`.
5. **`slug` de solo lectura en el PATCH.** Salió al escribir el
   serializer: es la URL que el dueño ya repartió, y dejarla editable
   rompería en silencio todo lo que él mismo compartió, además de
   liberar el slug viejo para otro negocio.
6. **`og:image` cae en la primera foto de la galería si no hay logo**, y
   `twitter:card` sube a `summary_large_image` solo cuando hay imagen —
   con la variante grande y sin imagen, la tarjeta queda vacía.
7. **`extra_kwargs = {"logo": {"allow_null": True}}`** en los serializers
   de solo lectura. Sin eso el schema declaraba `logo: string` mientras
   la API devolvía `null`: exactamente el mismo tipo de mentira
   sintácticamente válida que el bug de los `SerializerMethodField` de la
   sesión anterior, y que `--validate` tampoco atrapa.
8. **Fixtures compartidas en `conftest.py`** (`media_temporal`,
   `imagen_de_prueba`): cualquier test que suba una imagen escribe
   archivos de verdad, y sin `MEDIA_ROOT` temporal la suite iría dejando
   basura en `backend/media/` a cada corrida.

### Lo que sigue sin resolverse (heredado, no nuevo)
- **Almacenamiento local en disco.** Sirve para desarrollo y para un
  despliegue de un solo servidor; con varios contenedores sin volumen
  compartido, cada uno vería fotos distintas. Migrar a S3/R2 con
  `django-storages` es decisión de infraestructura, junto con cómo se
  sirve `frontend/dist/` y `/media/` fuera de `DEBUG`.
- **Nadie redimensiona ni comprime las imágenes.** El límite de 5 MB es
  la única defensa: un logo de 5 MB se sirve tal cual en el perfil
  público. Generar miniaturas (o un `og:image` de tamaño acotado) es
  trabajo pendiente si el perfil se siente pesado en móvil.
- **El drift con el frontend sigue abierto y creció**: además de
  `puede_editar_negocio`, ahora faltan del lado de `schema.ts` los
  endpoints de `mi-negocio` y los campos `logo`/`fotos`. El CI de
  frontend seguirá en rojo contra esta rama hasta que se cierre — sigue
  siendo la señal correcta. Plan del lado frontend: el mismo de la
  entrada anterior, sin cambios.

## Apariencia del negocio: tema, color y portada (2026-07-28)

> Misma rama. Extiende lo de imágenes con lo que faltaba para que el
> enlace público **se sienta del negocio** y no de Turnio, tomando como
> referencia cómo lo resuelve Goldie.

### Qué se agregó
- **`Negocio.tema`** — `TextChoices` con `estandar` y `vitrina`. Catálogo
  **cerrado**, al revés que los cargos: un tema no es configuración del
  negocio sino una plantilla que este equipo diseña y mantiene.
- **`Negocio.color_acento`** — `#rrggbb` o vacío (= el color de Turnio).
  Validado **en el modelo** con `RegexValidator`, no solo en el
  serializer: este valor termina inyectado en una variable CSS de una
  página pública, así que una cadena arbitraria ahí no es un dato feo
  sino una vía de entrada a la hoja de estilos.
- **`Negocio.portada`** — imagen ancha del encabezado, con el mismo
  tratamiento que el logo. `actualizar_negocio` pasó a barrer los
  archivos viejos de **todos** los campos de imagen
  (`CAMPOS_IMAGEN_NEGOCIO`) en vez de solo el logo.
- Migración `0003`, los tres campos en `MiNegocioSerializer` (escritura,
  gateada por `puede_editar_negocio`) y en `NegocioPublicoSerializer`.
- **`og:image` prefiere la portada** sobre el logo: es la única imagen
  pensada para ser ancha, que es la forma que pide una tarjeta de
  WhatsApp. El logo y la primera foto quedan como respaldo, en ese orden.
- **`theme-color`** con el color del negocio en la cáscara HTML.

### El bug que encontró la verificación en vivo
La primera versión **agregaba** la meta `theme-color`, y `index.html` ya
trae una genérica (`#f8f9ff`). Ante dos, el navegador se queda con la
primera del documento — que es la genérica, porque está antes del
`<title>` donde se inyectan estas tags. **El color del negocio no se
habría visto nunca, con los tests en verde.** Se detectó comparando la
respuesta real del backend corriendo contra lo que el test daba por
bueno. Ahora se **reemplaza**, y el test cuenta las apariciones en vez de
solo comprobar presencia.

Regla que sale de ahí: para una meta tag que debe ser única, un test de
presencia no alcanza — hay que verificar unicidad.

### Estado
180 tests en verde (venían 171). `openapi.yaml` regenerado, `CONTRATO.md`
5.12 ampliado con la sección de apariencia y entrada en el historial. Las
decisiones de diseño de esta tanda están en `../DECISIONES.md` #12–#18.

### Pendiente que deja
- **Nadie redimensiona la portada.** Se sirve tal cual se subió, y en el
  tema Vitrina ocupa la primera pantalla completa: es la imagen más
  pesada del perfil público. Generar derivados (o al menos un `srcset`)
  es el siguiente paso natural si el perfil se siente lento en móvil.
- **`Servicio` sigue sin imagen.** Nada lo pide todavía.

## Las plantillas del perfil pasan a nombrarse por rubro (2026-07-28)

> Rama nueva sobre `main` (ya con el PR #5 mergeado). Entra el material
> de diseño de `stitch_booking_page_ui_system/`.

- **`Negocio.Tema`**: `estandar`/`vitrina` → `barberia`/`spa`/`clinica`,
  con `spa` por defecto (la más neutra de las tres: clara, suave,
  redondeada). Migración `0004` **con migración de datos**: sin ella los
  negocios existentes quedaban con un valor fuera de `choices`, el
  frontend caería en la plantilla por defecto y el dato muerto no lo
  notaría nadie. El mapeo va por parecido visual y la marcha atrás está
  escrita.
- **`Negocio.FONDO_POR_TEMA`** — la única parte de la paleta que el
  backend conoce, para emitir `theme-color`. Es un espejo a mano de
  `frontend/src/tema/plantillas.ts`, anotado como tal en los dos lados,
  con un test que fija que estén todas las plantillas (no que los valores
  coincidan: eso no se puede verificar desde acá).
- **`theme-color` deja de salir de `color_acento`** y sale del fondo de
  la plantilla. Esa meta tiñe la barra del navegador, que debe acompañar
  al lienzo de la página: en la plantilla oscura, una barra clara se ve
  como un error de carga. Corrige la decisión de la sesión anterior.
- **Ruta `/plantillas/` en desarrollo** (`config/urls.py`) para las
  portadas de muestra, que salen de `frontend/public/` — no son
  `/assets/` (llevan hash) ni `/media/` (eso lo sube el negocio). Se
  agregó `plantillas` a `SLUGS_RESERVADOS`, y `image/webp` a la tabla de
  `mimetypes`, que en la imagen base de Python no lo trae y hacía que las
  portadas salieran como `application/octet-stream`.

181 tests en verde. `openapi.yaml` regenerado, `CONTRATO.md` 5.12 y su
historial actualizados, decisiones en `../DECISIONES.md` #19–#23.

### Pendiente
El `og:image` **no** usa la portada de muestra a propósito (ver
`../DECISIONES.md` #21): un negocio sin portada propia se comparte sin
imagen. Si en el uso real eso pesa más que el riesgo de confundir al
cliente, es una decisión de producto para reabrir, no un olvido.

## Registro y validación de servicios realizados (2026-07-28)

> Pedido explícito del humano, fuera del orden de fases: antes de que
> Caja/Comisiones (Fase 3) exista, cerrar la puerta a que un empleado
> registre trabajo que no hizo. Ver `../CONTRATO.md` 5.13 y
> `../DECISIONES.md` #25–#27.

- **`RegistroServicio`**, modelo nuevo en `apps/servicios` (no una app
  aparte — ver `../DECISIONES.md` #25), **independiente de `Cita`**:
  cubre también al cliente sin cita previa. Nace en `pendiente` y no
  cuenta para nada (comisión, historial, métrica) hasta que se revisa.
- Nueva capacidad **`puede_aprobar_servicios`** (`Cargo`, migración
  `0006`). No se concede a ningún cargo sembrado salvo Administración
  (hereda todas): es sensible, el dueño la asigna a mano a quien vaya a
  validar.
- Capa de servicios (`apps/servicios/services.py`):
  `registrar_servicio()` (rechaza `fecha_hora` futura — `FechaFutura`),
  `aprobar_registro()` / `rechazar_registro()` (una sola revisión por
  registro — `RegistroYaRevisado`; nadie revisa lo suyo, ni con la
  capacidad — `NoPuedeAutoaprobarse`, ver `../DECISIONES.md` #26;
  rechazar exige motivo — `MotivoRechazoRequerido`).
- `apps/servicios/signals.py`: señal `servicio_aprobado`, sin receptor
  conectado a propósito — el punto de extensión para cuando Fase 3
  invoque `calcular_comision()` (ya escrita, sigue inerte). Ver
  `../DECISIONES.md` #27.
- `RegistroServicioViewSet` (`GET/POST /api/servicios/registros/`,
  `.../{id}/aprobar/`, `.../{id}/rechazar/`), sin `PUT`/`PATCH`/`DELETE`
  — inmutable tras crearse. `empleado` sale siempre de la membresía del
  token (nunca del body); listar filtra a lo propio salvo que se tenga
  la capacidad, con `?estado=` opcional.
- Evidencia fotográfica opcional (`evidencia`, multipart), mismo límite
  de 5 MB que las imágenes de negocio (`PESO_MAXIMO_EVIDENCIA_BYTES`,
  validación duplicada a propósito en vez de importada entre apps).
- 24 tests nuevos (servicios de aplicación + API: creación,
  aislamiento por tenant, alcance de listado, ambas revisiones, los
  cuatro rechazos de negocio). 205 tests en verde. `openapi.yaml`
  regenerado, `CONTRATO.md` 5.13 y su historial actualizados.

### Pendiente
El cálculo real de comisión en dinero sigue sin invocarse desde ningún
flujo automático — es Fase 3 (Caja), que todavía no existe como
módulo. No hay relación formal entre `RegistroServicio` y `Cita`
(deliberado, ver `../DECISIONES.md` #25): si aparece un caso de uso
concreto que las necesite enlazadas, se agrega entonces.

## Filtros de consulta y registro a nombre de otro en servicios realizados (2026-07-28)

> Segundo pedido del humano sobre el mismo módulo, misma sesión. Ver
> `../CONTRATO.md` 5.13 y `../DECISIONES.md` #28–#29.

- **`GET /api/servicios/registros/`** gana tres filtros opcionales y
  combinables: `?fecha_desde=`/`?fecha_hasta=` (`YYYY-MM-DD`, sobre
  `fecha_hora__date`, ambos inclusive) y `?empleado=` (por id — sin
  `puede_aprobar_servicios` no tiene efecto útil, porque el queryset ya
  está acotado a uno mismo). Documentados en el mismo
  `@extend_schema_view(list=...)` que ya tenía `?estado=`.
- **`empleado` pasa a ser un campo normal del serializer** (antes
  estaba en `read_only_fields`). `RegistroServicioSerializer.validate()`
  decide si es obligatorio: con `puede_aprobar_servicios`, el registro
  queda a nombre de quien se elija (`400` si no se manda); sin ella,
  `perform_create` lo sigue ignorando y fuerza al solicitante — mismo
  comportamiento de siempre. Ver `../DECISIONES.md` #28 sobre por qué
  no se creó una capacidad nueva para esto.
- La regla de no-autoaprobación (`services._validar_revision`) sigue
  aplicando sobre el `empleado` resultante sin cambios: registrarse un
  servicio a sí mismo usando esta capacidad y luego intentar aprobarlo
  sigue respondiendo `400`.
- 6 tests nuevos (empleado obligatorio para quien tiene la capacidad,
  registro a nombre de otro, rechazo si el empleado es de otro negocio
  o está inactivo, filtro por rango de fechas, filtro por empleado).
  211 tests en verde. `openapi.yaml` regenerado.

## Fase 3: Caja, comisiones automáticas y auditoría (2026-08-05)

> Primer módulo real de Fase 3, sobre la base antifraude que dejó
> `RegistroServicio`. Plan diseñado y aprobado con el humano antes de
> tocar código (`/home/iber/.claude/plans/lucky-bubbling-balloon.md`).
> Ver `../CONTRATO.md` 5.14 y `../DECISIONES.md` #30–#36. Soporte
> offline queda explícitamente fuera de esta tanda — es un problema de
> ingeniería aparte (cola local-first + sincronización).

- **App nueva `apps/caja`**, con tres modelos: `Caja` (`estado`
  `abierta`/`cerrada`, máquina de estados simple igual que `Cita`,
  `UniqueConstraint` de "una caja abierta por negocio" reforzada a
  nivel de BD), `MovimientoCaja` (ingreso/egreso, inmutable tras
  crearse, `UniqueConstraint` que impide vincular dos veces el mismo
  `RegistroServicio`) y `RegistroAuditoria` (log DIY de una fila por
  acción — ver `DECISIONES.md` #32 sobre por qué no `django-simple-history`).
- **Capacidad nueva `puede_editar_comisiones`** (migración `usuarios/0007`),
  separada de `puede_editar_precios` — cierra el bloqueo #8 del
  `../ROADMAP.md` raíz. Gating por campo dentro de `ServicioSerializer`,
  no por vista: un mismo `PATCH` puede tocar precio, comisión, o ambos,
  y cada capacidad solo se exige si el valor **cambia**.
- **`puede_cobrar` y `puede_ver_reportes` pasan de declaradas a exigidas
  de verdad** por primera vez, en los endpoints de `/api/caja/`. Sin
  migración de datos: `puede_cobrar` ya estaba sembrada en el cargo
  "Recepción" de todo negocio existente.
- **`requiere_alguna_capacidad(*nombres)`** nuevo en
  `apps/common/permissions.py` — exige al menos una de varias
  capacidades (histórico de caja: `puede_cobrar` o `puede_ver_reportes`;
  editar un `Servicio`: `puede_editar_precios` o `puede_editar_comisiones`).
- **El cálculo de comisión se conecta por import directo**
  (`apps.caja.services` importa `apps.servicios.services.calcular_comision`),
  no conectando la señal `servicio_aprobado` que la sesión anterior
  dejó preparada para esto — un solo efecto síncrono no amerita señal.
  Ver `DECISIONES.md` #31.
- Endpoints: `GET/POST /api/caja/`, `GET /api/caja/{id}/`,
  `GET .../actual/`, `POST .../abrir/`, `POST .../cerrar/`,
  `POST .../movimientos/`. El detalle trae `resumen` calculado en
  caliente (nunca persistido): totales, por método de pago, comisiones
  por empleado, y `servicios_aprobados_sin_cobrar` — un aviso no
  bloqueante que **no** se acota a la ventana de la caja actual (un test
  destapó que acotarlo hacía desaparecer el aviso apenas pasaba el día;
  ver `DECISIONES.md` #35).
- **Colisión de nombres de enum**: agregar `Caja.estado` le movió el
  nombre limpio a `Cargo.tipo` (pasó a `Tipo14fEnum`), que el frontend
  ya referencia por nombre fijo (`TipoEnum`). Resuelto con
  `SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"]`. Ver `DECISIONES.md` #36
  — vale la pena revisar `git diff openapi.yaml` completo, no solo lo
  agregado, cada vez que se suma un campo `TextChoices` con nombre común.
- 43 tests nuevos (19 de servicios de `apps/caja`, 17 de API de
  `apps/caja`, 7 de gating de comisiones en `apps/servicios`). **254
  tests en verde** (venían 211). `openapi.yaml` regenerado,
  `CONTRATO.md` 5.14 y su historial actualizados, capacidades listadas
  en la sección 5 puestas al día (ahora diez).

### Pendiente
Frontend de este módulo (pantalla de Caja) queda para la siguiente
tanda de esta misma sesión. No hay endpoint de solo lectura para
`RegistroAuditoria` — hoy solo se consulta desde el admin de Django; se
agrega si en el uso real hace falta verlo desde la app. El pago de la
comisión (el egreso real cuando el dueño le paga al barbero) no está
modelado — `comisiones_por_empleado` es informativo, registrar el
egreso correspondiente es un paso manual.
