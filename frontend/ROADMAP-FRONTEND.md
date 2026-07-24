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

## Fase 1 — App Capacitor mínima para el negocio (próxima, sin empezar)

Alcance esperado (ver `../CLAUDE.md`): login + agenda + registrar
servicio, para un negocio con varios empleados (calendario por
empleado, no solo el caso de un operador único).

Endpoints ya disponibles del lado backend para arrancar (ver
`../CONTRATO.md` para el contrato completo):
- `POST /api/negocios/registro/`
- `POST /api/auth/login/` / `POST /api/auth/refresh/`
- `GET /api/negocios/empleados/`

Los endpoints de Servicios y Agenda (Fase 1 backend) todavía no
existen; no empezar esas pantallas hasta que aparezcan en
`../backend/openapi.yaml` y se anoten en `../CONTRATO.md`.

### Bloqueos o dudas abiertas para el humano
(ninguna todavía — el frontend no ha empezado)
