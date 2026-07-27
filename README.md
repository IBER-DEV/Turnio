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

### Probar el backend de punta a punta (Postman)

[`backend/postman/Turnio-Backend-E2E.postman_collection.json`](backend/postman/Turnio-Backend-E2E.postman_collection.json)
trae un caso completo listo para importar en Postman: registra un
negocio con dueño + empleada, crea un servicio, carga el horario de la
empleada, agenda una cita sin elegir empleado ("cualquiera
disponible"), recorre la máquina de estados de `Cita`
(confirmar → completar, y verifica que cancelar una ya completada
falla), prueba que un empleado sin `puede_editar_precios` no puede
crear servicios (403), y verifica aislamiento entre negocios (un
segundo negocio no ve las citas del primero).

- Requests **en orden** (usa "Run Collection"): cada uno guarda en
  variables de colección lo que el siguiente necesita.
- **Re-ejecutable sin resetear la base de datos**: cada corrida genera
  emails únicos, así que no choca con datos de una corrida anterior.
- Variable `base_url` ya apunta a `http://localhost:8001`.
- También se puede correr desde la terminal con
  [Newman](https://www.npmjs.com/package/newman):
  ```bash
  npx newman run backend/postman/Turnio-Backend-E2E.postman_collection.json
  ```

## Endpoints (Fase 0 + Fase 1)

Lista rápida de orientación — el detalle exacto de campos y tipos
siempre vive en [`backend/openapi.yaml`](backend/openapi.yaml) /
`http://localhost:8001/api/docs/` (ver `CONTRATO.md`).

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/negocios/registro/` | Registra un negocio nuevo + dueño (con todas las capacidades) + empleados opcionales |
| POST | `/api/auth/login/` | Login JWT (email + password) |
| POST | `/api/auth/refresh/` | Refresca el access token |
| GET/POST | `/api/negocios/empleados/` | Lista/agrega empleados del negocio (crear requiere `puede_gestionar_empleados`) |
| GET/PATCH | `/api/negocios/empleados/{id}/` | Detalle/edición de capacidades y especialidad de un empleado |
| GET/POST/PATCH/DELETE | `/api/servicios/` | CRUD de servicios (escribir requiere `puede_editar_precios`) |
| GET/PUT | `/api/agenda/horario-negocio/` | Horario de atención del local — lo hereda todo el equipo (escribir requiere `puede_configurar_horarios`) |
| GET/POST/PATCH/DELETE | `/api/agenda/horarios/` | Horario **propio** de un empleado, como excepción al del negocio (requiere `puede_configurar_horarios`) |
| PUT | `/api/agenda/horarios/semana/` | Reemplaza la semana completa de uno o varios empleados a la vez |
| GET/POST | `/api/agenda/citas/` | Lista/agenda citas (`empleado` opcional = "cualquiera disponible"). Sin `puede_ver_agenda_completa` solo devuelve las propias |
| POST | `/api/agenda/citas/{id}/confirmar\|completar\|cancelar/` | Transiciones de la máquina de estados de `Cita` |

## Desarrollo local (frontend)

Sin empezar todavía (Fase 1). Ver `frontend/CLAUDE.md` y
`frontend/ROADMAP-FRONTEND.md`.
