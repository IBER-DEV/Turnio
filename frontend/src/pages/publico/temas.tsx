/** Los temas del perfil público: cada uno es una **composición** de las
 * mismas secciones (`secciones.tsx`), no una implementación aparte.
 *
 * El catálogo es cerrado y lo define el backend (`Negocio.Tema`). Si
 * llega uno que esta versión de la app no conoce —backend adelantado a
 * una app vieja en el teléfono de alguien— se cae en `estandar` en vez de
 * romperse: ver `composicionDe`.
 */
import type { NegocioPublico, ServicioPublico } from "../../api/publico";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import {
  CarruselFotos,
  DatosDeContacto,
  SeccionEquipo,
  SeccionHorario,
  SeccionServicios,
} from "./secciones";

export type Tema = NegocioPublico["tema"];

interface PropsTema {
  negocio: NegocioPublico;
  onReservar: (servicio: ServicioPublico) => void;
  onCompartir: () => void;
}

/** Tema Estándar: la ficha de siempre. Encabezado compacto, servicios
 * arriba de todo. Es el que mejor funciona cuando el negocio todavía no
 * subió imágenes — que es como llega todo el mundo el primer día. */
function TemaEstandar({ negocio, onReservar, onCompartir }: PropsTema) {
  return (
    <div className="mx-auto max-w-2xl px-margin-mobile pb-16 pt-8 md:px-margin-desktop">
      <header className="mb-10 flex items-start gap-4">
        {/* `Avatar` cae solo en las iniciales si no hay logo (o si la
            imagen no carga), así que no hace falta un condicional acá. */}
        <Avatar
          nombre={negocio.nombre}
          imagen={negocio.logo ?? undefined}
          tamano="lg"
          forma="cuadrado"
        />
        <div className="min-w-0 flex-1">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary md:font-headline-lg md:text-headline-lg">
            {negocio.nombre}
          </h1>
          <DatosDeContacto negocio={negocio} />
        </div>
        <Button
          variante="ghost"
          tamano="sm"
          icono="share"
          onClick={onCompartir}
          aria-label="Compartir enlace del negocio"
        />
      </header>

      <CarruselFotos negocio={negocio} />
      <SeccionServicios negocio={negocio} onReservar={onReservar} />
      <SeccionEquipo negocio={negocio} />
      <SeccionHorario negocio={negocio} />
    </div>
  );
}

/** Tema Vitrina: la portada ocupa la primera pantalla, con el nombre y el
 * llamado a reservar encima. Pensado para el negocio que ya tiene fotos
 * buenas y quiere que sean lo primero.
 *
 * Sin portada cargada se degrada a un encabezado teñido con el color del
 * negocio: elegir este tema y no subir imagen no debe dejar un hueco
 * negro donde va la foto. */
function TemaVitrina({ negocio, onReservar, onCompartir }: PropsTema) {
  const primerServicio = negocio.servicios[0];

  return (
    <div className="pb-16">
      <div className="relative isolate flex min-h-[62vh] flex-col items-center justify-center overflow-hidden px-margin-mobile text-center">
        {negocio.portada ? (
          <>
            <img
              src={negocio.portada}
              alt=""
              // Decorativa: el nombre del negocio ya está en el `h1` de
              // encima, así que describirla otra vez solo repetiría lo
              // mismo en un lector de pantalla.
              aria-hidden="true"
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
            {/* El velo es lo que hace legible el texto encima de
                cualquier foto: sin él, un nombre claro sobre una pared
                blanca desaparece. */}
            <div className="absolute inset-0 -z-10 bg-pizarra/55" aria-hidden="true" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-acento" aria-hidden="true" />
        )}

        <Button
          variante="ghost"
          tamano="sm"
          icono="share"
          onClick={onCompartir}
          aria-label="Compartir enlace del negocio"
          className="absolute right-4 top-4 text-white hover:bg-white/15 hover:text-white"
        />

        {negocio.logo && (
          <img
            src={negocio.logo}
            alt=""
            aria-hidden="true"
            className="mb-5 h-20 w-20 rounded-2xl border border-white/25 object-cover"
          />
        )}
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-white md:font-headline-lg md:text-headline-lg">
          {negocio.nombre}
        </h1>
        <p className="mt-2 flex items-center gap-1.5 font-body-md text-body-md text-white/80">
          <Icon name="location_on" className="text-[18px]" />
          {negocio.ciudad}
          {negocio.direccion ? ` · ${negocio.direccion}` : ""}
        </p>
        {primerServicio && (
          <Button
            variante="negocio"
            tamano="lg"
            className="mt-8"
            onClick={() => onReservar(primerServicio)}
          >
            Reservar ahora
          </Button>
        )}
      </div>

      <div className="mx-auto max-w-2xl px-margin-mobile pt-10 md:px-margin-desktop">
        <CarruselFotos negocio={negocio} />
        <SeccionServicios negocio={negocio} onReservar={onReservar} />
        <SeccionEquipo negocio={negocio} />
        <SeccionHorario negocio={negocio} />
        {negocio.telefono && (
          <a
            href={`tel:${negocio.telefono}`}
            className="mt-8 flex items-center justify-center gap-1.5 font-body-md text-body-md text-acento hover:underline"
          >
            <Icon name="call" className="text-[18px]" />
            {negocio.telefono}
          </a>
        )}
      </div>
    </div>
  );
}

const COMPOSICIONES: Record<Tema, (props: PropsTema) => React.ReactElement> = {
  estandar: TemaEstandar,
  vitrina: TemaVitrina,
};

/** Cómo se le presenta cada tema al dueño en el panel. Vive acá, al lado
 * de la implementación, para que agregar un tema sea un solo archivo. */
export const CATALOGO_TEMAS: Array<{ id: Tema; nombre: string; descripcion: string }> = [
  {
    id: "estandar",
    nombre: "Estándar",
    descripcion: "Tus servicios primero. Funciona bien aunque no tengas fotos.",
  },
  {
    id: "vitrina",
    nombre: "Vitrina",
    descripcion: "Tu portada a pantalla completa, con el botón de reservar encima.",
  },
];

export function composicionDe(tema: Tema | undefined): (props: PropsTema) => React.ReactElement {
  return (tema && COMPOSICIONES[tema]) || TemaEstandar;
}
