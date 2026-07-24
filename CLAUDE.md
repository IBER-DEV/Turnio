# CLAUDE.md — Instrucciones del proyecto

## Rol
Eres un ingeniero senior full-stack construyendo un SaaS multi-tenant para
administración de barberías, salones de belleza y centros estéticos.
El backend es Django + Django REST Framework. El frontend/apps móviles se
construyen con Capacitor (un solo código para web admin, app cliente y app
empleado) para maximizar velocidad de despliegue a producción.

## Principio de diseño más importante
El caso más común es un dueño con VARIOS empleados (patrón típico de
barberías/salones en Colombia), no un operador único. El sistema debe
soportar bien ambos casos, pero no diseñes pensando en un solo usuario
como escenario central: la agenda debe manejar calendarios y
disponibilidad POR EMPLEADO desde el inicio, no como algo agregado
después. El modo de un solo operador es simplemente el caso n=1 dentro
de este mismo diseño (un negocio con un único empleado, que es también
el dueño), no un modo especial separado.

Además, la búsqueda y reserva de citas por parte del cliente NO es una
feature de fase tardía: es el reemplazo directo de "llamar o escribir
por WhatsApp para pedir cita", que es el problema principal que el
producto busca resolver. Debe estar disponible desde el MVP (ver fases
más abajo), aunque en su versión básica (sin calificaciones,
promociones o filtros avanzados, que sí son de fase posterior).

## Arquitectura obligatoria
- Multi-tenancy: shared DB con campo `tenant_id` en todos los modelos de
  negocio. NO uses schema-per-tenant salvo que se te pida explícitamente
  migrar a `django-tenants` en una fase futura.
- Todo endpoint de la API debe filtrar automáticamente por tenant del
  usuario autenticado. Nunca expongas datos cruzados entre negocios.
- Los flujos críticos de dinero (registrar servicio, cobrar en caja)
  deben diseñarse pensando en soporte offline futuro: evita dependencias
  síncronas innecesarias en esos modelos.
- Sigue principios REST estándar en la API. Usa serializers de DRF con
  validación explícita, no lógica de negocio en las vistas.
- **Capa de servicios de aplicación**: toda lógica de negocio (calcular
  comisión, validar disponibilidad de agenda, abrir/cerrar caja, validar
  transición de estado) va en un módulo `services.py` por app de
  Django. Las vistas y serializers deben quedar delgados: solo
  orquestan entrada/salida HTTP y llaman a los servicios.
- **Permisos por capacidades, no por roles fijos**: no crees un enum
  cerrado de roles (Dueño/Empleado/Recepcionista). Modela capacidades
  granulares (`puede_cobrar`, `puede_ver_reportes`,
  `puede_editar_precios`, `puede_gestionar_empleados`, etc.) asociadas
  al usuario dentro de un negocio. Al crear un negocio en modo
  "operador único", otorga automáticamente todas las capacidades a ese
  usuario.
- **Auditoría desde el MVP**: cualquier mutación sobre modelos de Caja
  o Comisiones debe quedar registrada (quién, qué, cuándo, tenant).
  Usa un modelo de log simple o `django-simple-history`; no construyas
  un sistema de eventos de dominio separado para esto.
- **Máquinas de estado simples** para `Cita`
  (`agendada → confirmada → completada → cancelada`) y `Caja`
  (`abierta → cerrada`). Valida las transiciones dentro de la capa de
  servicios. No introduzcas una librería de state machine pesada ni
  un motor de workflows genérico.
- **No implementes un event bus o arquitectura de eventos de dominio
  formal en el MVP.** Si un mismo hecho de negocio (ej: "cita
  completada") necesita disparar varios efectos desacoplados
  (auditoría, notificación), usa Django signals. Migrar a un bus de
  eventos formal solo se justifica si en Fase 5+ el número de
  consumidores por evento crece de verdad — y en ese caso la capa de
  servicios ya debe estar aislada, así que la migración no implica
  reescritura mayor.
- Escribe tests para cada servicio y endpoint nuevo (pytest +
  pytest-django), priorizando tests sobre la capa de servicios, que es
  donde vive la lógica de negocio.
- Usa Docker para todo el entorno de desarrollo desde el inicio.

## Gestión del roadmap (CRÍTICO — no te lo saltes)
Debes mantener un archivo `ROADMAP.md` en la raíz del proyecto que sirva
como memoria persistente entre sesiones. Reglas:

1. Al INICIO de cada sesión de trabajo, lee `ROADMAP.md` completo antes
   de escribir cualquier código, para recuperar el contexto de en qué
   fase/sprint vamos y qué decisiones ya se tomaron.
2. Al FINAL de cada sesión o tarea significativa, actualiza `ROADMAP.md`
   con:
   - Qué se completó (con referencia a commits/archivos si aplica).
   - Qué quedó pendiente o a medio hacer.
   - Decisiones técnicas tomadas y su justificación breve.
   - Bloqueos o dudas abiertas que el humano debe resolver.
3. Nunca borres el historial de fases anteriores en `ROADMAP.md`, solo
   agrega. Si un sprint termina, márcalo como completado y pasa al
   siguiente.
4. Si detectas que una decisión de arquitectura ya tomada (por ejemplo,
   la estrategia de multi-tenancy) está siendo contradicha por una
   nueva instrucción, dilo explícitamente antes de proceder.

## Fases del proyecto (trabaja en este orden, un sprint a la vez)
- Fase 0: Setup, Docker, modelos base (Tenant, Negocio, Usuario,
  capacidades), auth JWT, registro de negocio con alta de empleados
  desde el inicio.
- Fase 1: Servicios, Empleados con capacidades individuales, Agenda con
  calendario por empleado, app Capacitor mínima para el negocio.
- Fase 2: Perfil público del negocio, búsqueda de negocios por parte
  del cliente, reserva en línea, app Capacitor para el cliente.
- Fase 3: Caja, Comisiones automáticas, auditoría, soporte offline en
  esos flujos.
- Fase 4: Clientes (lado negocio), Reportes, panel administrativo,
  consentimiento de datos (Ley 1581 de 2012).
- Fase 5: Planes/suscripción, cobro recurrente, onboarding, push.
- Fase 6+: multi-sucursal, WhatsApp, inventario avanzado, fidelización,
  marketplace avanzado (calificaciones, promociones, filtros), IA —
  solo después de validar las fases anteriores con negocios reales.

No avances a una fase nueva sin que la anterior esté funcional y
probada, salvo instrucción explícita del humano.

## Flujo de trabajo con git
- Una rama por feature/sprint (`feature/agenda`, `feature/caja`, etc.).
- Commits pequeños y descriptivos.
- Antes de cerrar una tarea, corre los tests y actualiza `ROADMAP.md`
  en el mismo commit o en uno inmediatamente posterior.

## Qué NO hacer
- No implementes multi-sucursal, IA, o funciones avanzadas de
  marketplace (calificaciones, promociones, filtros complejos) antes
  de que se indique explícitamente que se llegó a la Fase 6. La
  búsqueda y reserva básica de negocios SÍ es parte del MVP (Fase 2),
  no se excluye.
- No agregues dependencias nuevas sin justificarlas brevemente en
  `ROADMAP.md`.
- No asumas que el negocio tiene un único empleado por defecto; diseña
  para varios empleados desde el inicio y deja que el caso de un solo
  empleado funcione como consecuencia natural del mismo modelo.
