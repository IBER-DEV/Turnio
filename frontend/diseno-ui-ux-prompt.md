# Prompt de diseño UI/UX — Turnio (app de negocio)

> Este documento existe porque el frontend actual es funcional pero no
> profesional: CSS mínimo, sin sistema de diseño, sin estados de
> carga/vacío/error diseñados, sin confirmaciones para acciones
> destructivas, sin accesibilidad. Ver `plan-accion.md` sección 0.3.
> Este prompt es para generar un diseño real (en Claude, Figma AI, v0,
> Lovable, o la herramienta que se use) antes de reconstruir las
> pantallas del frontend sobre esa base visual.
>
> Cópialo tal cual en la herramienta de diseño. Ajusta la sección
> "Screens a diseñar" si el alcance cambia.

---

## Prompt

Eres un diseñador de producto senior especializado en SaaS operativo
para pequeños negocios (retail de servicios). Diseña el sistema de
UI/UX completo para **Turnio**, una app para dueños y empleados de
barberías, salones de belleza y centros estéticos en Colombia/LatAm.

### Contexto de producto
- Turnio reemplaza el cuaderno físico y el "llamar o escribir por
  WhatsApp para pedir cita". El usuario típico es un dueño de barbería
  con 1 a 5 empleados, que atiende clientes todo el día y solo tiene
  30 segundos entre uno y otro para mirar el celular.
- No hay roles fijos ("Dueño"/"Empleado"/"Recepcionista"). Cada
  persona tiene un conjunto independiente de capacidades booleanas:
  `puede_cobrar`, `puede_ver_reportes`, `puede_editar_precios`,
  `puede_gestionar_empleados`, `puede_gestionar_agenda`. El dueño que
  registra el negocio tiene las 5 en `true`; un empleado normal puede
  tener solo 1 o 2. La UI debe reflejar esto como una matriz de
  permisos independientes, **nunca** como una etiqueta de rol.
- Cada negocio puede tener varios empleados, cada uno con su propio
  calendario de disponibilidad. Al agendar una cita se puede elegir un
  empleado específico o dejar "cualquiera disponible" (el sistema
  asigna automáticamente a quien tenga cupo).
- Una cita tiene 4 estados con transiciones controladas:
  `agendada → confirmada → completada`, con `cancelada` alcanzable
  desde `agendada` o `confirmada` (nunca desde `completada`). No es
  edición libre de un campo "estado": son acciones explícitas
  (confirmar / completar / cancelar) que solo aparecen si son válidas
  desde el estado actual.
- Idioma: español (Colombia/LatAm) en toda la interfaz, sin mezclar
  inglés.

### Plataforma y restricciones técnicas
- Un solo código (React) empaquetado con Capacitor en: app web de
  escritorio/tablet para el mostrador del negocio, y app móvil nativa
  para que el dueño/empleados gestionen su agenda desde el celular.
  Diseña **mobile-first**, y adapta a un layout de escritorio más
  amplio (sidebar en vez de tab bar, tablas en vez de tarjetas) para
  la versión web — no diseñes la versión de escritorio como algo
  aparte, es la misma información con más espacio.
- Zonas seguras de app nativa (notch, home indicator), objetivos
  táctiles de al menos 44×44px, sin hover-only para ninguna acción
  importante.
- Sin identidad de marca todavía: propone una paleta de color y
  tipografía (no necesitas logo elaborado, un wordmark simple basta).
  Tono: profesional y confiable (se maneja dinero e información
  personal de clientes) pero cálido y accesible — no frío estilo
  enterprise SaaS gringo, el usuario final es un barbero/estilista,
  no un analista de datos.

### Screens a diseñar (todas ya existen funcionalmente, sin diseño real)
1. **Login** — email + contraseña. Estado de error claro si las
   credenciales son incorrectas. Link a registro.
2. **Registro de negocio** — formulario en pasos o en una sola
   pantalla larga: datos del negocio (nombre, ciudad, dirección,
   teléfono) + datos del dueño (nombre, email, contraseña). Debe
   sentirse rápido de completar (es la primera impresión del
   producto).
3. **Dashboard / Inicio** — lo primero que ve cualquiera al entrar:
   nombre del negocio, saludo, y accesos directos a lo que sus
   capacidades le permiten hacer hoy (ej. "Ver agenda de hoy",
   "Agregar servicio" — no una lista abstracta de checkmarks de
   capacidades como hoy).
4. **Servicios** — lista de servicios (nombre, categoría, precio,
   duración, comisión, activo/inactivo). Crear/editar en un
   formulario o panel lateral. Acción de activar/desactivar sin
   necesidad de borrar. Diseña el estado vacío ("aún no tienes
   servicios, crea el primero").
5. **Agenda** — la pantalla más importante de la app:
   - Vista de calendario por empleado (día, y idealmente semana) con
     las citas como bloques, coloreadas por estado (agendada /
     confirmada / completada / cancelada — necesitas un sistema de
     color para estos 4 estados que funcione en modo claro y oscuro).
   - Flujo de **crear cita** rápido: elegir servicio, elegir empleado
     específico o "cualquiera disponible" (debe ser una opción
     obviamente distinta a elegir una persona, no un ítem más de la
     lista), fecha/hora, datos del cliente (nombre, teléfono).
   - Acciones de confirmar/completar/cancelar como botones o menú
     contextual sobre cada cita, mostrando solo las transiciones
     válidas desde su estado actual.
   - Gestión de horario semanal por empleado (bloques de
     disponibilidad por día) — pantalla o panel separado, no compite
     visualmente con el calendario de citas.
6. **Empleados** — lista de empleados con su especialidad y sus
   capacidades. Alta de empleado nuevo (nombre, email, contraseña,
   especialidad + matriz de capacidades). Edición de capacidades de
   un empleado existente como toggles individuales, con texto que
   explique brevemente qué habilita cada uno (no solo el nombre
   técnico del campo).

### Estados que TODA pantalla con datos async necesita (hoy no existen)
- **Cargando**: skeleton o spinner, nunca una pantalla en blanco.
- **Vacío**: mensaje + ilustración/icono + acción sugerida, nunca solo
  "no hay datos".
- **Error**: mensaje específico y accionable (reintentar), no un
  texto rojo genérico.
- **Confirmación**: cualquier acción destructiva o irreversible
  (cancelar una cita, eliminar un horario, desactivar un servicio)
  necesita un paso de confirmación explícito.
- **Éxito**: feedback claro tras crear/editar/borrar algo (toast o
  mensaje inline), no solo el cierre silencioso de un formulario.

### Entregables esperados
1. Paleta de color (incluyendo los 4 colores de estado de `Cita` y
   variantes para modo claro/oscuro) y escala tipográfica.
2. Componentes base: botón (primario/secundario/destructivo), input
   de texto con estados de validación, tabla/lista, badge de estado,
   toggle/checkbox, modal de confirmación, toast, skeleton de carga,
   estado vacío.
3. Las 6 pantallas listadas arriba, en versión móvil y de escritorio.
4. Especificación de espaciado/grid para que la implementación en
   React sea consistente (no valores arbitrarios por pantalla).
