# DECISIONES — bitácora de arquitectura

> Decisiones técnicas que se toman **mientras se construye**, con su
> contexto y lo que se descartó. Una por sección, en orden cronológico
> inverso (lo más reciente arriba). **Nunca se borra una entrada**: si una
> decisión se revierte, se agrega otra que lo diga y se enlaza a la vieja.
>
> **Por qué existe este archivo, y qué NO va acá.** Ya había tres lugares
> donde se escribía y ninguno servía para esto:
> - `ROADMAP.md` (y los sub-roadmaps) llevan **estado**: qué se hizo, qué
>   falta, qué está bloqueado. Las decisiones que se colaban ahí quedaban
>   enterradas dentro de la entrada de una sesión, imposibles de encontrar
>   seis semanas después.
> - `CONTRATO.md` lleva **la forma de la API** entre backend y frontend.
>   Una decisión interna (cómo se nombran los archivos en disco, qué
>   librería no se usó) no le concierne al otro lado.
> - `CLAUDE.md` lleva **las reglas** que hay que seguir. Es el resultado
>   de decisiones, no su justificación.
>
> Regla práctica: si dentro de seis meses alguien va a preguntar *"¿por
> qué está hecho así?"*, va acá. Si es *"¿qué falta?"*, va al roadmap. Si
> es *"¿cómo le hablo al backend?"*, va al contrato. Si es *"¿qué debo
> hacer siempre?"*, va al `CLAUDE.md` correspondiente.
>
> Las decisiones **de producto** (alcance de una fase, qué es el MVP)
> siguen viviendo en `ROADMAP.md`, que es donde el humano las revisa.

---

## 2026-07-28 — Imágenes del negocio (Fase 2)

Todas salieron de construir el logo y la galería del negocio: `Negocio.logo`,
el modelo `FotoNegocio`, los endpoints de `mi-negocio`, el `og:image` del
enlace público y la pantalla `/configuracion/negocio`.

### 1. Los archivos se guardan en disco local, no en un bucket

**Contexto.** Hacía falta almacenamiento para logos y fotos, y no existe
pipeline de despliegue en el repo (`docker-compose.yml` solo tiene `db` y
`backend`).

**Decisión.** `MEDIA_ROOT` en disco, servido bajo `/media/` **solo con
`DEBUG=1`**, con `django.views.static.serve` — el mismo patrón que ya se
usaba para `frontend/dist/`.

**Consecuencia, y es una limitación real.** Sirve para desarrollo y para
un despliegue de **un solo servidor**. Con varios contenedores sin volumen
compartido, cada uno vería fotos distintas. Migrar a S3/R2 con
`django-storages` es un cambio de una línea de settings más la
configuración del bucket, y no obliga a tocar modelos ni endpoints — por
eso se pudo posponer sin deuda de diseño.

**Descartado.** Meter `django-storages` + credenciales de S3 ahora:
serviría a una infraestructura que todavía no existe y que va a decidirse
junto con cómo se sirve `frontend/dist/`. Son la misma decisión y se toman
juntas.

### 2. Los nombres de archivo son aleatorios, no el que trae el usuario

**Decisión.** `negocios/<id>/logo/<uuid4>.<ext>` y
`negocios/<id>/fotos/<uuid4>.<ext>`; el nombre original se descarta.

**Por qué.** Dos razones independientes, y cualquiera de las dos alcanza:
1. El nombre viene de internet y `FileField` lo usaría **tal cual** para
   escribir en disco.
2. Un path estable haría que el navegador —o la CDN, o el crawler de
   WhatsApp que ya cacheó el preview— siguiera sirviendo el logo viejo
   después de reemplazarlo.

### 3. Borrar archivos es responsabilidad explícita de la capa de servicios

**Contexto.** Django no borra archivos huérfanos desde 1.3: reemplazar un
logo o borrar una foto deja el archivo anterior en disco para siempre.

**Decisión.** `actualizar_negocio` y `eliminar_foto` (en
`apps/negocios/services.py`) borran el archivo explícitamente. En el
reemplazo, el borrado va **después** del `save()`: si la escritura falla,
el negocio conserva el archivo que ya tenía.

**Descartado.** Señales `post_delete`/`pre_save`: el efecto quedaría
invisible desde el código que lo provoca, y este proyecto ya decidió no
construir un sistema de eventos (ver `backend/CLAUDE.md`).

### 4. `logo` es `blank=True` sin `null=True`, pero la API devuelve `null`

**Decisión.** En el modelo, "sin logo" es la cadena vacía (recomendación
explícita de Django para campos basados en cadenas: admitir además `NULL`
da dos formas de decir lo mismo). Hacia afuera, los serializers declaran
`allow_null` y la respuesta trae `null`.

**Por qué la asimetría.** El frontend necesita distinguir "sin logo" de
forma tipada (`string | null`), y una cadena vacía en un campo `format:
uri` es un valor inválido disfrazado. La traducción vive en un solo lugar
(`MiNegocioSerializer.validate_logo`).

**Trampa asociada:** un `ImageField` de solo lectura sin `allow_null`
explícito genera `type: string` en el schema mientras la API devuelve
`null`. Es el mismo tipo de mentira sintácticamente válida que el bug de
los `SerializerMethodField` sin `@extend_schema_field`, y `--validate`
tampoco la atrapa.

### 5. El `slug` no se puede editar

**Decisión.** `slug` es de solo lectura en `PATCH /api/negocios/mi-negocio/`.

**Por qué.** Es el enlace que el dueño ya pegó en su bio de Instagram y
mandó por WhatsApp — el producto entero de Fase 2. Cambiarlo rompe en
silencio todo lo que él mismo repartió, y además libera el slug viejo para
que lo tome otro negocio.

**Si algún día hace falta**: endpoint aparte, con redirección permanente
del slug anterior y el viejo reservado. No un campo más del formulario.

### 6. Reordenar la galería manda la lista completa, no una foto a la vez

**Decisión.** `PUT .../fotos/orden/` con `{"ids": [...]}` = **todas** las
fotos en orden. Una lista parcial, con repetidos o con una foto ajena
responde `400`.

**Por qué.** El orden es propiedad del **conjunto**, no de cada foto: con
una lista parcial habría que inventar dónde caen las que faltan, y dos
clientes reordenando a medias dejarían un orden que ninguno pidió. Así la
operación es idempotente y "el último request gana, entero". Es el mismo
criterio que `PUT /api/agenda/horarios/semana/` (`CONTRATO.md` 5.6), que
ya se había tomado por razones parecidas.

**En el frontend** eso se traduce en actualización optimista: mover una
foto reordena la lista local y manda la lista entera; si el backend
rechaza, se revierte al estado previo.

### 7. Los límites (10 fotos, 5 MB) se validan en los dos lados

**Decisión del humano.** 10 fotos por negocio, 5 MB por imagen. Viven como
constantes en `apps/negocios/models.py` y **duplicadas** en la pantalla del
frontend.

**Por qué duplicar.** El backend sigue siendo quien decide; el cliente
valida solo para no hacerle subir 8 MB por datos móviles a alguien para
después decirle que no. Es cortesía, no seguridad — están anotadas como
tales en ambos archivos y documentadas en `CONTRATO.md` 5.12.

### 8. Un solo cast para las subidas multipart (`api/multipart.ts`)

**Contexto.** OpenAPI no sabe expresar "acá va un archivo": un
`ImageField` aparece como `type: string, format: uri` (la forma de
**salida**), así que el tipo generado para el body pide un `string` donde
hay que mandar un `File`.

**Decisión.** `cuerpoMultipart<T>(campos)` construye el `FormData` y
concentra el único cast del asunto. El tipo se pasa explícito
(`cuerpoMultipart<FotoNegocio>({...})`) porque en un endpoint con body
obligatorio la inferencia contextual arrastra un `| undefined` y termina
rechazando lo válido.

**Descartado.** Un `as never` suelto en cada pantalla que sube algo —el
patrón que el proyecto ya tolera para los serializers de simplejwt— porque
esto no es un caso puntual: toda subida de archivo futura pasa por acá.

### 9. El carrusel del perfil público es `scroll-snap`, sin librería

**Contexto.** El roadmap traía "Blossom" evaluada como librería de
carrusel compatible con React 19.

**Decisión.** No se agregó ninguna dependencia. Una tira con
`overflow-x-auto` + `snap-x snap-mandatory` resuelve el caso: son diez
fotos como máximo y el gesto de deslizar lo hace el navegador (y el WebView
de Capacitor) con inercia nativa, sin JavaScript en el hilo principal.

**Lo que sí hubo que agregar a mano**, y es la parte que una librería
habría dado gratis: `tabIndex` y `role="group"` con etiqueta, para que
quien navega por teclado pueda enfocar la tira y moverla con las flechas.

**Cuándo reabrirlo:** si hacen falta puntos de paginación, autoplay o
navegación por botones. Hoy ninguno aporta a "ver el local antes de
reservar".

### 10. La navegación distingue entradas principales de secundarias

**Contexto.** `permisos/shell.ts` define la navegación por tipo de
usuario. Administración ya tenía cinco entradas y la barra inferior de
móvil las dibuja todas; "Perfil del negocio" habría sido la sexta.

**Decisión.** `ItemNav` gana `secundaria?: boolean`. Lo secundario aparece
en la barra lateral de desktop y en el **menú de cuenta** en móvil, nunca
en la barra inferior. Hay un test que fija el techo en cinco.

**Por qué.** La barra inferior es un presupuesto cerrado: cada ajuste que
se agrega le roba espacio a la pantalla que la persona usa cada hora. La
alternativa —dejar de agregar pantallas de configuración— no era viable.

**Pendiente relacionado.** "Cargos" es el otro candidato natural a
volverse secundario. No se movió en esta tanda para no cambiarle la
navegación a quien ya la conoce; es una decisión de UX que merece su
propia conversación.

### 11. `og:image` cae en la primera foto si no hay logo

**Decisión.** El preview usa el logo; si no hay, la primera foto de la
galería; si no hay ninguna, se comparte sin imagen. `twitter:card` sube a
`summary_large_image` **solo** cuando hay imagen.

**Por qué el detalle del `twitter:card`.** Con la variante grande y sin
imagen, la tarjeta queda vacía — peor que la miniatura de `summary`.
