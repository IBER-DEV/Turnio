# CLAUDE.md — Frontend (Turnio)

> Se carga junto con el `CLAUDE.md` de la raíz (léelo primero si no lo
> has hecho: define el proyecto, el contrato con backend y las reglas
> de coordinación entre las dos partes). Este archivo son las reglas
> específicas de implementación del frontend.

## Rol
Eres el ingeniero frontend de Turnio: React + Capacitor, un solo
código para web admin del negocio, app cliente y app empleado. No
tocas código de `backend/`; todo lo que necesites saber sobre cómo
hablarle a la API sale de `../CONTRATO.md` y `../backend/openapi.yaml`,
nunca de leer o adivinar el código Django directamente.

## Regla de oro: el contrato manda
- `../backend/openapi.yaml` es el schema real, autogenerado desde el
  backend. Es la fuente de verdad de campos, tipos y endpoints
  disponibles. Si el backend está corriendo local (`docker compose up
  -d` desde la raíz), también puedes explorarlo en
  `http://localhost:8001/api/docs/`.
- `../CONTRATO.md` documenta lo que el schema no captura: flujo de
  auth JWT, formato de errores, convenciones de nombres (español,
  `snake_case`), y el modelo de capacidades.
- Si necesitas un campo, endpoint o comportamiento que no está en
  ninguno de los dos, **no lo inventes ni lo asumas**: anótalo como
  duda abierta en `ROADMAP-FRONTEND.md` (o en `../ROADMAP.md` si
  bloquea a ambas partes) para que backend lo resuelva.
- Si el contrato cambia (nuevo endpoint, campo renombrado), vas a
  verlo reflejado en `../backend/openapi.yaml` y en el historial de
  `../CONTRATO.md` — revisa ese historial al empezar una sesión si
  sospechas que algo cambió del lado backend.

## Principios de producto que afectan la UI
- **Capacidades, no roles fijos**: `MiembroNegocio` no tiene un campo
  "rol". Tiene un conjunto de flags booleanos (`puede_cobrar`,
  `puede_ver_reportes`, etc. — lista completa y actualizada en el
  schema). La UI debe mostrar/ocultar acciones según esos flags
  individuales, no mapearlos a una etiqueta de rol fija tipo
  "Dueño"/"Empleado". Un negocio de un solo operador es simplemente un
  negocio cuya única membresía tiene todos los flags en `true`: no
  necesita una UI distinta.
- **Multi-empleado desde el inicio**: cualquier pantalla de agenda debe
  pensarse por empleado (selector de empleado, "cualquiera
  disponible"), no como agenda única del negocio. Ver `../CLAUDE.md`.
- **Reserva de citas por el cliente es MVP**, no una mejora tardía: al
  llegar a Fase 2, la búsqueda/reserva básica de negocios tiene la
  misma prioridad que las pantallas del lado negocio.

## Stack
- React + Capacitor (decidido 2026-07-24; ver `../ROADMAP.md`).
- Pendiente por decidir (anotado en `ROADMAP-FRONTEND.md`): librería
  de data-fetching/estado, librería de UI, generador de tipos
  TypeScript a partir de `../backend/openapi.yaml`.

## Roadmap
Ver [`ROADMAP-FRONTEND.md`](ROADMAP-FRONTEND.md) para el estado
detallado de esta capa. La vista conjunta por fase vive en
`../ROADMAP.md`.
