# ROADMAP — Landing (Turnio)

> Detalle de trabajo de la landing de marketing. Para el estado conjunto
> del proyecto ver [`../ROADMAP.md`](../ROADMAP.md).
>
> Reglas: leer completo al empezar una sesión acá; al terminar, agregar
> una entrada nueva (nunca borrar las anteriores).

## Qué es esto y por qué está separado del panel

Tercera carpeta del monorepo, hermana de `backend/` y `frontend/`, con
**deploy independiente**. No vive dentro de `frontend/` porque tiene
requisitos opuestos:

| | `frontend/` (panel) | `landing/` |
|---|---|---|
| Audiencia | dueños ya registrados | visitantes que no conocen Turnio |
| SEO | irrelevante, va tras login | es el punto |
| Peso | el que necesite | debe cargar rápido en datos móviles |
| Deploy | app stores + web admin | estático, cambia seguido |

Meter la landing en el bundle Capacitor habría significado enviar
contenido de marketing dentro del APK.

## Primera versión (2026-07-25)

### Stack
- **Astro 7**, sin framework de UI. Ver la entrada "Se quita React por
  completo" más abajo: la primera versión usaba islas de React y se
  descartaron.
- **Tailwind 4** vía `@tailwindcss/vite` (el plugin `@astrojs/tailwind`
  no soporta Astro 7). Config CSS-first en `src/styles/global.css`.
- **Plus Jakarta Sans autoalojada, subset latino**. Se descartó el CDN
  de Google Fonts que pedía el spec: en una landing el LCP manda y una
  request a un tercero antes del primer render se paga cara.

### Sistema de diseño: dos paletas a propósito
Decisión del humano. `global.css` define dos grupos de tokens:

1. **Marketing** (`--color-menta`, `--color-indigo`, …): identidad
   propia de la landing, distinta a la del panel. Es la del spec.
2. **`app-*`**: los valores reales de
   `../frontend/tailwind.config.js`. Se usan **solo dentro de las
   pantallas simuladas**, para que quien mira los mockups reconozca la
   app al registrarse.

⚠️ Los tokens `app-*` están **copiados**, no importados: son dos
proyectos con deploys distintos. Si cambian en el panel, hay que
actualizarlos acá a mano.

### Honestidad sobre lo que existe
Decisión del humano: la landing muestra el producto completo que se
está construyendo, pero **nunca hace pasar por disponible algo que no lo
está**. Lo que hoy lleva badge `<Proximamente />` corresponde a fases sin
empezar del `../ROADMAP.md`:

| Sección | Fase |
|---|---|
| Cobro / caja / comisiones | 3 |
| Reportes | 4 |
| Planes y suscripción | 5 |
| Multisede | 6+ |

Consecuencias concretas:
- El CTA es **captura de correo**, no un checkout ni una prueba de 14
  días: no hay pasarela ni módulo de suscripción con qué cumplirla.
- La tarjeta de cobro y el plan Multisede se muestran atenuados y
  marcados, no ocultos: sirven para medir interés sin mentir.
- En el demostrador de permisos, `puede_cobrar` y `puede_ver_reportes`
  se marcan como próximas — la capacidad ya existe en el modelo, pero su
  módulo no.

**No se escribió la prueba social del spec** ("Más de 100+ barberías
organizadas"): Turnio tiene cero usuarios y eso es una afirmación falsa
dirigida a clientes reales. En su lugar el hero usa diferenciales duros
y verificables: sin cargo por empleado, precios en pesos, construido
con barberos de Bogotá.

### Fidelidad al producto real
Los mockups respetan las reglas verificadas contra el backend:
- La demo del teléfono recorre `agendada → confirmada → completada`, y
  nunca ofrece "Completar" sobre una cita agendada, porque
  `TRANSICIONES_VALIDAS` en `apps/agenda/services.py` lo rechaza.
- El demostrador usa las cinco capacidades reales de `MiembroNegocio`.
- "Cualquiera disponible" aparece como lo que es: asignación que
  resuelve el backend, no algo que el usuario calcule.

Se cambió el botón `[Completar y Cobrar]` del spec por `[Completar]`:
el cobro no existe y la acción real del backend es `completar`.

### Pendientes
1. **El formulario de correo no guarda nada.** `Footer.astro` no tiene
   `action`; hay que conectarlo a un servicio de listas o a un endpoint
   propio **antes de publicar**, o se pierden los correos.
2. **Faltan `/terminos` y `/privacidad`**, enlazadas desde el pie. Son
   obligatorias si se capturan correos (Ley 1581 de 2012, ya anotada
   como tema de Fase 4 en `../CLAUDE.md`).
3. **No hay mano 3D.** El spec pedía "a 3D-rendered hand holding a
   smartphone". Se construyó el teléfono en CSS con la pantalla
   animada —que es donde está el valor— pero la mano requiere un asset
   de diseño (render o foto) que no se puede generar desde código.
4. Sin favicon ni imagen de Open Graph.
5. Sin analítica.

### Peso actual
`dist` = 224 kB. Sobre la red (gzip): HTML 10,4 kB (con el script
inline) + CSS 8,7 kB + 47 kB de fuentes. **Cero archivos JavaScript.**

## Se quita React por completo (2026-07-25)

El humano rehízo el teléfono y el demostrador de permisos en React y
pidió portarlos. Se portaron a Astro con `<script>` inline en vez de
islas, y se desinstaló `@astrojs/react`.

| | Antes | Ahora |
|---|---|---|
| Runtime de React | 58,2 kB gzip | **0** |
| Código propio | 4,1 kB | 1,4 kB inline |
| Archivos `.js` en el deploy | 3 | **0** |

El marcado llega renderizado, así que ambas piezas se ven en el primer
paint en vez de esperar hidratación — que en el héroe de una landing es
justo donde se paga.

Detalle que costó encontrar: al quitar el último `.tsx` el build seguía
emitiendo un `client.js` de 191 kB. El HTML no lo cargaba (no costaba
nada al visitante) pero quedaba de basura en el deploy: lo emitía la
integración `@astrojs/react` por estar declarada, aunque ya nadie la
usara. Se quitó de `astro.config.mjs`.

### Regla adoptada para el estilado dinámico
Todo el cambio de estado se resuelve con variantes
`data-[activo=true]:` y `group-data-[activo=true]:` **escritas en el
marcado**, no construyendo clases en JS. Motivo: Tailwind escanea
archivos como texto plano; una clase que solo existe concatenada en
tiempo de ejecución no se genera y falla en silencio en producción. El
script solo cambia atributos `data-*` y contenido de texto.

Cuando sí hubo clases en strings de JS (`Telefono3D.astro`), se
verificaron una por una contra el CSS compilado.

## Componentes portados desde React (2026-07-25)

### `Telefono3D.astro`
Reemplaza al teléfono pequeño de la primera versión, que el humano
descartó por ilegible. Tamaño real (540×266), inclinación 3D siguiendo
el puntero, flotación, etiquetas despegadas con `translateZ(60px)` y
mano estilizada.

Mejoras sobre el original de React:
- Se pausa fuera de viewport (el original dejaba un `setInterval` vivo).
- Respeta `prefers-reduced-motion`.
- El tilt solo se activa en `pointer: fine`: en táctil no aporta y
  dispara reflows al hacer scroll con el dedo encima.
- **Sin cobro**: el original mostraba "CAJA DE HOY $842.000" y
  "Servicio cobrado · $45.000". Se cambió por pendientes/completadas,
  que son las dos métricas que el dashboard real muestra hoy, y por
  "Servicio completado", que es la acción que el backend acepta.

### `Permisos.astro`
Reemplaza a la `MatrizPermisos` de la primera versión. El humano señaló
que "matriz" suena a documentación técnica y que su versión vendía
mejor: selector de personas con presets, iconos por capacidad, y un
panel oscuro que muestra Habilitado/Bloqueado módulo por módulo.

Cambios respecto al original:
- **Cobro y reportes marcados como próximos.** El original mostraba
  "Cobrar $55.000 (Nequi/Efectivo)" e "Ingresos del día $485.000 · +18%
  vs ayer" como si funcionaran. La *capacidad* existe en
  `MiembroNegocio`; el módulo que habilita no. Los bloques explican qué
  pasará "cuando exista", sin fingir que ya pasa.
- **Sin avatares de stock.** Se usan iniciales en círculo, igual que el
  panel real (`Layout.tsx`).
- Los presets son de una barbería real: dueña con todo, barbero solo con
  lo suyo, recepción agendando y cobrando, estilista senior con precios.

### `Agenda.astro`
Reemplaza a la rejilla de tres tarjetas ("Asignación automática",
"Transiciones sin errores", "Cobro exprés") por el showcase de agenda
multi-columna que hizo el humano: una columna por barbero, filtro por
persona, y botones de acción que aplican la máquina de estados en vivo.
El visitante puede confirmar y completar una cita y ver que al llegar a
`completada` desaparecen los botones.

Correcciones respecto al original:
- **No es balanceo de carga.** El original elegía al barbero con menos
  citas y lo vendía como "balanceo automático de carga". El backend real
  (`services.agendar_cita`) recorre los miembros activos y toma **el
  primero con disponibilidad efectiva** —horario cargado ese día y sin
  cita encimada—, no el menos ocupado. Se corrigió el texto y la
  simulación: la cita se asigna a Carlos porque tiene las 12:00 libres,
  no porque tenga menos trabajo. Es un argumento igual de vendedor y
  tiene la ventaja de ser cierto si alguien lo prueba.
- **`[Cobrar]` → `[Completar]`**, que es la acción que expone el
  backend. El cobro sigue apareciendo solo como próximo, en una franja
  al pie de la sección.
- Sin avatares de stock: iniciales en círculo.

El JS revalida las transiciones antes de aplicarlas aunque el botón ya
esté oculto por CSS, replicando que la regla vive en el servidor y no en
la pantalla.

### Nota de mantenimiento
Se encontró una clase inventada (`hide-scroll`) que no existía en
Tailwind ni en el proyecto: no rompía el build, simplemente no hacía
nada. Se reemplazó por una utilidad real `sin-barra` declarada en
`global.css`. Vale la pena revisar el CSS compilado cuando se agregue
una clase que uno "cree que existe".

### `ComoFunciona.astro` — reescrita
Era la única sección que solo contaba en vez de mostrar: cuatro
tarjetas de texto plano. Ahora es un recorrido: se toca cada paso y el
teléfono de al lado muestra la pantalla real que le corresponde.

Los cuatro pasos existen de verdad en el panel, no son aspiracionales
—por eso esta sección se pudo hacer sin marcar nada como próximo:
1. `RegistroNegocioPage` (formulario de dos pasos, con su barra).
2. `ModalCatalogo` (alta en lote con precios en COP sugeridos).
3. `ModalHorarioSemanal` (plantillas + semana completa).
4. `ModalNuevaCita` (con "cualquiera disponible").

Detalles de comportamiento:
- Avanza sola cada 3,8 s **hasta el primer clic**; a partir de ahí cede
  el control. Una pantalla que se mueve sola mientras la lees es de las
  cosas más molestas que puede hacer una landing.
- Se pausa fuera de viewport y respeta `prefers-reduced-motion`.
- El estado activo se maneja con `aria-current` y variantes
  `aria-[current=true]:` / `group-aria-[current=true]:` — atributo con
  semántica real en vez de una clase inventada, así el lector de
  pantalla también sabe cuál paso está activo. Las 8 reglas se
  verificaron contra el CSS compilado.

El claim de tiempo ("menos de 5 minutos") sale de sumar los estimados
por paso (1 + 1 + 2 min + 30 s) con holgura. Si al validar con negocios
reales resulta optimista, se ajusta acá.
