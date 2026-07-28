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
  "tipo": "recepcion",
  "cargo": {
    "id": 12,
    "nombre": "Recepción",
    "tipo": "recepcion",
    "miembros": 2,
    "puede_cobrar": true,
    "puede_ver_reportes": false,
    "puede_editar_precios": false,
    "puede_gestionar_empleados": false,
    "puede_gestionar_agenda": true,
    "puede_configurar_horarios": false,
    "puede_ver_agenda_completa": true
  },
  "activo": true
}
```

`tipo` decide **qué shell montar**; `cargo` decide **qué acciones
pintar**. Ver 5.10 — son dos niveles distintos a propósito.

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

No hay roles fijos tipo "Dueño"/"Empleado" definidos en el código. Las
capacidades son booleanos independientes y viven en un **`Cargo` que cada
negocio define** (ver 5.10); `MiembroNegocio` apunta a un cargo y no tiene
permisos propios. La lista vigente **vive en el schema** (`Cargo` en
`openapi.yaml`); a la fecha de este documento son ocho:

- `puede_cobrar` *(declarada, sin efecto hasta Fase 3)*
- `puede_ver_reportes` *(declarada, sin efecto hasta Fase 4)*
- `puede_editar_precios`
- `puede_gestionar_empleados`
- `puede_gestionar_agenda`
- `puede_configurar_horarios`
- `puede_ver_agenda_completa`
- `puede_editar_negocio` *(ver 5.12)*

Esta lista **crecerá**. El frontend no debe hardcodear un switch/enum
cerrado de capacidades sin volver a chequear el schema: debe tratarlas
como un conjunto de flags que se itera, no una lista fija de opciones de
UI.

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

**Transicionar el estado de una cita** (`confirmar`/`completar`/
`cancelar`) lo puede hacer:
- quien tenga `puede_gestionar_agenda`, sobre **cualquier** cita del
  negocio; o
- **cualquier miembro, sobre sus propias citas** (aquellas donde él es
  el `empleado` asignado), sin necesitar esa capacidad.

Lo segundo no se modeló como una capacidad nueva a propósito: marcar
que el propio cliente llegó o que ya se le atendió no es un acto
administrativo que el dueño conceda, es el empleado registrando su
trabajo. `puede_gestionar_agenda` sigue significando "administrar la
agenda **del negocio**" — crear citas, editar horarios y tocar las
citas de otros, todo lo cual sigue exigiéndola.

Para el frontend: los botones de confirmar/completar/cancelar se
muestran si `membresia.puede_gestionar_agenda` **o** si
`cita.empleado === membresia.id`.

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

- **`PUT /api/agenda/horario-negocio/`** — reemplaza el horario de
  atención del negocio. Body: `{franjas: [{dia_semana, hora_inicio,
  hora_fin}]}`; el negocio sale del token, nunca del body. Ver 5.7.
- **`PUT /api/agenda/horarios/semana/`** — reemplaza el horario propio
  de uno o varios empleados en una transacción. Body: `{miembros: [id],
  franjas: [{dia_semana, hora_inicio, hora_fin}]}`. Semántica de
  **reemplazo, no de agregado**: las franjas enviadas pasan a ser el
  horario propio completo de cada empleado señalado y lo que no venga en
  la lista se borra; mandar `franjas: []` le quita el horario propio y lo
  devuelve a heredar el del negocio (ver 5.7). Valida que `hora_inicio <
  hora_fin` y que dos franjas del mismo día no se crucen; si algo falla
  —incluido que **alguno** de los `miembros` sea de otro negocio—
  responde `400` y **no toca el horario de nadie**. Borrar horarios no
  afecta a las citas ya agendadas (la `Cita` guarda su propia
  fecha/hora).
- **`POST /api/servicios/lote/`** — crea varios servicios en una
  transacción. Body: `{servicios: [{...}]}` con la misma forma de cada
  servicio que el `POST` de a uno. Si **cualquiera** de los servicios es
  inválido, responde `400` y no crea ninguno.

El CRUD de a uno sigue existiendo y es el camino correcto para editar
un solo elemento. Los endpoints de lote son para el alta inicial
(catálogo de servicios) y la edición de la semana completa.

### 5.7 Horario del negocio vs. horario propio del empleado

La disponibilidad se resuelve en **dos niveles**, y el frontend tiene
que reflejar esa jerarquía para no confundir al usuario:

1. **`HorarioNegocio`** (`GET/PUT /api/agenda/horario-negocio/`) — las
   horas en que el local atiende. Es la fuente de verdad y el caso
   normal: se carga una vez y **todo el equipo la hereda**. Leer solo
   requiere pertenecer al negocio; escribir requiere
   `puede_gestionar_agenda`.
2. **`HorarioTrabajo`** (`/api/agenda/horarios/`, `PUT
   /api/agenda/horarios/semana/`) — horario **propio** de un empleado.
   Es la excepción: el de medio tiempo, el que solo viene sábados, el de
   turno de tarde.

Reglas de resolución, en orden:

- Si un empleado tiene **al menos una** franja propia en toda la semana,
  ese es su horario completo y el del negocio **no aplica para él en
  ningún día**. No se preguntan día por día: un empleado con horario
  propio solo los sábados no "hereda" el lunes del negocio, porque eso
  sería lo contrario de lo que quiso decir quien lo configuró así.
- El horario propio **reemplaza**, no interseca. Si el local abre 9–18 y
  a un empleado se le puso 8–20, vale 8–20. Se prefirió respetar lo
  configurado explícitamente antes que un recorte silencioso que sería
  imposible de explicar en la UI.
- Un empleado con `activo=False` no está disponible nunca, herede lo que
  herede. **`activo=False` es la palanca para "esta persona no atiende"**
  — no un horario propio vacío, que ahora significa lo contrario
  (heredar).
- Si el negocio no tiene horario cargado y el empleado tampoco, ese
  empleado no tiene disponibilidad y no se le pueden agendar citas.

Implicación para la UI: la pantalla principal de horarios debe ser la
del **negocio**, y el horario por empleado presentarse como una
excepción explícita, no como el camino por defecto. Cargar el horario
empleado por empleado era justamente el problema que este modelo
resuelve.

### 5.8 Las tres capacidades de agenda, y por qué son tres

`puede_gestionar_agenda` decidía cuatro cosas distintas a la vez. Se
partió en tres capacidades porque un dueño quiere concederlas por
separado — el caso que lo motivó: *"quiero que mi recepcionista agende
citas, pero no que cambie el horario del local"*.

| Capacidad | Habilita |
|---|---|
| `puede_gestionar_agenda` | Crear, mover y borrar citas de cualquiera. Transicionar citas ajenas. |
| `puede_configurar_horarios` | `PUT /api/agenda/horario-negocio/` y todo `/api/agenda/horarios/` (horario propio de empleados). |
| `puede_ver_agenda_completa` | Ver en `/api/agenda/citas/` las citas de todo el negocio, no solo las propias. |

Lo que **no** es capacidad y sigue igual: transicionar tus **propias**
citas no requiere ninguna (ver 5.3). Eso es propiedad, no permiso.

Sobre la visibilidad: sin `puede_ver_agenda_completa`, `GET
/api/agenda/citas/` devuelve solo las del propio miembro, y una cita
ajena responde `404` tanto en detalle como en las transiciones —igual que
una inexistente, según 5.2. El motivo es concreto: cada `Cita` incluye
`nombre_cliente` y `telefono_cliente`, así que la agenda completa **es**
la libreta de clientes del negocio.

### 5.9 Límites de `puede_gestionar_empleados`

Esa capacidad permite editar los flags `puede_*` de cualquier miembro, lo
que sin límites la convertía en una escalada de privilegios: bastaba un
`PATCH` sobre la propia membresía para concederse todo lo demás. Dos
reglas la acotan, y ambas responden `400`:

1. **Nadie cambia sus propias capacidades.** Editar el propio
   `especialidad` sí se permite: no es una capacidad. Reenviar una
   capacidad con el valor que ya tenía tampoco rebota — solo cuentan los
   cambios reales.
2. **Nadie concede una capacidad que no tiene.** Aplica tanto al `PATCH`
   de un empleado como al `POST` de alta. Sin esta regla, la primera se
   esquiva en dos pasos con un cómplice.

**Quitar** una capacidad que uno no tiene sí se permite: reducir permisos
ajenos no amplía los propios, y bloquearlo dejaría a un administrador sin
poder frenar a alguien con más capacidades que él.

La única excepción es el registro de un negocio
(`POST /api/negocios/registro/`), donde no hay solicitante todavía: el
dueño se crea en ese mismo request con todas las capacidades y puede dar
de alta empleados con cualquier combinación.

Implicación para la UI: los interruptores de capacidades del propio
usuario deben ir deshabilitados, y también los de las capacidades que
quien mira no posee — si no, el formulario ofrece acciones que el backend
va a rechazar.

### 5.10 Cargos: dónde viven los permisos y qué es el `tipo`

Las capacidades **no viven en la membresía**, viven en un `Cargo` que
cada negocio define. `MiembroNegocio` apunta a uno y de ahí saca todo lo
que puede hacer. No hay excepciones por persona: si alguien necesita algo
distinto, se le crea un cargo.

Cada negocio nace con tres cargos editables —**Administración**,
**Recepción**, **Barbero o estilista**— y el dueño entra en el primero.
Son un punto de partida, no un catálogo: se renombran, se editan, se
crean otros y se borran los que no se usen.

**Consecuencia que la UI debe comunicar**: editar un cargo cambia a
**todos** los que lo ocupan. Por eso `Cargo` expone `miembros` (cuántas
personas lo tienen).

#### El discriminador de dominio

`GET /api/negocios/mi-membresia/` devuelve dos cosas para dos usos
distintos:

| Campo | Para qué | Granularidad |
|---|---|---|
| `tipo` | Qué **shell** montar: navegación, pantalla inicial | Gruesa: `administracion` \| `recepcion` \| `operativo` |
| `cargo` | Qué **acciones** pintar dentro de ese shell | Fina: las 7 capacidades |

`tipo` sale del cargo y el dueño lo elige al crearlo. Existe para que el
frontend no tenga que deducir la forma de la app encadenando
condicionales por capacidad, y para que la decisión sea estable: mover un
permiso no le reordena la app a nadie por sorpresa.

**`tipo` no es una barrera de seguridad y el backend nunca filtra datos
por él.** Cada endpoint sigue exigiendo la capacidad concreta. Si el tipo
fuera la barrera, bastaría pedir otra ruta para saltársela — el frontend
puede confiar en `tipo` para *dibujar*, nunca para *proteger*.

#### Endpoints

- `GET /api/negocios/cargos/` — los cargos del negocio. **Cualquier
  miembro** puede leerlos: la UI necesita mostrar en qué cargo está cada
  quien.
- `POST/PATCH/DELETE /api/negocios/cargos/{id}/` — requiere
  `puede_gestionar_empleados`; definir lo que puede hacer un cargo **es**
  dar permisos. Borrar un cargo que alguien ocupa responde `400`.
- `PATCH /api/negocios/empleados/{id}/` con `cargo` — así se cambia lo
  que alguien puede hacer. Los flags `puede_*` ya **no** se aceptan acá.
- `POST /api/negocios/empleados/` acepta `cargo`; si se omite, la persona
  entra al cargo operativo del negocio.
- `POST /api/negocios/registro/` **no** acepta `cargo` en sus empleados:
  en ese request los cargos aún no existen, así que un id solo podría
  apuntar a otro negocio. Entran al operativo y se les cambia después.

Las reglas anti-escalada de 5.9 siguen valiendo, adaptadas a que ahora
hay dos puertas: no se puede **ampliar el cargo que uno ocupa**, ni
**mudarse a otro cargo** (ni poner a alguien en uno con capacidades que
uno no tiene). Recortar y renombrar sí se permite, también sobre el
propio.

### 5.11 La superficie pública (Fase 2)

Todo lo que cuelga de `/api/publico/` es **sin autenticación**: es la web
que ve un cliente que quiere reservar. Cuatro endpoints:

| Método | Ruta | Cacheable |
|---|---|---|
| GET | `/api/publico/negocios/?q=&ciudad=` | sí |
| GET | `/api/publico/negocios/{slug}/` | sí |
| GET | `/api/publico/negocios/{slug}/disponibilidad/?servicio=&fecha=` | **no** |
| POST | `/api/publico/negocios/{slug}/reservar/` | — |

La columna de caché no es decorativa: el perfil cambia cuando el negocio
edita su catálogo, pero la disponibilidad cambia con **cada reserva**.
Cachear el segundo mostraría huecos que ya no existen.

### Reservar no requiere cuenta

Basta `nombre_cliente` y `telefono_cliente`. Es el reemplazo directo de
"llamar o escribir por WhatsApp", y meter un registro en el medio es
fricción justo donde el producto compite. Encaja con el modelo: `Cita` ya
guarda esos dos campos inline y `Cliente` es de Fase 4.

**Consecuencia**: el cliente no puede consultar ni cancelar su cita
después. Cuando haga falta, será con un token de acceso en el enlace de
confirmación, no con una cuenta — pero hoy no existe.

`empleado` es opcional al reservar: si se omite, se asigna quien esté
libre. La respuesta dice con quién quedó.

### Qué NO devuelven estos endpoints

Los serializers públicos están escritos a mano, campo por campo, y **no
reutilizan los internos** aunque el modelo sea el mismo. Concretamente:

- Los servicios van sin `porcentaje_comision` (acuerdo interno).
- Los profesionales van con `id`, `nombre` y `especialidad`, nada más —
  sin email, sin cargo, sin capacidades.
- **Nunca se devuelven citas.** La disponibilidad las usa para descartar
  huecos ocupados y jamás las expone: quien consulta un local no puede
  deducir quién tiene cita ni a qué hora.
- Un negocio con `activo=False` responde `404` en todo, no solo
  desaparece del listado.
- Reservar un hueco ya tomado responde `400` con un mensaje **genérico**.
  No distingue "se acaba de ocupar" de "nunca estuvo disponible": la
  diferencia convertiría el endpoint en un oráculo de la agenda.

### Límites de uso

Es la única superficie sin sesión, así que el límite es por IP
(`ScopedRateThrottle`):

- **`publico_lectura`: 120/min** — navegar es barato y un cliente
  indeciso mira varios días seguidos.
- **`publico_reserva`: 10/hora** — escribir es caro y humanamente lento.
  Corta el llenado automático de una agenda sin estorbarle a nadie real.

Pasado el límite se responde `429`. El staff autenticado no pasa por
estos límites: se aplican por vista, no globalmente.

### El slug vive en la raíz del dominio

El perfil público será `turnio.app/{slug}`, así que el slug comparte
espacio de nombres con las rutas de la app. `apps.negocios.models.SLUGS_RESERVADOS`
impide que un negocio se quede con `login`, `agenda`, `api`, etc.
**Si el frontend agrega una ruta nueva en la raíz, hay que reservarla
ahí** o un negocio podrá tomarla.

### 5.12 La ficha del negocio y sus imágenes (Fase 2)

Editar cómo se ve el negocio hacia afuera es su propia capacidad,
**`puede_editar_negocio`**, y no un uso más de
`puede_gestionar_empleados`: quien administra el equipo no es
necesariamente quien decide el nombre y el logo del local.

| Método | Ruta | Capacidad |
|---|---|---|
| GET | `/api/negocios/mi-negocio/` | pertenecer al negocio |
| PATCH | `/api/negocios/mi-negocio/` | `puede_editar_negocio` |
| GET | `/api/negocios/mi-negocio/fotos/` | pertenecer al negocio |
| POST | `/api/negocios/mi-negocio/fotos/` | `puede_editar_negocio` |
| DELETE | `/api/negocios/mi-negocio/fotos/{id}/` | `puede_editar_negocio` |
| PUT | `/api/negocios/mi-negocio/fotos/orden/` | `puede_editar_negocio` |

Reglas que el schema no captura:

- **Solo PATCH, no PUT**, en la ficha del negocio: el formulario es
  parcial por naturaleza (subir un logo no debería obligar a reenviar la
  dirección).
- **`slug` es de solo lectura.** Es el enlace que el dueño ya repartió
  por WhatsApp y pegó en su bio de Instagram; cambiarlo rompería en
  silencio todo lo compartido y liberaría el slug viejo para otro
  negocio. Si alguna vez hace falta, será un endpoint aparte con
  redirección, no un campo más de este formulario.
- **Subir imágenes es `multipart/form-data`** (`logo` en el PATCH,
  `imagen` en el POST de fotos). El resto de campos acepta JSON normal.
- **Quitar el logo**: mandar `logo` vacío (`null` en JSON, campo vacío en
  multipart). La respuesta vuelve con `logo: null`.
- **Límites** (decisión del humano, 2026-07-28): **10 fotos por negocio**
  y **5 MB por imagen**, logo incluido. Pasarse responde `400`. Viven en
  `apps.negocios.models` (`MAX_FOTOS_POR_NEGOCIO`,
  `PESO_MAXIMO_IMAGEN_BYTES`); si cambian, se anota acá.
- **Reordenar la galería es en lote y con la lista completa**: el body es
  `{"ids": [...]}` con **todas** las fotos del negocio en el orden
  deseado. Una lista parcial, con repetidos, o que incluya una foto de
  otro negocio responde `400` — el orden es una propiedad del conjunto,
  no de cada foto por separado. Mismo criterio que
  `PUT /api/agenda/horarios/semana/` (5.6).
- **Subir una foto la agrega al final.** Ser la primera del carrusel es
  un gesto explícito de reordenamiento, no una consecuencia de subirla.

**En la superficie pública** (5.11), `GET /api/publico/negocios/{slug}/`
gana dos campos: `logo` (string o `null`) y `fotos` (array, ya ordenado
por `orden`). Ambos traen **URLs absolutas**, no `/media/...`: el mismo
JSON lo consume la app móvil, que no comparte origen con la API.

`GET /{slug}/` (la cáscara HTML con meta tags) ahora emite `og:image` con
el logo, o con la primera foto de la galería si no hay logo. Un negocio
sin ninguna de las dos se comparte sin imagen, como antes.

**Almacenamiento**: los archivos van a `MEDIA_ROOT` en disco local y se
sirven bajo `/media/` **solo con `DEBUG=1`**. Fuera de desarrollo eso lo
sirve nginx o un bucket — la misma decisión de infraestructura pendiente
que `frontend/dist/` (ver `backend/ROADMAP-BACKEND.md`).

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
- **2026-07-25** — Las transiciones de estado de una cita
  (`POST /api/agenda/citas/{id}/confirmar|completar|cancelar/`) ahora
  las puede ejecutar **cualquier miembro sobre sus propias citas**, sin
  `puede_gestionar_agenda` (ver 5.3). Antes exigían esa capacidad
  siempre, lo que dejaba a un barbero viendo sus citas del día sin
  poder marcar que el cliente llegó — un hueco del modelo, no una
  restricción buscada. Es una **ampliación**, no una ruptura: quien
  antes podía, sigue pudiendo. Crear citas y editar horarios siguen
  exigiendo `puede_gestionar_agenda`, y tocar la cita de otro empleado
  sigue respondiendo `403`.
- **2026-07-26** — **Cambio con ruptura**: el horario pasa a ser del
  **negocio**, con el horario por empleado como excepción (ver 5.7).
  Motivo: cargar la disponibilidad empleado por empleado duplicaba el
  mismo dato N veces aunque el equipo entero trabajara igual —que es el
  caso normal en una barbería—, obligaba a re-aplicarlo a mano al cambiar
  el horario del local, y dejaba a cada empleado nuevo sin poder recibir
  citas hasta que alguien se acordara de configurárselo. Además cierra el
  hueco anotado en `backend/ROADMAP-BACKEND.md` de que no existía un
  concepto de "horario del negocio" contra el cual validar.
  1. **Nuevo `GET/PUT /api/agenda/horario-negocio/`** — horario de
     atención del local. Lo lee cualquier miembro; escribirlo requiere
     `puede_gestionar_agenda`.
  2. **`PUT /api/agenda/horarios/semana/` ahora recibe `miembros: [id]`
     (lista) en vez de `miembro: id`** — el mismo turno suele compartirse
     entre los de medio tiempo, y un solo empleado es el caso
     `miembros: [id]`. **Quien envíe `miembro` singular recibe `400`.**
  3. **`franjas: []` en ese endpoint cambió de significado**: antes dejaba
     al empleado sin disponibilidad, ahora le quita el horario propio y lo
     devuelve a heredar el del negocio. Para que alguien no atienda, la
     palanca es `activo=False` en su membresía.
  4. **`empleado_disponible` ahora respeta `activo`**: un miembro inactivo
     no recibe citas aunque se lo pida explícitamente por `empleado`.
     Antes quedaba fuera solo por no tener franjas propias; con herencia
     tomaría las del local si no se chequeara.

  Implicación de UI en 5.7: la pantalla de horarios debe girar en torno al
  horario del negocio, con el del empleado como excepción explícita.
- **2026-07-26** — **Cambio con ruptura**: dos capacidades nuevas
  (`puede_configurar_horarios`, `puede_ver_agenda_completa`) y dos reglas
  que acotan `puede_gestionar_empleados`. Ver 5.8 y 5.9. Salió de una
  auditoría del modelo de permisos pedida tras el caso "quiero que mi
  recepcionista agende citas pero no cambie el horario del local".
  1. **`PUT /api/agenda/horario-negocio/` y todo `/api/agenda/horarios/`
     pasan a exigir `puede_configurar_horarios`** en vez de
     `puede_gestionar_agenda`. Quien tenía la vieja conserva ambas (ver
     migración abajo), así que nadie pierde acceso al actualizar.
  2. **`GET /api/agenda/citas/` ahora filtra por
     `puede_ver_agenda_completa`.** Sin esa capacidad se devuelven solo
     las citas propias. **Es un cambio de comportamiento real, no solo de
     permisos**: antes cualquier miembro del negocio podía leer el
     `nombre_cliente` y `telefono_cliente` de todas las citas. Una cita
     ajena pasa a responder `404` en detalle y transiciones, donde antes
     el detalle respondía `200` y la transición `403`.
  3. **`puede_gestionar_empleados` deja de ser escalada de privilegios**
     (ver 5.9). Era explotable: un `PATCH` sobre la propia membresía
     bastaba para concederse las demás capacidades. Hay tests que fallan
     contra el código anterior.
  4. **`MiMembresia`, `MiembroNegocio` y `EmpleadoAlta` ganan los dos
     campos nuevos.** El frontend debe regenerar tipos.

  Migración de datos: `puede_configurar_horarios` y
  `puede_ver_agenda_completa` se ponen en `true` para quien ya tenía
  `puede_gestionar_agenda`. Para el resto quedan en `false`, que es
  justamente el cambio buscado — un empleado raso deja de ver la agenda
  del negocio entero.
- **2026-07-26** — **Cambio con ruptura grande**: las capacidades se
  mudan de `MiembroNegocio` a un modelo `Cargo` que cada negocio define,
  y `mi-membresia` gana un discriminador de dominio. Ver 5.10. Decisión
  del humano: quiere que el dueño escoja un cargo en vez de siete
  interruptores, que pueda editar esos cargos él mismo, y que el
  frontend sepa **qué pantalla cargar** sin encadenar condicionales por
  capacidad (arquitectura PBAC + UI state-driven).
  1. **`MiembroNegocio` pierde los siete flags `puede_*`.** Ahora tiene
     `cargo`. Quien leía `membresia.puede_x` debe leer el cargo.
  2. **`GET /api/negocios/mi-membresia/` cambia de forma**: en lugar de
     los flags sueltos devuelve `tipo` (el discriminador) y `cargo`
     anidado con las capacidades.
  3. **`MiembroNegocio` en la API** expone `cargo` (id, editable) y
     `cargo_detalle` (anidado, solo lectura) en vez de los flags.
     `PATCH /api/negocios/empleados/{id}/` ya no acepta `puede_*`.
  4. **`EmpleadoAlta` cambia**: acepta `cargo` en vez de los siete flags.
     El alta dentro de `POST /api/negocios/registro/` usa un serializer
     aparte (`EmpleadoAltaRegistro`) **sin** `cargo`, porque en ese
     request los cargos del negocio todavía no existen y aceptar un id
     permitiría colar el de otro negocio.
  5. **Nuevo CRUD `GET/POST/PATCH/DELETE /api/negocios/cargos/`.**
  6. **Registrar un negocio ahora crea tres cargos** y mete al dueño en
     Administración.

  Migración de datos: cada negocio recibe un cargo por cada combinación
  distinta de capacidades que tuviera su gente, y todos quedan asignados.
  Las combinaciones reconocibles se bautizan (Administración, Recepción,
  Barbero o estilista); las arbitrarias quedan como "Cargo 1", "Cargo 2"
  para que el dueño las renombre. **Nadie gana ni pierde permisos.**
- **2026-07-28** — **Fase 2, superficie pública** (ver 5.11). Cuatro
  endpoints nuevos bajo `/api/publico/`, todos sin autenticación:
  búsqueda de negocios, perfil público, disponibilidad y reserva. Es el
  reemplazo de "llamar o escribir por WhatsApp", que es el problema que
  el producto resuelve.
  1. **Reservar no requiere cuenta**: nombre y teléfono. El cliente no
     puede consultar ni cancelar su cita después; cuando haga falta será
     con un token en el enlace, no con una cuenta.
  2. **Serializers públicos propios**, escritos campo por campo. No
     reutilizan los internos: los servicios van sin
     `porcentaje_comision` y los profesionales sin email ni cargo.
  3. **Throttling por IP**: 120/min de lectura, 10/hora de reserva.
     Pasado el límite, `429`. Es el primer rate limiting del proyecto —
     el hueco de login que documenta 3.2 sigue abierto.
  4. **`SLUGS_RESERVADOS`** en `apps.negocios.models`: como el perfil
     público vivirá en `turnio.app/{slug}`, un negocio ya no puede
     quedarse con `login`, `agenda`, `api` ni las demás rutas de la app.
     **Ampliación de contrato**: quien agregue una ruta nueva en la raíz
     del frontend tiene que reservarla ahí.

  Sin cambios en los endpoints autenticados que ya existían.
- **2026-07-28** — **Corrección de forma en `NegocioPublico`** (ver 5.11).
  `servicios`, `profesionales` y `horario` estaban declarados
  `type: string` en el schema cuando siempre devolvieron listas de
  objetos. Ahora son `array` con `$ref` a `ServicioPublico`,
  `ProfesionalPublico` y `HorarioNegocioPublico`, que aparecen como
  componentes propios.

  **La respuesta de la API no cambió**: el bug era del schema, no del
  endpoint. Causa: los tres son `SerializerMethodField` y sin
  `@extend_schema_field` drf-spectacular no puede inferir qué devuelven,
  así que cae a `string`. Es el mismo tipo de fallo que el
  `@extend_schema` puesto sobre `create()` en vez de `post` (entrada del
  2026-07-24): el schema queda sintácticamente válido y semánticamente
  falso, así que no lo atrapa `--validate` ni el CI.

  Lo encontró el frontend al intentar tipar el perfil público, que es la
  pantalla central de Fase 2 — con `servicios: string` no se podía
  escribir. Regla práctica que queda: **un `SerializerMethodField` sin
  `@extend_schema_field` es un campo mal documentado**, aunque el código
  funcione.
- **2026-07-28** — **Octava capacidad: `puede_editar_negocio`** (ver 5.10).
  `Cargo` gana un campo booleano más, agregado a `CAPACIDADES` en
  `apps.usuarios.models`. Controla editar la identidad pública del
  negocio (nombre, dirección, teléfono, logo, fotos) — separada a
  propósito de `puede_gestionar_empleados`, porque quien administra el
  equipo no necesariamente decide cómo se ve el negocio hacia afuera.

  **`openapi.yaml` regenerado y refleja la capacidad real** (aparece en
  `Cargo` y `PatchedCargo`). **`frontend/src/api/schema.ts` NO se
  regeneró todavía, a propósito**: `catalogo.ts` deriva `Capacidad` del
  schema y tiene un `Record<Capacidad, …>` que deja de compilar si
  aparece una capacidad sin traducir — es el comportamiento buscado,
  pero implica que regenerar el schema del frontend sin traducirla
  rompe el build a propósito. Sesión cortada antes de llegar a esa
  traducción; detalle completo del plan pendiente en
  `backend/ROADMAP-BACKEND.md` y `frontend/ROADMAP-FRONTEND.md`.

  **Consecuencia para quien retome esto**: el CI de frontend verifica
  que `schema.ts` esté regenerado contra `openapi.yaml` — con el
  schema.ts actual (sin la capacidad), esa verificación **fallará** en
  cuanto se ejecute contra este branch, porque ahora mismo hay drift
  real entre los dos. No es un bug: es la señal de que la migración ya
  se aplicó pero la traducción del lado frontend sigue sin hacerse. La
  rama no se mergea hasta cerrar ese ciclo completo (regenerar
  `schema.ts` + `DEFINICIONES`/`GRUPOS` en `catalogo.ts` a la vez, en
  el mismo commit).
- **2026-07-28** — **Ficha del negocio, logo y galería de fotos**
  (ver 5.12). Cierra lo que la entrada anterior dejó a medias: ahora
  existe la forma que `puede_editar_negocio` protege.

  **Endpoints nuevos** (todos bajo `/api/negocios/mi-negocio/`):
  `GET`/`PATCH` de la ficha, `GET`/`POST` de fotos, `DELETE` de una foto
  y `PUT .../fotos/orden/` para reordenar en lote.

  **Campos nuevos en respuestas que ya existían** — aditivos, ninguno
  rompe:
  - `Negocio` (anidado en el registro y en `mi-membresia`) gana `logo`
    (`string | null`, URL absoluta).
  - `NegocioPublico` (`GET /api/publico/negocios/{slug}/`) gana `logo` y
    `fotos` (array de `FotoPublica`, ya ordenado).
  - `GET /{slug}/` emite `og:image` cuando hay logo o al menos una foto,
    y sube el `twitter:card` a `summary_large_image` solo en ese caso.

  Por qué existe: el enlace público —el reemplazo de "escríbeme por
  WhatsApp", que es el corazón de Fase 2— se compartía sin imagen, igual
  para los 200 negocios de la plataforma, porque el modelo no tenía
  ningún campo de imagen. Ese era el objetivo final; la ficha editable
  salió en el camino, porque tampoco existía **ningún** endpoint para
  editar el negocio (ni el nombre, ni la dirección).

  Decisiones que el schema no dice: `slug` de solo lectura, límites de
  10 fotos / 5 MB, reordenamiento con la lista completa, y `MEDIA_ROOT`
  local servido solo en `DEBUG`. Todas explicadas en 5.12.

  **El drift con `frontend/src/api/schema.ts` sigue abierto y creció**:
  además de la capacidad, ahora faltan los endpoints y campos de arriba.
  Se cierra igual que antes — regenerar `schema.ts` y traducir
  `puede_editar_negocio` en `catalogo.ts` **en el mismo commit**.
