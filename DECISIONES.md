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

## 2026-08-05 — Fase 3: Caja, comisiones automáticas y auditoría

Primera entrega real de Fase 3 (Caja/Comisiones), sobre la base
antifraude que ya dejó `RegistroServicio`. Ver `CONTRATO.md` 5.14.

### 30. `apps/caja` es una app nueva, no vive dentro de `apps/servicios`

**Decisión.** Caja es del **negocio** (una por negocio, con sus
movimientos), no del servicio — a diferencia de `RegistroServicio`, que
sí vive en `apps/servicios` porque referencia `Servicio` directamente y
ya tenía ahí `calcular_comision()`. Es además un dominio nombrado
explícitamente desde el arranque del proyecto: `backend/CLAUDE.md` cita
"Caja (abierta → cerrada, Fase 3)" como ejemplo de máquina de estados
desde la primera versión del documento, y `TenantScopedModel` cita a
"Caja" en su propio docstring como modelo futuro. Crear la app no es
abstracción prematura — es un dominio real que ya estaba anticipado.

### 31. El cálculo de comisión se conecta con un import directo, no con la señal `servicio_aprobado`

**Decisión.** `apps.caja.services.registrar_movimiento` importa
`apps.servicios.services.calcular_comision` y la llama directamente al
vincular un movimiento a un `RegistroServicio` aprobado. La señal
`servicio_aprobado` —que llevaba desde la sesión anterior el comentario
"acá es donde Fase 3 va a conectar `calcular_comision()`"— se queda sin
receptor.

**Por qué, si el comentario decía lo contrario.** `backend/CLAUDE.md` es
explícito: las señales son para cuando un mismo hecho de negocio
necesita disparar **varios** efectos desacoplados. Aprobar un registro
sigue teniendo un solo efecto relevante hoy (poder cobrarlo), y ese
efecto no ocurre en el momento de aprobar — ocurre después, cuando
alguien con `puede_cobrar` decide cobrarlo, que es un momento y un actor
distintos. Conectar la señal habría acoplado `apps.servicios` a
`apps.caja` en el sentido equivocado (el módulo más viejo dependiendo
del más nuevo) para un beneficio que el import directo ya da sin esa
inversión. La señal sigue viva, documentada ahora como punto de
extensión para un efecto realmente desacoplado (una notificación al
aprobar, por ejemplo), no para el cálculo de comisión.

### 32. Auditoría con un modelo propio (`RegistroAuditoria`), no `django-simple-history`

**Decisión.** Una fila por acción de negocio (`"caja.abrir"`,
`"caja.movimiento.crear"`, `"caja.cerrar"`) con un `JSONField` de
detalle libre, en vez de instrumentar `Caja`/`MovimientoCaja` con
`HistoricalRecords()`. `backend/CLAUDE.md` sanciona las dos opciones
explícitamente ("usa un modelo de log simple o `django-simple-history`").

**Por qué la opción DIY.** La superficie de mutación de este dominio es
chica y a propósito: tres funciones de servicio, movimientos
inmutables, una sola transición de estado posible en `Caja`. Un
rastreador de historial genérico (que versiona cada `.save()`,
campo por campo) es más maquinaria de la que esta necesidad pide, y una
fila legible como `"caja.cerrar"` con su resumen en el detalle es más
útil para un humano reconstruyendo "qué pasó" que un diff de columnas.

**Trade-off aceptado, no ignorado.** La garantía de auditoría depende
por completo de que toda mutación futura sobre estos modelos pase por
`apps.caja.services`. Con `simple-history`, hasta un `.save()` hecho a
mano desde el admin de Django quedaría registrado; con el log DIY, no.
Documentado en el docstring del modelo para que quien extienda este
dominio lo sepa antes de agregar un endpoint que escriba directo.

### 33. `puede_editar_comisiones`, capacidad nueva y no reuso — cierra el bloqueo #8 del ROADMAP

**Decisión.** `Servicio.porcentaje_comision` pasa a estar gateado por
una capacidad propia, separada de `puede_editar_precios` (que sigue
controlando `precio`, y sigue siendo la única exigida para crear/borrar
un servicio). El gating es **por campo dentro del mismo endpoint**
(`ServicioSerializer.validate()`), no por vista separada: un mismo
`PATCH /api/servicios/{id}/` puede tocar uno de los dos campos, ambos, o
ninguno, y cada uno exige su propia capacidad solo si el valor
**cambia** respecto al actual — mismo criterio que
`CargoSerializer.validate()` ("reenviar lo que ya tenía no es un intento
de cambiarlo").

**Por qué una capacidad nueva y no reusar `puede_ver_reportes` (que
`DECISIONES.md` #28 sí reutilizó en un caso parecido).** Ahí el reuso
tenía sentido porque las dos cosas eran el mismo dominio de confianza
("control administrativo sobre la validación de servicios"). Acá no:
fijar el precio que paga el cliente y fijar cuánto se lleva el empleado
son dominios genuinamente distintos —el segundo es información sensible
entre el negocio y su gente—, el mismo argumento que ya había separado
`puede_editar_negocio` de `puede_gestionar_empleados`. El proyecto llega
a 10 capacidades con esta; sigue por debajo del séptimo caso de
"~8 flags" que `backend/CLAUDE.md` marca como disparador de revisión,
y aun si lo superara, la razón para revisar sería la complejidad del
alta, no el número en sí — acá cada capacidad separa un dominio de
confianza real.

### 34. `MovimientoCaja` es inmutable, y un `RegistroServicio` no se puede cobrar dos veces

**Decisión.** Sin `PUT`/`PATCH`/`DELETE` en la vista (mismo criterio que
`RegistroServicio`: es un libro contable). El vínculo con un
`RegistroServicio` lleva además una `UniqueConstraint` parcial
(`condition=Q(registro_servicio__isnull=False)`) que impide dos
movimientos sobre el mismo registro — la capa de servicios valida antes
para el mensaje de error legible, la constraint es la garantía real
ante una condición de carrera (dos clicks casi simultáneos sobre el
mismo botón "Cobrar"). Mismo patrón de doble capa que
`una_caja_abierta_por_negocio` en `Caja`, y que el manejo de
`IntegrityError` en `abrir_caja` — sin ese `try/except`, la carrera
habría producido un 500 crudo en vez de un 400 de negocio.

### 35. El aviso de "servicios aprobados sin cobrar" no se acota a la ventana de la caja actual

**Decisión revertida sobre la marcha, durante la implementación** (no
llegó a quedar mal en ningún commit anterior: se corrigió antes de que
el plan original —que sí acotaba por fecha— se implementara). El plan
aprobado calculaba `servicios_aprobados_sin_cobrar` filtrando
`RegistroServicio` por `fecha_hora` dentro de la ventana de apertura de
la caja actual. Un test lo destapó: un servicio aprobado *antes* de
abrir la caja del día (perfectamente normal — se hizo ayer, se aprobó
hoy temprano, nadie lo cobró) quedaba **fuera** del rango y no
aparecía en el aviso.

**Por qué importa el error, no solo el fix.** Acotar por la ventana de
la caja significaba que un servicio olvidado dejaba de aparecer en el
aviso apenas pasaba el día en que se hizo — exactamente lo opuesto de lo
que este conteo existe para proteger (plata que se aprobó y nunca se
cobró). La versión corregida cuenta **todos** los `RegistroServicio`
aprobados del negocio sin ningún movimiento vinculado, sin importar
cuándo se hicieron. Queda como recordatorio: un filtro de fecha en una
alerta de "algo pendiente" casi siempre está resolviendo el problema
equivocado — lo pendiente no caduca por el calendario.

### 36. Colisión de nombres de enum al agregar `Caja.estado`/`MovimientoCaja.tipo`

**Decisión.** `SPECTACULAR_SETTINGS["ENUM_NAME_OVERRIDES"]` fija a mano
`TipoEnum` → `Cargo.Tipo` y agrega `CajaEstadoEnum` → `Caja.Estado`.

**Por qué hizo falta.** drf-spectacular nombra los enums por el nombre
del campo cuando es único; con tres campos `estado` (`Cita`,
`RegistroServicio`, ahora `Caja`) y dos `tipo` (`Cargo`, ahora
`MovimientoCaja`), su resolución automática de colisiones le puso un
nombre con hash ilegible (`Estado36eEnum`) al enum **nuevo** de `Caja`,
pero además **le movió el nombre limpio a un enum viejo**: `Cargo.tipo`
pasó de `TipoEnum` a `Tipo14fEnum`. Eso habría sido un cambio con
ruptura silencioso — `frontend/src/permisos/catalogo.ts` referencia
`components["schemas"]["TipoEnum"]` por nombre fijo, y el frontend ni
siquiera se habría enterado hasta que `tsc -b` fallara en un archivo que
nadie tocó esta sesión. Vale como advertencia general: agregar un campo
`TextChoices` con un nombre común (`estado`, `tipo`, `tema`...) puede
renombrarle el tipo generado a un campo que ya existía en otro modelo,
no solo al nuevo — `git diff backend/openapi.yaml` conviene revisarlo
por esto, no solo por lo que se agregó.

---

## 2026-07-28 — Filtros de consulta y registro a nombre de otro en servicios realizados

Segundo pedido del humano sobre el mismo módulo: filtros por período
(día/semana/mes), por barbero y por estado para consultar registros, y
que un administrador pueda registrar un servicio a nombre de un
barbero concreto (obligándolo a elegir cuál). Ver `CONTRATO.md` 5.13.

### 28. `puede_aprobar_servicios` también gobierna "quién elige el empleado al registrar", en vez de una capacidad nueva

**Decisión.** No se creó una capacidad aparte (ej. `puede_registrar_para_otros`)
para decidir quién puede elegir `empleado` al crear un `RegistroServicio`.
Se reutilizó `puede_aprobar_servicios`: quien la tiene, debe elegir
empleado (obligatorio); quien no la tiene, sigue registrando siempre lo
suyo, sin poder elegir.

**Por qué no una capacidad nueva.** `backend/CLAUDE.md` señala
explícitamente "cuando el alta pase de ~8 flags" como disparador para
reconsiderar el modelo de permisos — ya se estaba en 9 capacidades tras
`puede_aprobar_servicios` (ver #25 más abajo). Agregar una décima para
un caso de uso acotado y estrechamente relacionado (ambos son "control
administrativo sobre el dominio de validación de servicios") habría
fragmentado sin necesidad un mismo dominio de confianza. Quien ya es de
confianza para decidir si el trabajo de alguien cuenta, lo es también
para dejar constancia de ese trabajo en su nombre.

**Consecuencia verificada, no solo asumida.** Como la regla de "nadie
revisa lo suyo" (#26) sigue aplicando sobre el `empleado` resultante
—no sobre quien hizo el request—, un administrador que se registra un
servicio a sí mismo usando esta misma capacidad sigue sin poder
aprobárselo. Reutilizar la capacidad no reabrió el hueco que #26 cerró.

### 29. "Mis servicios" en el frontend fuerza `?empleado=<propio id>`, no confía en el default del backend

**Decisión.** `MisServiciosPage` manda siempre `?empleado=<id de quien
mira la pantalla>` al listar, sin importar si tiene
`puede_aprobar_servicios`. `ValidarServiciosPage` es la única pantalla
que se apoya en el comportamiento por defecto del backend (ver todo el
negocio con la capacidad, propios sin ella).

**Por qué, si el backend ya resuelve esto solo.** Sin la capacidad, el
backend acota el listado a lo propio y no habría diferencia. **Con**
ella, el backend devuelve *todo* el negocio por diseño —es lo que
necesita "Validar servicios"—, así que sin este filtro explícito, "Mis
servicios" de un administrador mostraría literalmente lo mismo que
"Validar servicios", duplicando la pantalla y volviendo ambiguo qué es
"mío" para alguien que también valida. El nombre de la pantalla es una
promesa ("esto es lo que yo hice"), y cumplirla no puede depender de
qué capacidades tenga quien la mira.

---

## 2026-07-28 — Registro y validación de servicios realizados

Pedido explícito del humano: un barbero no debe poder "hacerse" comisión
o estadística inventando trabajo que no hizo. Ver `CONTRATO.md` 5.13.

### 25. `RegistroServicio` es independiente de `Cita`, no una extensión de su máquina de estados

**Decisión.** El flujo de aprobación vive en un modelo nuevo
(`RegistroServicio`, en `apps/servicios`), no en estados adicionales de
`Cita` (`agendada → confirmada → completada → cancelada`).

**Por qué no extender `Cita`.** El enunciado pide cubrir también al
cliente que llega sin cita (walk-in) — que en este sistema **nunca pasa
por `Cita`**, porque agendar es un paso previo y opcional, no un
prerrequisito para atender. Encadenar `pendiente_aprobacion` después de
`completada` habría dejado sin cobertura exactamente el caso que más le
importa a un negocio real: la mayoría del trabajo de una barbería no se
agenda con antelación.

**Costo aceptado.** Dos maneras de representar "trabajo hecho" en el
sistema (una `Cita` completada y un `RegistroServicio` aprobado), sin
relación formal entre ellas todavía. Se decidió no forzar un FK opcional
de `RegistroServicio` a `Cita` en esta pasada: no había ningún requisito
de "cerrar la cita cuando se aprueba su registro", y agregar esa relación
sin un caso de uso concreto detrás era la abstracción prematura que
`CLAUDE.md` pide evitar. Si aparece la necesidad de enlazarlos, se agrega
entonces.

**Vive en `apps/servicios`, no en una app nueva.** El modelo referencia
`Servicio` como catálogo, y `apps/servicios/services.py` ya tenía
`calcular_comision()` escrita e inerte "para cuando exista Caja" — este
módulo es ese momento, aunque todavía no invoque esa función. Crear una
app aparte (`apps/validaciones` o similar) habría significado plomería
nueva (INSTALLED_APPS, migraciones, admin, tests) sin ninguna ventaja de
aislamiento real.

### 26. Nadie aprueba su propio registro, ni con la capacidad

**Decisión.** `aprobar_registro`/`rechazar_registro` rechazan la
operación si `revisor == registro.empleado`, sin excepción — a
diferencia de cómo `puede_gestionar_agenda` funciona en `Cita`, donde
tener la capacidad siempre alcanza sin importar de quién es el objeto.

**Por qué la asimetría con `Cita`.** Ahí la capacidad **es**
administrar; acá la capacidad es **dar fe de un hecho ajeno**. Dejar que
alguien con `puede_aprobar_servicios` apruebe lo suyo reduce el control
exactamente al caso que más le preocupa al negocio: un dueño-operador que
también valida no tiene este problema porque no necesita el permiso para
que su propio trabajo cuente (ver `CLAUDE.md`, principio de diseño — el
operador único es el caso n=1, no un modo especial), pero un empleado con
el permiso de validar sí podría, si no se bloqueara, aprobarse a sí
mismo. Mismo principio que ya rige el modelo de cargos (`CONTRATO.md`
5.9): un permiso lo ejerce alguien más, nunca uno mismo sobre lo propio.

### 27. Alcance cortado antes de comisiones reales: una señal sin receptor

**Decisión.** Aprobar un registro dispara `apps.servicios.signals.servicio_aprobado`,
pero no se conecta ningún receptor. El cálculo de comisión en dinero
(`calcular_comision`, ya escrita) sigue sin invocarse desde ningún flujo
automático.

**Por qué no conectarla ya que la señal existe.** `backend/CLAUDE.md`
pide explícitamente no construir un sistema de eventos formal en el MVP
si no hay más de un consumidor real. Hoy no hay ninguno: Caja (Fase 3),
que sería el primer receptor, no existe todavía como módulo (no hay
noción de pago ni de cierre de caja). Conectar un receptor que solo
actualiza un campo "contador" sin ningún consumo real habría sido
trabajo especulativo. La señal en sí (sin receptor) es barata, documenta
el punto de extensión, y evita tener que volver a tocar
`aprobar_registro` cuando Caja sí exista.

---

## 2026-07-28 — Plantillas por rubro (Fase 2)

Del material de diseño en `stitch_booking_page_ui_system/` (tres
plantillas de Stitch con su `DESIGN.md`). Reemplaza el eje de "temas como
composición" que había durado unas horas — ver #16, que queda revertida
en parte.

### 19. Una plantilla = paleta completa, y las tres comparten composición

**Decisión.** `tema` deja de ser un layout (`estandar`/`vitrina`) y pasa a
ser un diseño por rubro: `barberia` (oscura, dorada, radio 6px), `spa`
(clara, salvia, 16px), `clinica` (clara, azul médico, 8px). La
composición del perfil es **una sola**.

**Por qué así y no dos ejes (layout × paleta).** Es el enfoque "Themed
Core" del `DESIGN.md`: mismo núcleo funcional, distinta expresión visual.
Dos ejes daban seis combinaciones que diseñar y probar, y el selector del
panel pasaba a hacer dos preguntas donde el dueño solo quiere elegir "el
que se parece a mi negocio".

**Lo que esto obligó a cambiar, y es la parte cara.** La plantilla de
barbería es **modo oscuro**. Todo componente del perfil que usara un
token fijo de Turnio (`bg-white`, `text-primary`, `border-outline-variant`)
ahí desaparece o deslumbra. Hubo que introducir una capa de tokens
semánticos propios del perfil (`--color-perfil-*`, `--radius-perfil`,
`--font-perfil-titulo`) y reescribir las secciones contra ellos. La regla
queda escrita en `secciones.tsx`: **ningún color de Turnio dentro del
perfil público**.

**Dónde viven.** En `frontend/src/index.css` y no en `design/tokens.css`,
que lo comparte la landing: son tokens que solo tienen sentido dentro del
perfil, y meterlos en el archivo compartido obligaría a la landing a
cargar vocabulario que nunca usa.

**Precio pagado.** `estandar` y `vitrina` desaparecen; la migración mapea
por parecido visual (`vitrina`→`barberia`, `estandar`→`spa`). Sin la
migración de datos, los negocios existentes quedaban con un valor fuera
de `choices` y el frontend caería en la plantilla por defecto sin que
nadie se enterara de que el dato quedó muerto.

### 20. El backend no conoce las paletas (salvo un color)

**Decisión.** El backend guarda **cuál** plantilla eligió el negocio, no
cómo se ve. La única excepción es `Negocio.FONDO_POR_TEMA`, que duplica
el color de fondo de cada plantilla.

**Por qué la excepción.** `theme-color` se emite en el HTML del servidor,
antes de que React monte, y debe coincidir con el fondo real de la
página. En la plantilla oscura, una barra de navegador clara sobre un
perfil negro se ve como un error de carga.

**Riesgo aceptado.** Es una duplicación a mano entre dos lenguajes: hay
un test que fija que estén **todas** las plantillas, pero ninguno puede
verificar que los valores coincidan. Está anotado en los dos archivos.

**Corolario:** `theme-color` dejó de salir de `color_acento` (decisión
#18, corregida). El acento pinta botones; la barra del navegador
acompaña al lienzo.

### 21. Portadas de muestra: sí en la página, no al compartir

**Decisión del humano.** Un negocio sin portada propia se muestra con la
foto de su plantilla, con un aviso visible "Foto de muestra".

**Dónde se puso el límite, y por qué.** Esa foto **no** se usa como
`og:image`. Dentro de la página el aviso deja claro que es de muestra; en
una tarjeta de WhatsApp no hay dónde aclararlo, y quien recibe el enlace
vería la foto de otro local creyendo que es al que va a ir. Compartir sin
imagen es peor estéticamente y más honesto.

**Peso.** Las tres imágenes de origen pesaban 1,7 MB cada una (PNG
1376×768). Convertidas a WebP 1200px quedaron en 42–85 KB. Se sirven
desde `frontend/public/plantillas/`, con una ruta propia en el Django de
desarrollo (`/plantillas/`) y un slug reservado del mismo nombre.

### 22. La serif de barbería se carga solo si se usa

**Decisión.** `@fontsource/libre-caslon-text` con `import()` dinámico
disparado por la plantilla.

**Por qué.** Es lo que le da el aire editorial a la barbería, pero quien
abre el perfil de un spa no tiene por qué descargarla. Autoalojada y no
por CDN, como el resto de las fuentes: esto termina en un bundle de
Capacitor que debe verse igual sin conexión. Si la carga falla, los
titulares caen en la serif del sistema — un perfil no se rompe por una
tipografía.

### 23. Las capturas de referencia no eran la fuente de verdad del color

**Observación, no decisión.** Los PNG de spa y clínica venían
renderizados con el morado `#4f378a` del frontmatter genérico del
`DESIGN.md`, no con el salvia ni el azul que describen su prosa y el
pedido escrito. Se siguió la **especificación escrita** y las capturas se
usaron como referencia de estructura.

Vale como recordatorio: cuando una imagen generada y un texto se
contradicen, el texto es lo que alguien decidió; la imagen es lo que una
herramienta produjo.

## 2026-07-28 — Tematización por negocio (Fase 2)

Salieron de darle a cada negocio un tema, un color de marca y una
portada para su enlace público, tomando como referencia cómo lo resuelve
Goldie.

### 12. No entra ninguna librería de color

**Contexto.** La propuesta de partida incluía `chroma-js` o `culori` para
generar la escala de tonos y calcular contrastes.

**Decisión.** Ninguna de las dos. El trabajo se parte en dos mitades con
respuestas distintas:
- **Derivar tonos** (hover, fondo suave) lo hace el navegador con
  `color-mix(in oklch, …)`, mejor que una interpolación en sRGB y sin
  sumar nada al bundle.
- **Decidir el color del texto encima** sí necesita JavaScript, y son
  veinte líneas: la fórmula de luminancia relativa de la WCAG, congelada
  desde 2008 (`frontend/src/tema/colores.ts`).

**Cuándo reabrirlo.** Si hace falta generar una escala completa 50–900 o
convertir entre espacios de color, ahí una librería sí paga su peso.

**Costo aceptado.** `color-mix()` pide Chrome 111+ / Safari 16.2+. En un
WebView de Capacitor de 2026 es seguro; en un Android muy viejo los tonos
derivados caerían al valor por defecto, no a un color roto.

### 13. `react-colorful` sí entra

**Decisión.** 2 KB para el selector de color libre del panel.

**Por qué esta sí.** Un picker accesible por teclado es trabajo real, y
la alternativa nativa (`<input type="color">`) se comporta distinto entre
el WebView de Android y el de iOS — justo el escenario de esta app.

### 14. Se avisa del mal contraste, no se bloquea

**Decisión.** El color libre acepta cualquier `#rrggbb`; si el contraste
contra blanco no llega a 4.5 (AA para texto) se muestra un aviso con una
vista previa del botón real. Los ocho presets, en cambio, pasan todos AA,
con un test que lo verifica para que nadie agregue un pastel bonito sin
darse cuenta.

**Por qué avisar y no impedir.** Es la marca del negocio y puede tener
razones para ese color exacto. Lo que no puede pasar es que se entere por
un cliente que no pudo leer los precios.

**Hallazgo incómodo que esto destapó.** La menta de Turnio (`#10b981`)
da **2.54** contra blanco: no llega ni al mínimo de interfaz (3). Es
decir, el botón primario del propio producto —`bg-menta text-white` en
todo el panel— está por debajo de WCAG AA. No se tocó acá: cambiarlo es
una decisión de marca que afecta app y landing, y merece su propia
conversación. Queda anotado, y el aviso de contraste es honesto incluso
cuando el que queda mal es uno mismo (hay un test que lo fija).

### 15. El color se aplica en un contenedor, nunca en `:root`

**Decisión.** El perfil público redeclara las cuatro variables de acento
en su `<div>` raíz.

**Por qué.** Es el mismo bundle que sirve el panel del staff: teñir la
raíz dejaría la app entera con el color de la última barbería visitada.

**Trampa que hay que conocer para no "simplificar" esto.** No sirve
declarar en `:root` una variable intermedia (`var(--acento-negocio, …)`)
y definirla más abajo en el árbol: la sustitución de `var()` ocurre en el
elemento donde se declara, y los descendientes heredan el valor **ya
resuelto al fallback**. Está comentado en `design/tokens.css`.

**Consecuencia menos obvia.** La hoja de reserva (Vaul) se monta en un
**portal** colgado del `body`, fuera de ese contenedor: hay que pasarle
las variables explícitamente o sería la única pantalla del flujo con el
color de Turnio.

### 16. Los temas son composiciones, no implementaciones paralelas

**Decisión.** Las secciones del perfil (servicios, equipo, horario,
carrusel) viven sueltas en `secciones.tsx`; cada tema es un archivo que
las **ordena** distinto. El catálogo lo define el backend como enum
cerrado (`Negocio.Tema`), y el frontend degrada a `estandar` ante un
valor que no conozca — el backend puede ir por delante de la app
instalada en un teléfono.

**Por qué.** Es lo que hace que un tema nuevo sea una composición y no
una segunda implementación de la lista de servicios. Sin esta separación,
el tercer tema es donde la idea se vuelve impagable.

**Se entregan dos** (`estandar`, `vitrina`) y no cinco a propósito: cada
tema es una variante real que hay que diseñar, probar y mantener.

**Miniaturas dibujadas con CSS, no capturas de pantalla.** Una imagen del
tema se desactualiza en silencio cada vez que se toca el perfil, y nadie
se entera hasta que un dueño elige algo que no se parece a lo que recibe.

### 17. La marca "Turnio" del pie no es configurable

**Decisión del humano.** El pie del perfil público siempre dice que la
agenda es de Turnio. No hay interruptor, ni campo en el modelo.

**Por qué.** En Goldie quitarla es función de pago. Construir el
interruptor abierto a todos regala hoy la palanca de conversión que Fase
5 (planes) va a necesitar — y peor, cobrarla después significaría
quitarle algo a quien ya lo tenía.

### 18. `theme-color` se reemplaza, no se agrega

**Decisión.** La cáscara HTML **borra** el `theme-color` genérico de
`index.html` antes de inyectar el del negocio.

**Por qué.** Ante dos `theme-color` aplicables, el navegador se queda con
el primero del documento — y el genérico está antes del `<title>`, que es
el punto de inyección. La primera versión solo agregaba la tag: el color
del negocio no se habría visto **nunca**, con los tests en verde. Se
detectó comparando la respuesta real del backend corriendo contra lo que
el test daba por bueno, y quedó fijado con un test que cuenta las
apariciones.

**Regla que sale de ahí:** para meta tags únicas, un test que verifique
presencia no alcanza; hay que verificar **unicidad**.

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

### 24. Verificar visualmente encontró un bug que la revisión de código no había visto

**Contexto.** Al confirmar el arreglo de layout en las tres plantillas
con capturas reales (no solo revisando las clases de Tailwind), el
botón "Reservar" salía siempre verde — nunca dorado en barbería, nunca
azul en clínica.

**Causa.** `Button`'s variante `negocio` (`src/ui/Button.tsx`) seguía
apuntando a `--color-acento`/`--color-sobre-acento`, los tokens de la
tanda de "color único por negocio" (#12) que las plantillas (#19)
reemplazaron por `--color-perfil-primario`/`--color-perfil-sobre-
primario`. Nadie volvió a declarar los tokens viejos en ningún
contenedor, así que el botón caía siempre en el default fijo de
`design/tokens.css` (la menta de Turnio) sin que ningún test lo
atrapara: los tests de `PerfilNegocioPage` verifican las variables CSS
del contenedor, no qué variable usa cada componente hijo.

**Corregido** a los tokens vigentes.

**Por qué esto importa como regla, no solo como bug puntual.** Ninguna
suite de tests unitarios lo iba a atrapar: la aserción hubiera sido
"el contenedor tiene `--color-perfil-primario: #d4af37`", y el botón sí
lo tenía disponible en el árbol — el problema era que **leía otra
variable**, indetectable sin mirar el resultado renderizado. Confirma
la regla del propio `CLAUDE.md`: para cambios de frontend, probar en
un navegador real antes de dar el trabajo por terminado, no solo correr
la suite.
