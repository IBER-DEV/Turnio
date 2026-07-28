import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiPublico } from "../../api/publico";
import type { NegocioPublico, ServicioPublico } from "../../api/publico";
import { cargarFuenteDe, plantillaDe, variablesDePlantilla } from "../../tema/plantillas";
import { EstadoError, Skeleton, SkeletonLista } from "../../ui/Feedback";
import { useToast } from "../../ui/Toast";
import { ReservaHoja } from "./ReservaHoja";
import {
  CarruselFotos,
  Contacto,
  Encabezado,
  FirmaTurnio,
  SeccionEquipo,
  SeccionHorario,
  SeccionServicios,
} from "./secciones";

type Estado = { tipo: "cargando" } | { tipo: "error" } | { tipo: "listo"; negocio: NegocioPublico };

export function PerfilNegocioPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [servicioReserva, setServicioReserva] = useState<ServicioPublico | null>(null);
  const { mostrar } = useToast();

  useEffect(() => {
    let cancelado = false;
    setEstado({ tipo: "cargando" });
    apiPublico
      .GET("/api/publico/negocios/{slug}/", { params: { path: { slug } } })
      .then(({ data, error }) => {
        if (cancelado) return;
        setEstado(error || !data ? { tipo: "error" } : { tipo: "listo", negocio: data });
      })
      .catch(() => {
        if (!cancelado) setEstado({ tipo: "error" });
      });
    return () => {
      cancelado = true;
    };
  }, [slug]);

  const tema = estado.tipo === "listo" ? estado.negocio.tema : undefined;
  useEffect(() => {
    // La serif de barbería se descarga solo si esta plantilla la usa:
    // quien abre el perfil de un spa no paga por una fuente que no ve.
    if (tema) cargarFuenteDe(plantillaDe(tema));
  }, [tema]);

  async function compartir(negocio: NegocioPublico) {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: negocio.nombre, url });
      } catch {
        // El visitante cerró el share sheet nativo: no es un error que avisar.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    mostrar("exito", "Enlace copiado.");
  }

  if (estado.tipo === "cargando") {
    return (
      <div className="mx-auto max-w-2xl px-margin-mobile py-8 md:px-margin-desktop">
        <div className="mb-8 flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3 opacity-60" />
          </div>
        </div>
        <SkeletonLista filas={3} />
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-2xl items-center px-margin-mobile md:px-margin-desktop">
        <EstadoError mensaje="Este negocio no existe o ya no está activo. Si te pasaron el enlace, verifica que esté completo." />
      </div>
    );
  }

  const { negocio } = estado;
  const plantilla = plantillaDe(negocio.tema);

  return (
    // La plantilla se aplica **acá**, no en `:root`: es el mismo bundle
    // que sirve el panel del staff, y pintar la raíz dejaría la app
    // entera con la paleta de la última barbería que alguien visitó.
    // Todo lo que use tokens `perfil-*` dentro de este árbol se repinta
    // solo; fuera, siguen los colores de Turnio.
    <div
      style={variablesDePlantilla(negocio.tema, negocio.color_acento)}
      className="min-h-dvh bg-perfil-fondo"
    >
      <Encabezado
        negocio={negocio}
        plantilla={plantilla}
        usaPortadaDeMuestra={!negocio.portada}
        onCompartir={() => compartir(negocio)}
      />

      {/* Mismo `--width-perfil-contenido` que el encabezado, para que
          los dos bordes coincidan (ver `Encabezado`). En `lg`+ se abre
          en dos columnas — servicios a la izquierda (más ancha, es lo
          que la mayoría vino a ver), equipo/horario/contacto en una
          columna fija a la derecha — en vez de una sola lista angosta
          perdida en medio de una pantalla grande. En mobile son dos
          `div` que simplemente se apilan en el mismo orden de siempre. */}
      <div className="mx-auto max-w-(--width-perfil-contenido) px-margin-mobile pb-16 pt-8 md:px-margin-desktop">
        <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-10">
          <div className="lg:col-span-2">
            <CarruselFotos negocio={negocio} />
            <SeccionServicios
              negocio={negocio}
              plantilla={plantilla}
              onReservar={setServicioReserva}
            />
          </div>
          <div className="lg:sticky lg:top-8">
            <SeccionEquipo negocio={negocio} plantilla={plantilla} />
            <SeccionHorario negocio={negocio} plantilla={plantilla} />
            <Contacto negocio={negocio} />
          </div>
        </div>
        <FirmaTurnio />
      </div>

      {servicioReserva && (
        <ReservaHoja
          negocio={negocio}
          servicio={servicioReserva}
          onCerrar={() => setServicioReserva(null)}
        />
      )}
    </div>
  );
}
