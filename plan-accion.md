# Plan de Acción — SaaS para Barberías y Salones de Belleza

## 0. Resumen de la auditoría

El requerimiento original es completo pero está pensado como una versión madura del producto (multi-rol, multi-sucursal, marketplace, IA). Para un negocio típico donde **una sola persona es dueña, barbero, recepcionista y cajera al mismo tiempo**, eso genera fricción innecesaria y retrasa la validación del negocio. Los ajustes clave:

1. **Modo "negocio individual" de primera clase.** El dueño no debe crear un "empleado" para poder atenderse a sí mismo. Al registrar el negocio, se crea automáticamente un perfil de "operador" con todos los permisos (dueño + empleado + caja), y solo si el negocio crece se activa la gestión multi-empleado.
2. **Multi-tenancy definido desde el día 1**: shared DB + `tenant_id` (más rápido de construir y migrar que schema-per-tenant). Se deja `django-tenants` como posible migración futura si un cliente enterprise lo exige.
3. **Modo offline para lo crítico**: registrar un servicio y cobrar en caja deben poder hacerse sin conexión y sincronizar después. Esto se decide en el modelo de datos, no se agrega después.
4. **Cumplimiento de datos personales (Ley 1581 de 2012, Colombia)** desde el MVP: consentimiento de datos, política de privacidad, derecho a eliminación de datos del cliente.
5. **Marketplace, fidelización avanzada, IA y multi-sucursal se mueven a fases posteriores.** Son diferenciadores válidos, pero no bloquean el lanzamiento ni compiten por tiempo de desarrollo con lo operativo.
6. **Integración con WhatsApp se prioriza más de lo que sugiere el documento original**, dado el mercado (Colombia, Nequi/Daviplata ya mencionados): es el canal de confirmación de citas más usado por el usuario final, no un "nice to have" tardío.

---

## 0.1 Ajustes de arquitectura interna (ronda 2)

Tras revisión adicional, se incorporan tres mejoras concretas — sin adoptar DDD/eventos de dominio completos, que serían sobre-ingeniería para el tamaño actual del proyecto:

1. **Permisos basados en capacidades, no en roles rígidos.** En lugar de un enum fijo de roles (Dueño/Empleado/Recepcionista), cada usuario de un negocio tiene un conjunto de capacidades booleanas (`puede_cobrar`, `puede_ver_reportes`, `puede_editar_precios`, `puede_gestionar_empleados`, etc.). Al crear un negocio en modo "operador único", se le otorgan automáticamente todas las capacidades. Esto es lo que de verdad resuelve el caso de una sola persona sin forzar un rol artificial, y escala mejor a franquicias/cadenas después sin migración de datos.
2. **Auditoría desde el MVP, no en fase posterior.** Todo cambio sobre Caja y Comisiones (los dos módulos que tocan dinero) queda registrado: quién, qué, cuándo, tenant. Se implementa con un modelo simple de log (o `django-simple-history` sobre esos modelos), no con un sistema de eventos separado.
3. **Máquinas de estado simples para transiciones críticas**: `Cita` (`agendada → confirmada → completada → cancelada`) y `Caja` (`abierta → cerrada`). Se valida la transición en la capa de servicios, evitando estados inconsistentes, sin necesidad de una librería de state machine pesada.
4. **Capa de servicios de aplicación** (`services.py` por app Django): la lógica de negocio (calcular comisión, validar disponibilidad de agenda, abrir/cerrar caja) vive ahí, no en vistas ni serializers, que quedan delgados. Para los pocos casos de side-effects desacoplados (ej: registrar auditoría al completar una cita, disparar notificación) se usan **Django signals**, no un event bus formal — se deja como posible evolución de Fase 5+ si el número de consumidores por evento lo justifica.

---

## 0.2 Corrección de prioridades (ronda 3)

Dos correcciones importantes al enfoque anterior:

1. **El caso más común no es el operador único, es un dueño con varios empleados** (patrón típico de barberías/salones en Colombia). El modelo de permisos por capacidades (sección 0.1) sigue siendo la decisión correcta — de hecho es más útil aquí, porque cada empleado puede tener una combinación distinta de capacidades sin forzar roles genéricos. Lo que cambia es que **la agenda debe soportar calendarios por empleado desde la Fase 1** (disponibilidad individual, asignar cita a un empleado específico o "cualquiera disponible"), no tratarse como un calendario único del negocio. El modo "operador único" sigue soportado, simplemente como el caso n=1, no como el centro del diseño.
2. **La búsqueda y reserva de negocios por parte del cliente se sube al MVP.** No es un diferenciador de fase posterior: es el reemplazo directo del dolor #1 identificado en el documento original (llamar o escribir por WhatsApp para pedir cita). Sin esto, el producto es solo un cuaderno digital para el dueño y no resuelve el lado del cliente. Lo que sí se mantiene en fases posteriores es la parte "pesada" del marketplace: calificaciones/reseñas, promociones, filtros avanzados y multi-sucursal — esas son mejoras sobre un descubrimiento básico que ya funciona, no requisitos de lanzamiento.

---

## 0.3 Corrección de enfoque: de "MVP que funciona" a proyecto profesional (ronda 4)

Durante la construcción de Fase 0 y Fase 1 aparecieron varios huecos
reales que **no fueron detectados por diseño, sino solo cuando algo
los forzó a la superficie** (una pregunta, un intento de tipar el
frontend, una prueba manual). Ese patrón — construir rápido y
descubrir el hueco después, en vez de diseñarlo fuera desde el
principio — es exactamente el síntoma de tratar esto como "MVP que
funciona" en vez de como el producto profesional que debe ser. Huecos
concretos encontrados así hasta ahora:

- **Seguridad de autenticación incompleta**: no existe flujo de
  "olvidé mi contraseña" (ningún endpoint de reset), y no hay
  throttling/rate-limiting en `/api/auth/login/` (nada impide fuerza
  bruta sobre contraseñas hoy). `SECRET_KEY` de `.env.example` es
  débil a propósito para dev, pero nunca se documentó un checklist de
  qué cambiar antes de un despliegue real.
- **Un endpoint completo faltaba y nadie lo había planeado**:
  `GET /api/negocios/mi-membresia/` no existía hasta que se preguntó
  explícitamente "¿cómo sabe el frontend qué vista mostrar sin
  roles?" — antes de eso, el plan implícito era que el frontend
  listara empleados y se buscara a sí mismo por email, un workaround
  fragil que nadie había cuestionado.
- **Un bug de documentación del contrato pasó desapercibido**:
  `POST /api/negocios/empleados/` documentaba mal su propio body de
  entrada (schema incorrecto) desde que se creó, y solo se detectó al
  generar tipos TypeScript reales para el frontend — es decir, la API
  nunca había sido consumida por un cliente real hasta ese punto.
- **Pantallas completas faltaban en el frontend** (registro de
  negocio, gestión de empleados) a pesar de que el backend ya las
  soportaba por completo — se construyeron solo cuando se hizo la
  pregunta "¿el backend ya permite esto?", no como parte del diseño
  original de las pantallas.
- **La UI/UX es funcional pero no profesional**: sin sistema de
  diseño (colores, tipografía, espaciado consistente más allá de CSS
  plano mínimo), sin estados de carga/vacío/error diseñados (hoy es
  texto plano rojo), sin diálogos de confirmación para acciones
  destructivas (borrar un horario, cancelar una cita), sin
  notificaciones (toasts) de éxito/error, sin ningún atributo de
  accesibilidad (`aria-*`, foco de teclado), y sin un paso explícito
  de diseño responsive/mobile-first a pesar de que el producto final
  es una app Capacitor. Nada de esto es un bug puntual — es la
  ausencia de un diseño de UI/UX real antes de programar las
  pantallas.
- **Sin tests automatizados de frontend** ni CI para esa carpeta
  (el backend sí tiene ambos desde Fase 0/1).

### Política a partir de ahora
No se trata de parar a rehacer todo lo ya construido, sino de que
**cada feature nueva pase por un checklist explícito antes de darse
por completa**, en vez de descubrir los huecos después:

1. **Seguridad**: casos de autenticación/autorización cubiertos
   (incluyendo los "negativos": sin token, token expirado, sin
   capacidad), rate-limiting donde aplique, sin secretos débiles
   fuera de entornos de desarrollo.
2. **UX de estados**: todo flujo async tiene estado de carga, estado
   vacío, estado de error (con mensaje útil, no solo "no se pudo"), y
   confirmación explícita antes de cualquier acción destructiva.
3. **Accesibilidad básica**: labels asociados a inputs, foco de
   teclado manejable, contraste de color suficiente.
4. **Responsive/mobile-first**: cada pantalla se diseña pensando en
   el tamaño de pantalla de un celular primero, no como adaptación
   tardía de una vista de escritorio.
5. **Contrato**: sigue vigente la regla de oro de `CONTRATO.md`
   (schema regenerado + anotado en cada cambio de forma), reforzada
   ahora por la experiencia del bug de `EmpleadoAlta`.
6. **Tests**: cobertura tanto en backend (ya exigida desde Fase 0)
   como en frontend (nueva exigencia a partir de esta ronda).

El primer paso concreto de esta corrección es un rediseño real de
UI/UX del frontend (ver prompt de diseño entregado al humano), en vez
de seguir agregando pantallas sobre el CSS mínimo actual.

---

## 1. Stack técnico definido

| Capa | Tecnología | Notas |
|---|---|---|
| Backend | Django + Django REST Framework | API REST, autenticación JWT |
| Multi-tenancy | Shared DB + `tenant_id` en modelos | Migrable a schema-per-tenant si es necesario |
| Frontend / Móvil | Capacitor + framework web (React o Vue) | Un solo código para web admin + apps móviles (cliente/empleado) |
| Base de datos | PostgreSQL | Soporta bien filtrado por tenant e índices |
| Tareas asíncronas | Celery + Redis | Recordatorios, cálculo de comisiones, reportes |
| Notificaciones | Firebase Cloud Messaging (push) + WhatsApp Business API (fase posterior) | |
| Pagos/Suscripción SaaS | Pasarela local (Wompi/ePayco) o Stripe | Cobro recurrente del plan del negocio |
| Infraestructura | Docker desde el inicio | Facilita escalar horizontalmente después |

---

## 2. Roadmap por fases (Sprints de ~2 semanas)

### Fase 0 — Fundacional (Sprint 0)
- Setup de repositorio, Docker, CI básico.
- Definir modelos base: `Tenant`, `Negocio`, `Usuario`, y modelo de **capacidades** (permisos granulares por empleado, no roles fijos).
- Autenticación JWT + registro de negocio y alta de empleados (el dueño arranca con todas las capacidades; empleados adicionales se configuran desde el inicio, no como feature opcional).
- Establecer la convención de capa de servicios (`services.py` por app) desde el primer módulo que se construya.
- **Entregable:** backend corriendo con multi-tenancy funcional, login, y sistema de capacidades base.

### Fase 1 — Núcleo operativo multi-empleado (Sprints 1-2)
- Módulo de Servicios (precio, duración, comisión, categoría).
- Módulo de Empleados con capacidades individuales (cada uno puede tener permisos distintos: cobrar, ver reportes, editar precios, etc.).
- Módulo de Agenda con **calendario por empleado** (disponibilidad individual, asignar cita a un empleado específico o "cualquiera disponible"), y máquina de estados de `Cita` (`agendada → confirmada → completada → cancelada`) validada en la capa de servicios.
- App Capacitor mínima para el negocio: login + agenda + registrar servicio.
- **Entregable:** un negocio con varios empleados puede configurarse y gestionar su agenda de principio a fin, con transiciones de estado consistentes.

### Fase 2 — Descubrimiento y reserva de clientes (Sprints 3-4)
- Perfil público básico del negocio (nombre, dirección, ciudad, servicios, horarios, fotos).
- Búsqueda de negocios por parte del cliente (por ciudad y/o servicio).
- App Capacitor para el cliente: registro, búsqueda, ver disponibilidad y reservar cita en línea.
- Confirmación automática de cita (push/correo) sin intercambio manual de mensajes.
- **Entregable:** un cliente puede encontrar un negocio y reservar una cita sin llamar ni escribir por WhatsApp — este es el reemplazo directo del dolor #1 del negocio original.

### Fase 3 — Dinero (Sprints 5-6)
- Módulo de Caja (apertura/cierre como máquina de estados simple, métodos de pago).
- Módulo de Comisiones (cálculo automático al registrar servicio, vía capa de servicios).
- Auditoría (quién/qué/cuándo) sobre todos los cambios en Caja y Comisiones.
- Modo offline para registrar servicio + cobro, con sincronización posterior.
- **Entregable:** el flujo completo de "agendar → atender → cobrar → liquidar comisión" funciona incluso sin conexión momentánea, y queda auditado.

### Fase 4 — Clientes y reportes (Sprints 7-8)
- Módulo de Clientes (historial, datos, preferencias) del lado del negocio.
- Módulo de Reportes (ventas, comisiones, por empleado/servicio).
- Panel administrativo con indicadores clave.
- Consentimiento de datos y política de privacidad (Ley 1581).
- **Entregable:** MVP completo, listo para primeros negocios piloto reales, con oferta y demanda (negocio + cliente) funcionando de extremo a extremo.

### Fase 5 — Beta y suscripción (Sprint 9)
- Módulo de planes/suscripción y cobro recurrente.
- Onboarding guiado tanto para negocios de un solo empleado como para negocios con varios.
- Recordatorios push de citas.
- **Entregable:** producto cobrable, listo para beta cerrada.

### Fase 6 — Crecimiento (Sprints 10+)
- Multi-sucursal (un negocio con varias sedes desde una sola cuenta).
- Integración WhatsApp (confirmaciones/recordatorios).
- Inventario avanzado con alertas de stock.
- Programa de fidelización (puntos, membresías).
- Marketplace avanzado: calificaciones/reseñas, promociones, filtros avanzados.
- Estadísticas avanzadas y asistente con IA.

---


Usa esto como `CLAUDE.md` en la raíz del proyecto (o pégalo como instrucción inicial de sesión). Está diseñado para que Claude Code mantenga contexto entre sesiones mediante un roadmap vivo, trabaje por sprints, y respete las decisiones de arquitectura ya tomadas.

```markdown
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
```

---

## 4. Siguiente paso sugerido

Con esto ya tienes: la crítica honesta del planteamiento original, el stack definido, el roadmap por sprints, y el prompt listo para pegar en Claude Code. Lo único que falta antes de arrancar es el nombre del proyecto y decidir si el frontend web usará React o Vue (Capacitor funciona igual de bien con ambos).