# Contrato Backend ↔ Frontend

Este documento es la frontera entre el trabajo de backend y frontend.
Los dos se desarrollan con Claude Code en paralelo, cada uno en su
propia carpeta (`backend/`, `frontend/`) y potencialmente sin leer el
código del otro. **Ninguna de las dos partes debe asumir la forma de
una request/response, un flujo de auth o una convención de nombres sin
consultar este documento o el schema.** Si algo que necesitas no está
acá, es un bug de documentación: pregúntalo/anótalo, no lo adivines.

## 1. Dónde vive el contrato

- **Fuente de verdad de forma de datos (autogenerada, nunca se edita a
  mano):** [`backend/openapi.yaml`](backend/openapi.yaml). Se
  regenera desde el código real de la API con:
  ```bash
  docker compose run --rm --user "$(id -u):$(id -g)" backend \
    python manage.py spectacular --file openapi.yaml --validate
  ```
- **Explorable en vivo** (con el backend corriendo,
  `docker compose up -d`): Swagger UI en
  `http://localhost:8001/api/docs/`, schema crudo en
  `http://localhost:8001/api/schema/`.
- **Convenciones que el schema no captura:** este documento.

Regla de oro: si backend cambia la forma de un endpoint (campos,
tipos, nuevos endpoints), **debe regenerar `openapi.yaml` en el mismo
commit** y agregar una entrada en el [Historial de cambios](#6-historial-de-cambios-al-contrato)
de abajo.

## 2. Entornos y URLs base

| Entorno | URL backend |
|---|---|
| Local (Docker Compose, este repo) | `http://localhost:8001` |
| Producción | _por definir (Fase 5+, cuando haya despliegue real)_ |

## 3. Autenticación

JWT vía `djangorestframework-simplejwt`.

- `POST /api/auth/login/` con `{"email": "...", "password": "..."}`
  (el campo es `email`, no `username`) → `{"access": "...", "refresh": "..."}`.
- `POST /api/auth/refresh/` con `{"refresh": "..."}` → nuevo `access`
  (y nuevo `refresh`, porque `ROTATE_REFRESH_TOKENS=True`: el frontend
  debe guardar siempre el `refresh` más reciente que reciba).
- Peticiones autenticadas: header `Authorization: Bearer <access>`.
- Vigencia: `access` 8 horas, `refresh` 14 días. El frontend debe
  manejar el caso de access expirado (401) refrescando con el
  `refresh`, y el caso de refresh expirado forzando login de nuevo.

### 3.1 "Quién soy" — `GET /api/negocios/mi-membresia/`

El login **no** devuelve el email, nombre, negocio ni capacidades del
usuario — solo tokens. Para resolver "quién soy, en qué negocio y qué
puedo hacer", el frontend debe llamar a
`GET /api/negocios/mi-membresia/` (con el `access` en el header) justo
después de loguearse, y también al recuperar sesión desde tokens
guardados (ej. al reabrir la app). Responde:

```json
{
  "id": 6,
  "email": "ana@elcorte.com",
  "nombre": "Ana",
  "especialidad": "Barbera",
  "negocio": {"id": 4, "nombre": "Barbería El Corte", "slug": "barberia-el-corte", "ciudad": "Bogotá", "direccion": "", "telefono": "", "activo": true},
  "puede_cobrar": false,
  "puede_ver_reportes": false,
  "puede_editar_precios": false,
  "puede_gestionar_empleados": false,
  "puede_gestionar_agenda": true,
  "activo": true
}
```

**No** se resuelve buscando por email en `GET /api/negocios/empleados/`
(esa lista es para gestionar empleados, no para autoidentificarse) —
este endpoint dedicado resuelve la membresía directamente desde el
JWT del solicitante, sin ambigüedad y sin depender de que el frontend
recuerde el email con el que se logueó.

### 3.2 Lo que la autenticación NO cubre todavía (a propósito, no un olvido)

Documentado para que ninguna pantalla se construya asumiendo que
existen — si el frontend los necesita, es una conversación de
contrato nueva, no una suposición:

- **No hay "olvidé mi contraseña"**: ningún endpoint de reset de
  contraseña existe hoy. No agregues un link "¿Olvidaste tu
  contraseña?" que apunte a algo que no está implementado.
- **No hay rate-limiting en `/api/auth/login/`**: no hay protección
  contra fuerza bruta todavía. Cuando se agregue, la API empezará a
  responder `429 Too Many Requests` (probablemente con header
  `Retry-After`) — el frontend deberá manejar ese código, pero hoy no
  puede pasar.
- **No hay verificación de email** al registrar un negocio o agregar
  un empleado: la cuenta queda activa de inmediato con el primer
  login.

Estos tres son huecos reconocidos (ver `plan-accion.md` sección 0.3),
no decisiones de diseño definitivas — se espera que se resuelvan en
una fase de endurecimiento de seguridad antes de un lanzamiento real,
no en Fase 1.

## 4. Convenciones de la API

- **Idioma y formato de campos JSON: español, `snake_case`**
  (`nombre_negocio`, `puede_cobrar`, `email_dueno`), consistente con el
  dominio del negocio. No se traduce a inglés en ningún punto de la API.
- **Errores**: formato estándar de DRF.
  - `400`: `{"campo": ["mensaje de error"]}` por cada campo inválido,
    o `{"non_field_errors": [...]}` para errores que no son de un
    campo puntual.
  - `401`: no autenticado / token inválido o expirado.
  - `403`: autenticado pero sin la capacidad requerida para la acción
    (ver sección 5).
  - `404`: recurso no existe o no pertenece al tenant del solicitante
    (ver sección 5.4: nunca se distingue "no existe" de "no es tuyo").
  - **Limitación reconocida**: los mensajes de error son texto humano
    en español (`"El precio debe ser mayor a cero."`), no códigos de
    error legibles por máquina (ej. `PRECIO_INVALIDO`). Sirve para
    mostrar el mensaje tal cual, pero no permite que el frontend
    reaccione distinto según el tipo de error, ni traducir a otro
    idioma. Aceptable para Fase 1; si el frontend necesita distinguir
    programáticamente entre tipos de error (no solo mostrarlos), es un
    cambio de contrato a proponer, no algo a inferir parseando el
    string del mensaje.
- **IDs**: `Tenant` usa UUID; el resto de modelos (`Negocio`,
  `MiembroNegocio`, etc.) usan enteros autoincrementales. El frontend
  no debe asumir un formato único de ID entre entidades.
- **Paginación**: ningún endpoint pagina todavía, incluyendo
  `GET /api/agenda/citas/` y `GET /api/servicios/` (Fase 1): a la
  escala de un negocio individual la lista completa es manejable. Si
  en fases posteriores el volumen lo justifica, se documentará aquí el
  esquema de paginación **antes** de activarlo (cambio de contrato).
- **Máquina de estados de `Cita`**: `agendada → confirmada →
  completada`, con `cancelada` alcanzable desde `agendada` o
  `confirmada` (no desde `completada`). No se transiciona con
  `PATCH estado=...`: son acciones dedicadas —
  `POST /api/agenda/citas/{id}/confirmar/`,
  `.../completar/`, `.../cancelar/` — que devuelven `400` si la
  transición no es válida desde el estado actual.

## 5. Modelo de permisos (capacidades, no roles)

No hay roles fijos tipo "Dueño"/"Empleado". Cada usuario tiene una
membresía (`MiembroNegocio`) en un negocio con capacidades booleanas
independientes. La lista vigente de capacidades **vive en el schema**
(`MiembroNegocio` en `openapi.yaml`); a la fecha de este documento son:

- `puede_cobrar`
- `puede_ver_reportes`
- `puede_editar_precios`
- `puede_gestionar_empleados`
- `puede_gestionar_agenda`

Esta lista **crecerá** en fases futuras (ej. Fase 1 probablemente
agregue algo como `puede_gestionar_agenda_propia` vs. la de otros
empleados). El frontend no debe hardcodear un switch/enum cerrado de
capacidades sin volver a chequear el schema: debe tratarlas como un
conjunto de flags que se itera, no una lista fija de opciones de UI.

### 5.1 Caso "operador único"

El dueño que registra un negocio recibe automáticamente **todas** las
capacidades. El frontend no necesita un flujo de UI distinto para este
caso: es simplemente un negocio cuya única membresía tiene todo en
`true`.

### 5.2 Perfil del empleado vs. capacidades

`MiembroNegocio` (el "empleado" dentro de un negocio) tiene, además de
las capacidades booleanas, un campo `especialidad` (texto libre, ej.
"Barbero", "Estilista") que es puramente informativo para la UI (no
es una capacidad ni afecta permisos).

### 5.3 Agendar una cita: "cualquiera disponible"

`POST /api/agenda/citas/` acepta `empleado` como **opcional**. Si se
omite (o se envía `null`), el backend asigna automáticamente el
primer empleado del negocio con disponibilidad real para ese servicio
y horario (según `HorarioTrabajo` y que no tenga otra cita
encimada). Si no hay ningún empleado disponible, responde `400` con
`non_field_errors`. El frontend nunca debe intentar calcular la
disponibilidad por su cuenta ni elegir un empleado "al azar": siempre
delega esa decisión al backend omitiendo el campo.

### 5.4 Directorio del equipo vs. gestión de empleados

Hay **dos** endpoints para listar personas del negocio, a propósito:

- **`GET /api/negocios/equipo/`** — directorio mínimo (`id`, `nombre`,
  `especialidad`, `activo`). Lo puede pedir **cualquier miembro**. Es lo
  que necesita la agenda: filtrar el calendario por empleado, ofrecer
  "cualquiera disponible" y cargar horarios.
- **`GET /api/negocios/empleados/`** (y `.../{id}/`) — vista de
  **gestión**: incluye `email` y la matriz de capacidades. Exige
  `puede_gestionar_empleados` **tanto para leer como para escribir**.

La separación es deliberada: el email y los permisos de un compañero son
datos de administración, no información que todo el equipo necesite. Se
prefirió partir en dos endpoints —cada uno con una forma honesta en el
schema— antes que un solo endpoint que devuelva más o menos campos
según quién pregunte, que habría quedado ambiguo de tipar.

Para el frontend esto significa: si solo necesitas nombres de
empleados, usa `/equipo/`. `/empleados/` es únicamente para la pantalla
de gestión de equipo, que además debería estar oculta a quien no tenga
la capacidad (si no, verá un 403).

### 5.5 Aislamiento por tenant

Todo endpoint de negocio filtra automáticamente por el tenant del
usuario autenticado. Un usuario nunca puede ver ni deducir la
existencia de datos de otro negocio: un recurso ajeno responde `404`,
igual que uno inexistente.

### 5.6 Escritura en lote: horario semanal y alta de servicios

Dos operaciones tienen endpoint de lote **además** del CRUD de a uno,
porque hacerlas con N requests no era atómico y dejaba estado parcial
si fallaba a mitad de camino:

- **`PUT /api/agenda/horarios/semana/`** — reemplaza el horario semanal
  completo de un empleado en una transacción. Body: `{miembro, franjas:
  [{dia_semana, hora_inicio, hora_fin}]}`. Semántica de **reemplazo, no
  de agregado**: las franjas enviadas pasan a ser el horario completo y
  lo que no venga en la lista se borra; mandar `franjas: []` deja al
  empleado sin disponibilidad. Valida que `hora_inicio < hora_fin` y que
  dos franjas del mismo día no se crucen; si algo falla responde `400` y
  **no toca el horario existente**. Borrar horarios no afecta a las
  citas ya agendadas (la `Cita` guarda su propia fecha/hora).
- **`POST /api/servicios/lote/`** — crea varios servicios en una
  transacción. Body: `{servicios: [{...}]}` con la misma forma de cada
  servicio que el `POST` de a uno. Si **cualquiera** de los servicios es
  inválido, responde `400` y no crea ninguno.

El CRUD de a uno sigue existiendo y es el camino correcto para editar
un solo elemento. Los endpoints de lote son para el alta inicial
(catálogo de servicios) y la edición de la semana completa.

## 6. Historial de cambios al contrato

> Quien cambie la forma de la API agrega una entrada acá (fecha,
> quién, qué cambió, por qué). No se borran entradas viejas.

- **2026-07-24** — Baseline inicial de Fase 0: `POST
  /api/negocios/registro/` (registro de negocio + dueño + empleados
  opcionales), `POST /api/auth/login/`, `POST /api/auth/refresh/`,
  `GET/POST /api/negocios/empleados/`. Ver `backend/openapi.yaml` para
  el detalle de campos.
- **2026-07-24** — Fase 1 backend: agregado `GET/PATCH
  /api/negocios/empleados/{id}/` (detalle/edición de capacidades y
  `especialidad` de un empleado); nuevo campo `especialidad` en
  `MiembroNegocio` (ver 5.2); nuevo `GET/POST/PATCH/DELETE
  /api/servicios/` (requiere `puede_editar_precios` para
  crear/editar/borrar); nuevo `GET/POST /api/agenda/horarios/`
  (disponibilidad recurrente por empleado) y `GET/POST
  /api/agenda/citas/` + `.../{id}/confirmar|completar|cancelar/`
  (agenda con máquina de estados y asignación "cualquiera disponible",
  ver 5.3). Todos requieren `puede_gestionar_agenda` para
  crear/transicionar citas y horarios; lectura solo requiere
  pertenecer al negocio.
- **2026-07-24** — Nuevo `GET /api/negocios/mi-membresia/` (ver 3.1):
  devuelve la membresía propia del usuario autenticado (capacidades +
  negocio anidado) en un solo request, para que el frontend no tenga
  que resolver "quién soy" buscando por email en la lista de
  empleados. Además, se corrigió un bug en `TieneMembresiaActiva`
  (usado por todos los endpoints de empleados y de Fase 1): un request
  sin autenticar devolvía `500` en vez de `401` porque intentaba leer
  capacidades de un `AnonymousUser`. Cualquier request sin token (o
  con token inválido/expirado) a esos endpoints ahora responde `401`
  de forma consistente, como ya documentaba la sección 4 pero no se
  cumplía en la práctica.
- **2026-07-24** — Corrección de schema (sin cambio de comportamiento):
  `POST /api/negocios/empleados/` documentaba mal su body de entrada
  como `MiembroNegocio` (incluyendo campos de solo lectura, y sin
  `password`). El comportamiento real siempre fue el de
  `EmpleadoAlta`, pero `@extend_schema` estaba puesto sobre el método
  `create()` en vez de sobre `post` — en `generics.ListCreateAPIView`
  (a diferencia de un `ViewSet`), el método que DRF invoca por el
  verbo HTTP es `post` (definido por el propio DRF, que internamente
  llama a `create()`); decorar `create()` no lo intercepta y
  drf-spectacular cae a inferencia automática. Se corrigió con
  `@extend_schema_view(post=extend_schema(...))` a nivel de clase, que
  es el patrón que recomienda drf-spectacular para anotar métodos
  derivados de mixins. Si algún otro endpoint usa
  `generics.*APIView` con un método sobrescrito (`create`, `update`,
  etc.) en vez de un `ViewSet`, revisar que use el mismo patrón.
- **2026-07-24** — Sin cambio de forma, solo documentación de huecos
  reconocidos (ver `plan-accion.md` sección 0.3, corrección de enfoque
  de MVP a proyecto profesional): se documentaron explícitamente en
  3.2 los tres huecos de autenticación que no existen todavía
  (reset de contraseña, rate-limiting en login, verificación de
  email), y en la sección 4 la limitación de que los errores son
  texto humano sin código máquina. Ninguno es un cambio de contrato;
  son límites a tener en cuenta antes de construir UI que asuma lo
  contrario.
- **2026-07-25** — Nuevos endpoints de **escritura en lote** (ver 5.5):
  `PUT /api/agenda/horarios/semana/` (reemplaza el horario semanal
  completo de un empleado en una transacción) y `POST
  /api/servicios/lote/` (crea varios servicios, todos o ninguno).
  Motivo: el frontend estaba resolviendo ambas cosas con N llamadas
  HTTP —un POST/DELETE por franja al editar la semana, y un POST por
  servicio al dar de alta desde el catálogo—, lo que no es atómico: si
  fallaba la mitad, quedaba un empleado con media semana cargada o un
  catálogo a medio crear, sin forma de saber qué reintentar. Ninguno
  reemplaza al CRUD de a uno, que sigue siendo el camino correcto para
  editar un solo elemento. Ambos respetan las capacidades que ya
  aplicaban (`puede_gestionar_agenda` y `puede_editar_precios`
  respectivamente) y el aislamiento por tenant: pasar el `miembro` de
  otro negocio responde `400`, no toca datos ajenos.
- **2026-07-25** — **Cambio con ruptura**: `GET
  /api/negocios/empleados/` y `GET /api/negocios/empleados/{id}/` ahora
  exigen `puede_gestionar_empleados` **también para leer** (antes
  bastaba con pertenecer al negocio). Motivo: ese endpoint devuelve el
  email y la matriz completa de capacidades de cada miembro, así que
  cualquier empleado sin permisos podía consultar los correos y los
  permisos de todo el equipo. En su lugar se agregó `GET
  /api/negocios/equipo/` (ver 5.4), un directorio mínimo —`id`,
  `nombre`, `especialidad`, `activo`— accesible a cualquier miembro,
  que es lo que la agenda realmente necesitaba para filtrar el
  calendario y asignar citas. **Quien consuma `/empleados/` solo para
  obtener nombres debe migrar a `/equipo/`**; el frontend ya lo hizo en
  Agenda y en el editor de horarios. La pantalla de gestión de equipo
  quedó además detrás de un guard de ruta por capacidad, para no
  mostrar una vista que respondería 403.
