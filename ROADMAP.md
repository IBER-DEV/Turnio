# ROADMAP — Turnio (visión conjunta)

> Memoria persistente entre sesiones, **compartida por backend y
> frontend**. Leer completo antes de escribir código, sin importar en
> qué carpeta se trabaje. Nunca borrar historial de fases anteriores,
> solo agregar.
>
> Este archivo mantiene solo el **estado por fase a nivel de
> proyecto**. El detalle día a día de cada lado vive en su propio
> archivo, para que las dos personas (y sus dos Claude Code, trabajando
> en paralelo) no compitan por las mismas líneas de un mismo archivo:
> - Backend: [`backend/ROADMAP-BACKEND.md`](backend/ROADMAP-BACKEND.md)
> - Frontend: [`frontend/ROADMAP-FRONTEND.md`](frontend/ROADMAP-FRONTEND.md)
> - Contrato entre ambos: [`CONTRATO.md`](CONTRATO.md)
>
> Regla para actualizar este archivo: se edita cuando **una fase
> completa cambia de estado** (arranca, termina) o cuando hay una
> decisión/bloqueo que concierne a ambas partes. Los avances parciales
> dentro de una fase van en el sub-roadmap correspondiente, no acá.

## Decisiones de arquitectura ya tomadas (de `plan-accion.md` y sesiones posteriores)
- Multi-tenancy: shared DB + `tenant_id`, no schema-per-tenant.
- Permisos por capacidades, no roles fijos.
- Agenda por empleado desde el inicio (Fase 1), no operador único como
  caso central.
- Búsqueda/reserva de negocios sube al MVP (Fase 2), no se pospone.
- Capa de servicios (`services.py`) por app, sin event bus formal
  (Django signals cuando haga falta desacoplar side-effects).
- Frontend: **React** + Capacitor (confirmado por el humano, 2026-07-24).
- Nombre del proyecto: **Turnio** (confirmado por el humano).
- **Estructura de repo: monorepo** (`backend/` + `frontend/` en este
  mismo repo Git), con dos personas trabajando en paralelo cada una
  con su propio Claude Code (confirmado por el humano, 2026-07-24).
- **Contrato API backend↔frontend: OpenAPI autogenerado**
  (`drf-spectacular` → `backend/openapi.yaml`) + `CONTRATO.md` para
  convenciones que el schema no captura (auth, errores, capacidades).
  Se prefirió sobre un doc mantenido a mano justamente porque dos
  Claude Code en paralelo, sin verse el código mutuamente, harían que
  un contrato manual se desincronizara del backend real tarde o
  temprano (confirmado por el humano, 2026-07-24).

## Estado por fase

| Fase | Estado | Detalle |
|---|---|---|
| Fase 0 — Fundacional | ✅ Completada (2026-07-24) | Solo backend; frontend no tenía tareas en esta fase. Ver `backend/ROADMAP-BACKEND.md`. |
| Fase 1 — Núcleo operativo multi-empleado | 🟡 Backend completado (2026-07-24), frontend sin empezar | Backend: Servicios, Empleados (capacidades + especialidad), Agenda por empleado con máquina de estados de `Cita`. Ver `backend/ROADMAP-BACKEND.md`. Frontend: app Capacitor mínima (login + agenda + registrar servicio) — pendiente, ver `frontend/ROADMAP-FRONTEND.md`. La fase no se cierra en este archivo hasta que el frontend entregue lo suyo. |
| Fase 2 — Descubrimiento y reserva de clientes | Sin empezar | |
| Fase 3 — Dinero (Caja, Comisiones, auditoría, offline) | Sin empezar | |
| Fase 4 — Clientes y reportes | Sin empezar | |
| Fase 5 — Beta y suscripción | Sin empezar | |
| Fase 6+ — Crecimiento | Sin empezar | |

Ver `CLAUDE.md` para el detalle completo de alcance de cada fase y qué
NO hacer todavía.

## Bloqueos o dudas abiertas que conciernen a ambas partes
1. Confirmar que el puerto 8001 del backend en local no choca con
   ninguna convención que el frontend ya tenga asumida para apuntar su
   cliente HTTP en desarrollo.
2. ~~Falta decidir, del lado frontend, el generador de tipos
   TypeScript a partir de `backend/openapi.yaml`~~ — Resuelto
   (2026-07-24): `openapi-typescript`, ver `frontend/ROADMAP-FRONTEND.md`.
3. CI de backend ya existe (`.github/workflows/backend-ci.yml`,
   2026-07-24). Cuando el frontend tenga código, falta un workflow
   equivalente para esa carpeta (lint/build/tests), a definir cuando
   arranque.

## Historial de fases

### Fase 0 — Fundacional — COMPLETADA (2026-07-24)
Backend funcional con multi-tenancy, modelos base (`Tenant`, `Negocio`,
`Usuario`, `MiembroNegocio` con capacidades), auth JWT y registro de
negocio con alta de empleados desde el inicio. Detalle completo,
dependencias y decisiones técnicas en `backend/ROADMAP-BACKEND.md`.

Además, en esta misma fecha se definió la estructura de colaboración
de dos personas (backend/frontend) en paralelo: monorepo, contrato
OpenAPI autogenerado (`CONTRATO.md` + `backend/openapi.yaml`), y
roadmap dividido por responsable con esta vista conjunta.

### Fase 1 — Núcleo operativo multi-empleado — backend completado (2026-07-24)
Backend: módulo de Servicios (precio, duración, categoría,
comisión configurable), extensión de Empleados (especialidad +
detalle/edición individual), y módulo de Agenda (horario semanal por
empleado, `Cita` con máquina de estados `agendada → confirmada →
completada`/`cancelada`, y asignación automática "cualquiera
disponible"). 36 tests pasando. Contrato (`CONTRATO.md` +
`backend/openapi.yaml`) actualizado con los nuevos endpoints. Detalle
completo y decisiones técnicas en `backend/ROADMAP-BACKEND.md`.

Frontend de esta fase (app Capacitor mínima) todavía no ha empezado;
la fase queda en estado mixto hasta que se entregue.
