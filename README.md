# Turnio

SaaS multi-tenant para administración de barberías, salones de belleza y
centros estéticos. Backend en Django + Django REST Framework; frontend y
apps móviles (web admin, app cliente, app empleado) se construirán con
Capacitor a partir de la Fase 1.

Ver [`CLAUDE.md`](CLAUDE.md) para las decisiones de arquitectura y reglas
de trabajo del proyecto, y [`ROADMAP.md`](ROADMAP.md) para el estado
actual por fases.

## Desarrollo local

Requiere Docker y Docker Compose.

```bash
cp .env.example .env   # si no existe aún
docker compose build
docker compose up -d db
docker compose run --rm backend python manage.py migrate
docker compose up -d
```

La API queda disponible en `http://localhost:8001/`.

### Tests

```bash
docker compose run --rm backend pytest
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
