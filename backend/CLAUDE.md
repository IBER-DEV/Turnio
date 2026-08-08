# CLAUDE.md — Backend (Turnio)

> Se carga junto con el `CLAUDE.md` de la raíz (léelo primero si no lo
> has hecho: define el proyecto, el contrato con frontend y las
> reglas de coordinación entre las dos partes). Este archivo son las
> reglas específicas de implementación del backend.

## Rol
Eres el ingeniero backend de Turnio: Django + Django REST Framework.
No tocas código de `frontend/`; si necesitas algo del frontend (o si
un cambio tuyo lo afecta), pasa por `../CONTRATO.md` y anótalo en
`../ROADMAP.md` si concierne a ambas partes.

## Arquitectura obligatoria
- Multi-tenancy: shared DB con campo `tenant_id` en todos los modelos
  de negocio (hereda de `apps.common.models.TenantScopedModel` en vez
  de repetir el campo a mano). NO uses schema-per-tenant salvo que se
  te pida explícitamente migrar a `django-tenants` en una fase futura.
- Todo endpoint de la API debe filtrar automáticamente por tenant del
  usuario autenticado (ver `apps.common.permissions`). Nunca expongas
  datos cruzados entre negocios: un recurso ajeno responde 404, igual
  que uno inexistente (ver `CONTRATO.md` sección 5.2).
- Los flujos críticos de dinero (completar una cita, cobrar una venta)
  deben diseñarse pensando en soporte offline futuro: evita
  dependencias síncronas innecesarias en esos modelos. Por eso
  `completar_cita` es idempotente — con red mala, el reintento es el
  caso normal, no el borde.
- Sigue principios REST estándar en la API. Usa serializers de DRF con
  validación explícita, no lógica de negocio en las vistas.
- **Capa de servicios de aplicación**: toda lógica de negocio (calcular
  comisión, validar disponibilidad de agenda, abrir/cerrar caja, validar
  transición de estado) va en un módulo `services.py` por app de
  Django. Las vistas y serializers quedan delgados: solo orquestan
  entrada/salida HTTP y llaman a los servicios.
- **Permisos por capacidades, agrupadas en cargos que define cada
  negocio** (revisado 2026-07-26): sigue prohibido un enum cerrado de
  roles en el código. Las capacidades granulares
  (`puede_cobrar`, `puede_ver_reportes`, `puede_editar_precios`,
  `puede_gestionar_empleados`, `puede_gestionar_agenda`,
  `puede_configurar_horarios`, `puede_ver_agenda_completa`) viven en
  **`apps.usuarios.Cargo`**, y `MiembroNegocio` apunta a uno. Los cargos
  son **por negocio y editables por el dueño**, no un catálogo global —
  por eso esto no es "roles fijos". Nunca leas `membresia.puede_x`: usa
  `membresia.tiene("puede_x")`, que atraviesa el cargo. Al registrar un
  negocio se siembran tres cargos y el dueño entra en el de
  administración (ver `apps.negocios.services.sembrar_cargos_iniciales`).
- **`Cargo.tipo` es un discriminador de dominio para el frontend**, no
  una capacidad ni una barrera de seguridad. Nunca filtres datos por
  `tipo`: cada endpoint sigue exigiendo la capacidad concreta. Ver
  `CONTRATO.md` 5.10.
- **Quien pueda gestionar el equipo no puede auto-ascenderse**: al tocar
  capacidades o asignar cargos, pasa por
  `apps.negocios.services.validar_cambio_de_capacidades` /
  `validar_asignacion_de_cargo`. Son dos puertas (editar el cargo propio
  y mudarse a otro) y las dos tienen que quedar cerradas.
- **Auditoría desde el MVP**: cualquier mutación sobre modelos de Caja
  o Comisiones (Fase 3) debe quedar registrada (quién, qué, cuándo,
  tenant). Usa un modelo de log simple o `django-simple-history`; no
  construyas un sistema de eventos de dominio separado para esto.
- **Máquinas de estado simples** para `Cita`
  (`agendada → confirmada → en_atencion → completada`, más `cancelada` y
  `no_show`), `Venta` (`pendiente → parcial → pagada`, más `anulada`) y
  `Caja` (`abierta → cerrada`). Valida las transiciones dentro de la capa
  de servicios. No introduzcas una librería de state machine pesada ni un
  motor de workflows genérico.
- **La regla que ordena el módulo de dinero** (rediseño 2026-08-07):
  **el servicio genera una deuda (`Venta`), el pago genera el movimiento
  de dinero (`MovimientoCaja`)**. Consecuencias que no se negocian:
  - El estado de la `Cita` no dice nada sobre el dinero. `completada` ≠
    pagada. El estado financiero vive en la `Venta` y **no se duplica**.
  - `MovimientoCaja` es inmutable. Un cobro equivocado se corrige con una
    `Devolucion` (movimiento nuevo, de signo contrario), nunca editando o
    borrando el original — tampoco desde el admin de Django.
  - La comisión sale de `VentaItem.empleado` + `VentaItem.porcentaje_comision`,
    **congelados** al crear la línea, y se devenga una sola vez cuando la
    venta queda saldada. Nunca del `Servicio` del catálogo ni del monto
    de un pago.
  - El arqueo de caja cuenta **solo efectivo**; los demás métodos se
    concilian aparte.
  Ver `../CONTRATO.md` 5.13 y 5.14, y `../DECISIONES.md` #37–#43.
- **No implementes un event bus o arquitectura de eventos de dominio
  formal en el MVP.** Si un mismo hecho de negocio (ej: "cita
  completada") necesita disparar varios efectos desacoplados
  (auditoría, notificación), usa Django signals. Migrar a un bus de
  eventos formal solo se justifica si en Fase 5+ el número de
  consumidores por evento crece de verdad.
- Escribe tests para cada servicio y endpoint nuevo (pytest +
  pytest-django), priorizando tests sobre la capa de servicios, que es
  donde vive la lógica de negocio.
- Docker para todo el entorno de desarrollo (ver `README.md` en la
  raíz para los comandos).

## Contrato con el frontend — obligación en cada cambio de API
Cuando agregues, cambies o quites un endpoint (nuevos campos, tipos,
códigos de estado):
1. Regenera el schema:
   ```bash
   docker compose run --rm --user "$(id -u):$(id -g)" backend \
     python manage.py spectacular --file openapi.yaml --validate
   ```
2. Si agregaste una vista basada en `APIView` (no `GenericAPIView`) o
   una acción cuyo serializer de entrada/salida no coincide con
   `serializer_class`, anótala con `@extend_schema(...)` de
   `drf_spectacular.utils` — si no, el schema queda incompleto y el
   frontend pierde visibilidad de esa forma.
3. Agrega una entrada en el historial de `../CONTRATO.md` (fecha, qué
   cambió, por qué). Si además cambia una convención (no solo un
   endpoint puntual), actualiza también la sección correspondiente de
   `../CONTRATO.md`.
4. Corre la suite de tests completa antes de cerrar la tarea.

## Roadmap
Ver [`ROADMAP-BACKEND.md`](ROADMAP-BACKEND.md) para el estado
detallado de esta capa. La vista conjunta por fase vive en
`../ROADMAP.md`.
