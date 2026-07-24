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
- Los flujos críticos de dinero (registrar servicio, cobrar en caja)
  deben diseñarse pensando en soporte offline futuro: evita
  dependencias síncronas innecesarias en esos modelos.
- Sigue principios REST estándar en la API. Usa serializers de DRF con
  validación explícita, no lógica de negocio en las vistas.
- **Capa de servicios de aplicación**: toda lógica de negocio (calcular
  comisión, validar disponibilidad de agenda, abrir/cerrar caja, validar
  transición de estado) va en un módulo `services.py` por app de
  Django. Las vistas y serializers quedan delgados: solo orquestan
  entrada/salida HTTP y llaman a los servicios.
- **Permisos por capacidades, no por roles fijos**: no crees un enum
  cerrado de roles (Dueño/Empleado/Recepcionista). Usa capacidades
  granulares en `MiembroNegocio` (`puede_cobrar`, `puede_ver_reportes`,
  `puede_editar_precios`, `puede_gestionar_empleados`,
  `puede_gestionar_agenda`, y las que se agreguen). Al crear un negocio
  en modo "operador único", otorga automáticamente todas las
  capacidades a ese usuario (ver `apps.negocios.services.registrar_negocio`).
- **Auditoría desde el MVP**: cualquier mutación sobre modelos de Caja
  o Comisiones (Fase 3) debe quedar registrada (quién, qué, cuándo,
  tenant). Usa un modelo de log simple o `django-simple-history`; no
  construyas un sistema de eventos de dominio separado para esto.
- **Máquinas de estado simples** para `Cita`
  (`agendada → confirmada → completada → cancelada`, Fase 1) y `Caja`
  (`abierta → cerrada`, Fase 3). Valida las transiciones dentro de la
  capa de servicios. No introduzcas una librería de state machine
  pesada ni un motor de workflows genérico.
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
