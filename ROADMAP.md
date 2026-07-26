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
- **De "MVP que funciona" a proyecto profesional** (confirmado por el
  humano, 2026-07-24): ver `plan-accion.md` sección 0.3. Cada feature
  nueva pasa por un checklist explícito (seguridad, estados de
  carga/vacío/error, accesibilidad básica, responsive/mobile-first,
  contrato, tests) antes de darse por completa, en vez de descubrir
  los huecos después. Primer paso concreto: rediseño real de UI/UX
  del frontend (hoy solo tiene CSS mínimo funcional).
- **Se mantiene multi-empleado desde el inicio, se descarta "operador
  único por defecto"** (confirmado por el humano tras auditoría
  competitiva, 2026-07-25): ver `ESTRATEGIA-COMPETITIVA.md`. La
  evidencia de mercado (modelo de comisión 70/30 dueño/barbero,
  alquiler de silla como modelo estructural, y la debilidad de Goldie
  siendo justamente su manejo pobre de multi-staff) respalda la
  decisión ya tomada arriba, no un brief posterior que pedía operador
  único. El mismo documento fija el benchmark de producto en
  AgendaPro (competidor regional real) en vez de Goldie, y prioriza
  para Fase 3 conciliar pagos ya hechos por fuera (Nequi/Daviplata/
  Bre-B/efectivo) en vez de procesar pagos propios.

## Estado por fase

| Fase | Estado | Detalle |
|---|---|---|
| Fase 0 — Fundacional | ✅ Completada (2026-07-24) | Solo backend; frontend no tenía tareas en esta fase. Ver `backend/ROADMAP-BACKEND.md`. |
| Fase 1 — Núcleo operativo multi-empleado | 🟡 Backend completo; frontend primera pasada completa en rama `feature/frontend-fase1` (2026-07-24), sin mergear ni revisada por el compañero todavía | Backend: Servicios, Empleados (capacidades + especialidad), Agenda por empleado con máquina de estados de `Cita`. Frontend: login, registro de negocio, dashboard, Servicios, Agenda (horarios+citas), Empleados — ver `frontend/ROADMAP-FRONTEND.md` para pendientes (tests, edición completa de Servicios, storage nativo). La fase no se marca ✅ hasta que se mergee y el compañero la retome/valide. |
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
2. Falta decidir, del lado frontend, el generador de tipos TypeScript
   a partir de `backend/openapi.yaml` (ver dudas abiertas en
   `frontend/ROADMAP-FRONTEND.md`).
3. ~~CI de backend ya existe; falta el equivalente de frontend.~~
   Resuelto el 2026-07-25: `.github/workflows/frontend-ci.yml` corre
   lint, tests, build (`tsc -b`) y verifica que `src/api/schema.ts` esté
   regenerado contra `backend/openapi.yaml` — el espejo del chequeo de
   contrato que ya hacía el CI de backend.
4. **Validación con negocios reales pendiente** (ver
   `ESTRATEGIA-COMPETITIVA.md`): visitar ~10 barberías/salones locales
   para confirmar cómo agendan hoy, cómo pagan comisión a fin de
   semana, y qué pasa cuando se cae el internet, antes de comprometer
   el detalle de Fase 3 (Caja/Comisiones).
5. ~~Petición de frontend a backend: escritura en lote.~~ Resuelta el
   2026-07-25 (la misma persona hizo ambos lados): se agregaron `PUT
   /api/agenda/horarios/semana/` y `POST /api/servicios/lote/`, ambos
   transaccionales, y el frontend ya los consume. Ver `CONTRATO.md`
   sección 5.5 e historial.

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

### Fase 1 — frontend, primera pasada (2026-07-24, rama `feature/frontend-fase1`)
App Vite + React + TypeScript + Capacitor (sin plataformas nativas
agregadas aún) con las pantallas de login, registro de negocio,
dashboard, Servicios, Agenda (horarios y citas con "cualquiera
disponible" y máquina de estados) y Empleados. Tipos generados desde
`backend/openapi.yaml` con `openapi-typescript` + `openapi-fetch`, sin
librería de estado ni de UI (ver justificación en
`frontend/CLAUDE.md`). Se corrigió también un bug real de contrato
encontrado en el proceso (`POST /api/negocios/empleados/` documentaba
mal su body — ver `CONTRATO.md`).

Registro de negocio y Empleados se agregaron más allá del alcance
textual original de Fase 1 ("login + agenda + registrar servicio"),
a pedido explícito del humano tras detectar que sin registro la app
no era usable de punta a punta, y que el backend ya soportaba
Empleados por completo sin UI que lo expusiera.

Queda en rama sin mergear: el compañero de frontend la retoma mañana
para revisar, pulir pendientes (ver `frontend/ROADMAP-FRONTEND.md`) y
decidir si añade tests antes de mergear a `main`.
