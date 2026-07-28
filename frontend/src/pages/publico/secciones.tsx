/** Las piezas del perfil público.
 *
 * Regla que gobierna este archivo: **nada de tokens de Turnio acá**. Ni
 * `bg-white`, ni `text-primary`, ni `border-outline-variant`. Todo sale
 * de los tokens `perfil-*`, que la plantilla del negocio redefine en
 * tiempo de ejecución (`src/tema/plantillas.ts`). Es lo que permite que
 * la misma composición funcione en la plantilla oscura de barbería y en
 * la clara de clínica: si un componente de acá usa un color fijo, en
 * modo oscuro desaparece o deslumbra, y nadie lo nota hasta que un
 * cliente abre el enlace.
 *
 * La composición es una sola y las plantillas cambian su expresión
 * visual — es el enfoque "Themed Core" del `DESIGN.md` de origen. Tres
 * layouts distintos serían tres pantallas que mantener.
 */
import type { NegocioPublico, ServicioPublico } from "../../api/publico";
import type { Plantilla } from "../../tema/plantillas";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { cn } from "../../ui/cn";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const MONEDA = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatearPrecio(precio: string): string {
  const numero = Number(precio);
  return Number.isNaN(numero) ? precio : MONEDA.format(numero);
}

/** Una tarjeta del perfil, con el contorno que pide la plantilla. */
function Tarjeta({
  plantilla,
  className,
  children,
}: {
  plantilla: Plantilla;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-perfil bg-perfil-superficie",
        plantilla.tarjeta,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Título de sección. En barbería sale en serif; en las otras dos, en la
 * misma fuente del resto (`--font-perfil-titulo` lo resuelve). */
function TituloSeccion({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mb-4 font-perfil-titulo text-[22px] font-bold text-perfil-primario md:text-[26px]"
    >
      {children}
    </h2>
  );
}

export function Encabezado({
  negocio,
  plantilla,
  usaPortadaDeMuestra,
  onCompartir,
}: {
  negocio: NegocioPublico;
  plantilla: Plantilla;
  usaPortadaDeMuestra: boolean;
  onCompartir: () => void;
}) {
  const portada = negocio.portada ?? plantilla.portadaMuestra;

  return (
    <header className="relative isolate flex min-h-[46vh] flex-col justify-end overflow-hidden">
      <img
        src={portada}
        alt=""
        // Decorativa: el nombre del negocio está en el `h1` de encima y
        // describir la foto otra vez solo lo repetiría en un lector de
        // pantalla.
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      />
      {/* El degradado es lo que hace legible el texto sobre cualquier
          foto: sin él, un nombre claro sobre una pared blanca
          desaparece. Va de opaco abajo (donde está el texto) a
          transparente arriba, para no tapar la foto entera. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-perfil-fondo via-perfil-fondo/80 to-perfil-fondo/20"
      />

      <div className="absolute right-4 top-4 flex items-center gap-2 safe-top">
        {usaPortadaDeMuestra && (
          // Honestidad con el cliente: esta foto es de la plantilla, no
          // del local. Sin este aviso, quien reserva puede creer que está
          // viendo el sitio al que va a ir.
          <span className="rounded-full bg-perfil-fondo/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-perfil-texto-suave backdrop-blur-xs">
            Foto de muestra
          </span>
        )}
        <button
          type="button"
          onClick={onCompartir}
          aria-label="Compartir enlace del negocio"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-perfil-fondo/70 text-perfil-texto backdrop-blur-xs transition-colors hover:bg-perfil-fondo"
        >
          <Icon name="share" className="text-[20px]" />
        </button>
      </div>

      {/* La misma columna de `max-w-[1200px]` que usa el contenido de
          abajo (`PerfilNegocioPage`): sin esto, el título quedaba pegado
          al borde de la pantalla mientras el resto del perfil se
          centraba en una caja angosta, un salto visual evidente en
          cualquier pantalla más ancha que un teléfono. */}
      <div className="mx-auto w-full max-w-(--width-perfil-contenido) px-margin-mobile pb-6 md:px-margin-desktop">
        {negocio.logo && (
          <img
            src={negocio.logo}
            alt=""
            aria-hidden="true"
            className="mb-4 h-16 w-16 rounded-perfil border border-perfil-borde object-cover"
          />
        )}
        <h1 className="font-perfil-titulo text-[34px] font-bold leading-tight text-perfil-texto md:text-[44px]">
          {negocio.nombre}
        </h1>
        <p className="mt-1.5 flex items-center gap-1.5 font-body-md text-body-md text-perfil-texto-suave">
          <Icon name="location_on" className="text-[18px]" />
          {negocio.ciudad}
          {negocio.direccion ? ` · ${negocio.direccion}` : ""}
        </p>
      </div>
    </header>
  );
}

export function SeccionServicios({
  negocio,
  plantilla,
  onReservar,
}: {
  negocio: NegocioPublico;
  plantilla: Plantilla;
  onReservar: (servicio: ServicioPublico) => void;
}) {
  return (
    <section aria-labelledby="servicios-heading" className="mb-10">
      <TituloSeccion id="servicios-heading">Nuestros servicios</TituloSeccion>
      {negocio.servicios.length === 0 ? (
        <Tarjeta plantilla={plantilla} className="px-6 py-10 text-center">
          <p className="font-body-md text-body-md text-perfil-texto-suave">
            Este negocio todavía no publicó su catálogo.
          </p>
        </Tarjeta>
      ) : (
        <ul className="space-y-3">
          {negocio.servicios.map((servicio) => (
            <li key={servicio.id}>
              <Tarjeta plantilla={plantilla} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md text-perfil-texto">
                      {servicio.nombre}
                    </p>
                    {servicio.descripcion && (
                      <p className="mt-1 font-caption text-caption text-perfil-texto-suave">
                        {servicio.descripcion}
                      </p>
                    )}
                    <p className="mt-1.5 font-caption text-caption text-perfil-texto-suave">
                      {servicio.duracion_minutos} min
                    </p>
                  </div>
                  <span className="shrink-0 font-label-md text-label-md font-bold text-perfil-primario">
                    {formatearPrecio(servicio.precio)}
                  </span>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variante="negocio" tamano="sm" onClick={() => onReservar(servicio)}>
                    Reservar
                  </Button>
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SeccionEquipo({
  negocio,
  plantilla,
}: {
  negocio: NegocioPublico;
  plantilla: Plantilla;
}) {
  if (negocio.profesionales.length === 0) return null;

  return (
    <section aria-labelledby="equipo-heading" className="mb-10">
      <TituloSeccion id="equipo-heading">Quién atiende</TituloSeccion>
      <ul className="grid grid-cols-2 gap-3">
        {negocio.profesionales.map((profesional) => (
          <li key={profesional.id}>
            <Tarjeta plantilla={plantilla} className="flex items-center gap-3 p-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-perfil-superficie-alta font-label-md text-label-md font-bold text-perfil-primario">
                {profesional.nombre.trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-label-md text-label-md text-perfil-texto">
                  {profesional.nombre}
                </p>
                {profesional.especialidad && (
                  <p className="truncate font-caption text-caption uppercase tracking-wider text-perfil-texto-suave">
                    {profesional.especialidad}
                  </p>
                )}
              </div>
            </Tarjeta>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SeccionHorario({
  negocio,
  plantilla,
}: {
  negocio: NegocioPublico;
  plantilla: Plantilla;
}) {
  const horarioPorDia = new Map<number, NegocioPublico["horario"]>();
  for (const franja of negocio.horario) {
    horarioPorDia.set(franja.dia_semana, [...(horarioPorDia.get(franja.dia_semana) ?? []), franja]);
  }

  return (
    <section aria-labelledby="horario-heading" className="mb-10">
      <TituloSeccion id="horario-heading">Horario</TituloSeccion>
      {negocio.horario.length === 0 ? (
        <p className="font-body-md text-body-md text-perfil-texto-suave">
          Aún no publicó su horario.
        </p>
      ) : (
        <Tarjeta plantilla={plantilla} className="divide-y divide-perfil-borde px-4">
          {DIAS.map((nombreDia, indice) => {
            const franjas = horarioPorDia.get(indice);
            return (
              <div
                key={indice}
                className="flex items-center justify-between gap-4 py-2.5 font-body-md text-body-md"
              >
                <span className="text-perfil-texto">{nombreDia}</span>
                <span className="text-perfil-texto-suave">
                  {franjas
                    ? franjas
                        .map((f) => `${f.hora_inicio.slice(0, 5)}–${f.hora_fin.slice(0, 5)}`)
                        .join(", ")
                    : "Cerrado"}
                </span>
              </div>
            );
          })}
        </Tarjeta>
      )}
    </section>
  );
}

export function CarruselFotos({ negocio }: { negocio: NegocioPublico }) {
  if (negocio.fotos.length === 0) return null;

  return (
    <section aria-label={`Fotos de ${negocio.nombre}`} className="mb-10">
      {/* Dos disposiciones para el mismo grupo de fotos, no dos
          componentes: en móvil es una tira con `scroll-snap` nativo
          —sin librería, con inercia y sin bloquear el hilo, mejor de lo
          que lo haría JavaScript—; a partir de `md` se convierte en una
          grilla, porque una tira angosta de tres fotos perdida en medio
          de una pantalla ancha (con la barra de scroll nativa a la
          vista) es exactamente lo que se veía mal en escritorio. `hide-
          scrollbar` es la misma utilidad que ya usa `ToggleGroup`.
          `tabIndex` + `role="group"` es lo que el scroll nativo no trae:
          sin eso, quien navega por teclado no puede enfocar la tira ni
          moverla con las flechas. */}
      <div
        tabIndex={0}
        role="group"
        aria-label="Desliza para ver más fotos"
        className="hide-scrollbar -mx-margin-mobile flex snap-x snap-mandatory gap-3 overflow-x-auto px-margin-mobile pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4"
      >
        {negocio.fotos.map((foto, indice) => (
          <img
            key={foto.id}
            src={foto.imagen}
            alt={`${negocio.nombre}, foto ${indice + 1} de ${negocio.fotos.length}`}
            // `lazy` desde la segunda: la primera es lo que se ve al
            // abrir el enlace y diferirla solo agrega un parpadeo.
            loading={indice === 0 ? "eager" : "lazy"}
            className="h-44 w-60 shrink-0 snap-start rounded-perfil border border-perfil-borde object-cover md:aspect-4/3 md:h-auto md:w-full"
          />
        ))}
      </div>
    </section>
  );
}

export function Contacto({ negocio }: { negocio: NegocioPublico }) {
  if (!negocio.telefono) return null;

  return (
    <a
      href={`tel:${negocio.telefono}`}
      className="mb-10 flex items-center justify-center gap-1.5 font-body-md text-body-md text-perfil-primario hover:underline"
    >
      <Icon name="call" className="text-[18px]" />
      {negocio.telefono}
    </a>
  );
}

/** La firma de Turnio al pie del perfil.
 *
 * Siempre visible: quitarla es la palanca de conversión que Fase 5
 * (planes) va a necesitar, y regalarla ahora sería cobrarla después
 * quitándole algo a quien ya lo tenía. Ver `DECISIONES.md`.
 */
export function FirmaTurnio() {
  return (
    <footer className="border-t border-perfil-borde pt-6 text-center">
      <a
        href="/"
        className="font-caption text-caption text-perfil-texto-suave transition-colors hover:text-perfil-primario"
      >
        Agenda en línea con <strong className="font-semibold">Turnio</strong>
      </a>
    </footer>
  );
}
