# Turnio

SaaS multi-tenant para administración de barberías, salones de belleza y
centros estéticos. Monorepo con dos áreas, cada una trabajada por una
persona distinta (con su propio Claude Code):

- [`backend/`](backend/) — Django + Django REST Framework.
- [`frontend/`](frontend/) — React + Capacitor (web admin, app cliente,
  app empleado), a partir de la Fase 1.

## Documentación del proyecto

- [`CLAUDE.md`](CLAUDE.md) — decisiones de arquitectura y reglas de
  trabajo compartidas. Cada carpeta tiene además su propio `CLAUDE.md`
  con reglas específicas de esa capa.
- [`ROADMAP.md`](ROADMAP.md) — estado conjunto del proyecto por fase.
  El detalle día a día vive en `backend/ROADMAP-BACKEND.md` y
  `frontend/ROADMAP-FRONTEND.md`.
- [`CONTRATO.md`](CONTRATO.md) — **el contrato entre backend y
  frontend**: auth, formato de errores, convenciones de nombres,
  modelo de capacidades. La forma exacta de cada endpoint vive en
  [`backend/openapi.yaml`](backend/openapi.yaml) (autogenerado desde
  el código real del backend, nunca a mano).

## Desarrollo local (backend)

Requiere Docker y Docker Compose.

```bash
cp .env.example .env   # si no existe aún
docker compose build
docker compose up -d db
docker compose run --rm backend python manage.py migrate
docker compose up -d
```

La API queda disponible en `http://localhost:8001/`. Swagger UI del
contrato en `http://localhost:8001/api/docs/`.

### Tests

```bash
docker compose run --rm backend pytest
```

### Regenerar el contrato OpenAPI

Cada vez que cambie la forma de un endpoint (ver regla en
`backend/CLAUDE.md`):

```bash
docker compose run --rm --user "$(id -u):$(id -g)" backend \
  python manage.py spectacular --file openapi.yaml --validate
```

### Crear un superusuario (para /admin)

```bash
docker compose run --rm backend python manage.py createsuperuser
```

## Endpoints de la Fase 0

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/negocios/registro/` | Registra un negocio nuevo + dueño (con todas las capacidades) + empleados opcionales |
| POST | `/api/auth/login/` | Login JWT (email + password) |
| POST | `/api/auth/refresh/` | Refresca el access token |
| GET | `/api/negocios/empleados/` | Lista los empleados del negocio del usuario autenticado |
| POST | `/api/negocios/empleados/` | Agrega un empleado al negocio (requiere `puede_gestionar_empleados`) |

## Desarrollo local (frontend)

Sin empezar todavía (Fase 1). Ver `frontend/CLAUDE.md` y
`frontend/ROADMAP-FRONTEND.md`.
