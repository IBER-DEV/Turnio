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
- Permisos por capacidades, no roles fijos. **Reevaluado y confirmado el
  2026-07-26**: el humano preguntó si era momento de introducir roles al
  aparecer casos como "quiero que mi recepcionista agende citas pero no
  cambie el horario del local". Se mantuvo la decisión porque los roles
  agrupan capacidades y no dicen nada sobre **alcance** (sobre qué
  objetos se puede actuar), que es el eje donde estaban saliendo los
  problemas — con roles habría hecho falta igual la excepción de
  propiedad por encima del rol. **Disparador explícito para reabrirlo**:
  cuando el alta pase de ~8 flags, o cuando se repita la misma
  combinación una y otra vez. Si el dolor es lo tedioso del alta, la
  salida barata son presets de UI sobre las capacidades existentes, sin
  tocar el modelo. Con las dos capacidades agregadas ese día vamos en 7.
- ~~**Tipos de empleado como plantilla de UI, no como rol persistido**
  (2026-07-26).~~ **Revertido el mismo día**: el humano lo consideró
  precipitado. Los tipos vivían solo en el frontend y se deducían
  comparando capacidades. Reemplazado por el punto siguiente.
- **Cargos por negocio en el backend + discriminador de dominio**
  (confirmado por el humano, 2026-07-26). Es la forma definitiva del
  modelo de permisos:
  - **`Cargo`** (tabla por negocio, editable por el dueño) **posee** las
    capacidades. `MiembroNegocio` apunta a uno y no tiene permisos
    propios: sin excepciones por persona, que es lo que mantiene la
    "cero complejidad" pedida. Si alguien necesita algo distinto, se le
    crea un cargo. El negocio nace con tres cargos sembrados y editables.
  - **`Cargo.tipo`** (`administracion` / `recepcion` / `operativo`) es un
    **discriminador de dominio**: el frontend lo usa para decidir qué
    shell montar y dónde aterriza cada quien, sin encadenar condicionales
    por capacidad. **No es una barrera de seguridad** — el backend sigue
    exigiendo la capacidad concreta en cada endpoint.
  - Dos niveles de gating: **`tipo` decide la forma de la app**, **las
    capacidades deciden las acciones**. Eso es lo que da la arquitectura
    PBAC y la UI state-driven que pidió el humano.

  Tampoco contradice "capacidades, no roles fijos": lo prohibido es un
  enum cerrado de roles en el código, y acá los cargos los define cada
  negocio. Se actualizaron ambos `CLAUDE.md`. Reglas completas en
  `CONTRATO.md` 5.10.
- Agenda por empleado desde el inicio (Fase 1), no operador único como
  caso central. **Matizado el 2026-07-26** (ver siguiente punto): sigue
  siendo por empleado, pero el horario se hereda del negocio en vez de
  cargarse empleado por empleado.
- **El horario es del negocio; el del empleado es la excepción**
  (confirmado por el humano, 2026-07-26). `HorarioNegocio` es la fuente
  de verdad de la disponibilidad y todo empleado lo hereda; quien
  trabaja distinto (medio tiempo, solo sábados, turno de tarde) tiene
  horario propio que lo reemplaza. Nace de una observación de uso real
  ("al usuario le toca asignarle el horario a sus empleados uno por
  uno") y de la corrección que la reencuadró ("los horarios son de los
  negocios, no de empleados"). Se señaló la tensión con la decisión de
  arriba antes de proceder: **no se eliminó la disponibilidad por
  empleado** —eso habría roto al barbero de medio tiempo y los turnos
  rotativos—, se le puso un valor por defecto que antes no existía.
  Reglas completas en `CONTRATO.md` sección 5.7. Es cambio con ruptura
  (`PUT /api/agenda/horarios/semana/` pasa de `miembro` a `miembros[]`,
  y `franjas: []` cambió de significado); backend y frontend se
  entregaron juntos.
- **Tres capacidades de agenda, y `puede_gestionar_empleados` acotada**
  (2026-07-26, cambio con ruptura). De la auditoría del modelo de
  permisos pedida por el humano: `puede_gestionar_agenda` se partió en
  operar citas + `puede_configurar_horarios` + `puede_ver_agenda_completa`,
  y se cerraron dos huecos que la auditoría destapó — una **escalada de
  privilegios explotable** (quien gestionaba el equipo podía concederse
  todo con un PATCH sobre sí mismo) y la **fuga de la libreta de
  clientes** (cualquier empleado leía nombre y teléfono de los clientes
  de todo el negocio). Reglas completas en `CONTRATO.md` 5.8 y 5.9.
- Búsqueda/reserva de negocios sube al MVP (Fase 2), no se pospone.
- Capa de servicios (`services.py`) por app, sin event bus formal
  (Django signals cuando haga falta desacoplar side-effects).
- Frontend: **React** + Capacitor (confirmado por el humano, 2026-07-24).
- Nombre del proyecto: **Turnio** (confirmado por el humano).
- **Estructura de repo: monorepo** (`backend/` + `frontend/` en este
  mismo repo Git), con dos personas trabajando en paralelo cada una
  con su propio Claude Code (confirmado por el humano, 2026-07-24).
  Existe además **`landing/`** (sitio de marketing en Astro, con su
  propio `ROADMAP-LANDING.md`), que no estaba documentado acá hasta el
  2026-07-28.
- **Un solo dominio, una ruta por negocio** (confirmado por el humano,
  2026-07-28): el perfil público de cada negocio vive en
  `turnio.app/{slug}`, no en subdominios. Sin costo de dominio por
  negocio y con las páginas públicas cacheables en CDN, que es lo que
  mantiene barata la infraestructura mientras el tráfico público crece.
  **Consecuencia técnica**: el slug comparte espacio de nombres con las
  rutas de la app, así que hay una lista de slugs reservados en el
  backend (ver `CONTRATO.md` 5.11) que debe crecer con cada ruta nueva
  en la raíz del frontend.
- **El cliente reserva sin cuenta** (confirmado por el humano,
  2026-07-28): nombre y teléfono, nada más. Registrarse es fricción
  justo en el momento en que el producto compite contra un WhatsApp.
  El módulo `Cliente` sigue siendo de Fase 4.
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
| Fase 1 — Núcleo operativo multi-empleado | ✅ Completada (2026-07-26) | Backend y frontend entregados y mergeados. Servicios, Empleados, Agenda por empleado con máquina de estados de `Cita`, horario del negocio con herencia, y el modelo de permisos por cargos. Detalle en ambos sub-roadmaps. |
| Fase 2 — Descubrimiento y reserva de clientes | 🟡 Backend público completo (2026-07-28); falta el frontend | Backend: búsqueda de negocios, perfil público, disponibilidad y reserva **sin cuenta**, con throttling y slugs reservados. Ver `CONTRATO.md` 5.11. Frontend: perfil público en `turnio.app/{slug}`, búsqueda y flujo de reserva — sin empezar. |
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
6. ~~**Dos capacidades declaradas que no hacen nada todavía**:
   `puede_cobrar` y `puede_ver_reportes`.~~ Resuelta el 2026-07-26 en la
   dirección honesta: la UI las marca con un chip "Pronto" y siguen
   siendo configurables, pero ya no se presentan como si hicieran algo.
   Se quita el chip cuando Caja (Fase 3) y Reportes (Fase 4) las exijan
   de verdad.
7. **Bloqueante de entrada a Fase 3**: `porcentaje_comision` vive en
   `Servicio` y lo controla `puede_editar_precios`. Hoy es inerte, pero
   cuando Caja conecte el cálculo real, quien pueda editar servicios
   podrá subirse su propia comisión. Separar antes de conectar.

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
