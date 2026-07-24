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
