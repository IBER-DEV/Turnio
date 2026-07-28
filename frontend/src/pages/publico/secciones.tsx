/** Las piezas del perfil público, sueltas de su composición.
 *
 * Existen aparte de `PerfilNegocioPage` desde que hay más de un tema: lo
 * que cambia entre temas es **cómo se ordenan y con qué peso visual**, no
 * qué información hay. Manteniendo las secciones acá, agregar un tema es
 * escribir una composición nueva y no volver a implementar la lista de
 * servicios por segunda vez — que es como los temas se vuelven
 * impagables.
 */
import type { NegocioPublico, ServicioPublico } from "../../api/publico";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Card, EstadoVacio } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";

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

export function DatosDeContacto({ negocio }: { negocio: NegocioPublico }) {
  return (
    <>
      <p className="mt-1.5 flex items-center gap-1.5 font-body-md text-body-md text-on-surface-variant">
        <Icon name="location_on" className="text-[18px]" />
        {negocio.ciudad}
        {negocio.direccion ? ` · ${negocio.direccion}` : ""}
      </p>
      {negocio.telefono && (
        <a
          href={`tel:${negocio.telefono}`}
          className="mt-1 flex items-center gap-1.5 font-body-md text-body-md text-acento hover:underline"
        >
          <Icon name="call" className="text-[18px]" />
          {negocio.telefono}
        </a>
      )}
    </>
  );
}

export function SeccionServicios({
  negocio,
  onReservar,
}: {
  negocio: NegocioPublico;
  onReservar: (servicio: ServicioPublico) => void;
}) {
  return (
    <section aria-labelledby="servicios-heading" className="mb-10">
      <h2 id="servicios-heading" className="mb-4 font-headline-md text-headline-md text-primary">
        Servicios
      </h2>
      {negocio.servicios.length === 0 ? (
        <EstadoVacio
          icono="content_cut"
          titulo="Sin servicios publicados"
          descripcion="Este negocio todavía no agregó su catálogo. Vuelve a intentarlo más tarde."
        />
      ) : (
        <ul className="space-y-3">
          {negocio.servicios.map((servicio) => (
            <li key={servicio.id}>
              <Card className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface">{servicio.nombre}</p>
                  {servicio.descripcion && (
                    <p className="mt-0.5 truncate font-caption text-caption text-on-surface-variant">
                      {servicio.descripcion}
                    </p>
                  )}
                  <p className="mt-1 font-caption text-caption text-on-surface-variant">
                    {formatearPrecio(servicio.precio)} · {servicio.duracion_minutos} min
                  </p>
                </div>
                <Button variante="negocio" tamano="sm" onClick={() => onReservar(servicio)}>
                  Reservar
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SeccionEquipo({ negocio }: { negocio: NegocioPublico }) {
  return (
    <section aria-labelledby="equipo-heading" className="mb-10">
      <h2 id="equipo-heading" className="mb-4 font-headline-md text-headline-md text-primary">
        Quién atiende
      </h2>
      {negocio.profesionales.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Sin profesionales activos por ahora.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-4">
          {negocio.profesionales.map((profesional) => (
            <li key={profesional.id} className="flex items-center gap-2">
              <Avatar nombre={profesional.nombre} tamano="sm" />
              <div>
                <p className="font-label-md text-label-md text-on-surface">{profesional.nombre}</p>
                {profesional.especialidad && (
                  <p className="font-caption text-caption text-on-surface-variant">
                    {profesional.especialidad}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SeccionHorario({ negocio }: { negocio: NegocioPublico }) {
  const horarioPorDia = new Map<number, NegocioPublico["horario"]>();
  for (const franja of negocio.horario) {
    horarioPorDia.set(franja.dia_semana, [...(horarioPorDia.get(franja.dia_semana) ?? []), franja]);
  }

  return (
    <section aria-labelledby="horario-heading">
      <h2 id="horario-heading" className="mb-4 font-headline-md text-headline-md text-primary">
        Horario
      </h2>
      {negocio.horario.length === 0 ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Aún no publicó su horario.
        </p>
      ) : (
        <ul className="space-y-1">
          {DIAS.map((nombreDia, indice) => {
            const franjas = horarioPorDia.get(indice);
            return (
              <li
                key={indice}
                className="flex items-center justify-between gap-4 font-body-md text-body-md"
              >
                <span className="text-on-surface">{nombreDia}</span>
                <span className="text-on-surface-variant">
                  {franjas
                    ? franjas
                        .map((f) => `${f.hora_inicio.slice(0, 5)}–${f.hora_fin.slice(0, 5)}`)
                        .join(", ")
                    : "Cerrado"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function CarruselFotos({ negocio }: { negocio: NegocioPublico }) {
  if (negocio.fotos.length === 0) return null;

  return (
    <section aria-label={`Fotos de ${negocio.nombre}`} className="mb-10">
      {/* Carrusel con `scroll-snap` nativo, sin librería: son diez fotos
          como máximo y el gesto de deslizar ya lo hace el navegador (y el
          WebView de Capacitor) mejor de lo que lo haría JavaScript, con
          inercia y sin bloquear el hilo. Lo que sí hay que agregar a mano
          es lo que el scroll nativo no trae: `tabIndex` y `role="group"`
          para que quien navega por teclado pueda enfocar la tira y
          moverla con las flechas. */}
      <div
        tabIndex={0}
        role="group"
        aria-label="Desliza para ver más fotos"
        className="-mx-margin-mobile flex snap-x snap-mandatory gap-3 overflow-x-auto px-margin-mobile pb-2 md:-mx-margin-desktop md:px-margin-desktop"
      >
        {negocio.fotos.map((foto, indice) => (
          <img
            key={foto.id}
            src={foto.imagen}
            alt={`${negocio.nombre}, foto ${indice + 1} de ${negocio.fotos.length}`}
            // `lazy` desde la segunda: la primera es lo que se ve al
            // abrir el enlace y diferirla solo agrega un parpadeo.
            loading={indice === 0 ? "eager" : "lazy"}
            className="h-48 w-64 shrink-0 snap-start rounded-2xl border border-outline-variant object-cover md:h-56 md:w-80"
          />
        ))}
      </div>
    </section>
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
    <footer className="mt-12 border-t border-outline-variant pt-6 text-center">
      <a
        href="/"
        className="font-caption text-caption text-on-surface-variant transition-colors hover:text-primary"
      >
        Agenda en línea con <strong className="font-semibold">Turnio</strong>
      </a>
    </footer>
  );
}
