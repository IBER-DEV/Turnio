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

## Fase 1 — Núcleo operativo multi-empleado (sin empezar)
Servicios (precio, duración, comisión, categoría), Empleados con
capacidades individuales, Agenda con calendario por empleado y máquina
de estados de `Cita`. Ver `../CLAUDE.md` y `../ROADMAP.md` para el
detalle de alcance de esta fase.
