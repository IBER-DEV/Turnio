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
