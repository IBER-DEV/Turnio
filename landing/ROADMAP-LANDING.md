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
- **Astro 7** + islas de React. Astro envía cero JS por defecto; solo se
  hidrata lo interactivo.
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
- En la matriz de permisos, `puede_cobrar` y `puede_ver_reportes` se
  marcan como próximas — la capacidad ya existe en el modelo, pero su
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
- La matriz usa las cinco capacidades reales de `MiembroNegocio`, con
  sus nombres de campo visibles.
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
4. **React pesa 55,9 kB gzip** para dos islas que suman 4 kB. Ver
   sección siguiente.
5. Sin favicon ni imagen de Open Graph.
6. Sin analítica.

### Peso actual
`dist` = 408 kB. Sobre la red (gzip): HTML 9,0 kB + CSS 7,1 kB + JS
63 kB. De ese JS, **55,9 kB son el runtime de React** y solo 4 kB son
código propio (`TelefonoDemo` 2,0 + `MatrizPermisos` 2,0).

Las dos islas son triviales —un bucle de estados con
`IntersectionObserver` y cinco booleanos que muestran/ocultan
bloques—: reescribirlas en JS sin framework dejaría el JS en ~4 kB.
Queda como decisión pendiente del humano.
