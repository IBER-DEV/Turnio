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

### 5.4 Aislamiento por tenant

Todo endpoint de negocio filtra automáticamente por el tenant del
usuario autenticado. Un usuario nunca puede ver ni deducir la
existencia de datos de otro negocio: un recurso ajeno responde `404`,
igual que uno inexistente.

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
