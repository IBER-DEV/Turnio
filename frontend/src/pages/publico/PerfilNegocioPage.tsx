import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiPublico } from "../../api/publico";
import type { NegocioPublico, ServicioPublico } from "../../api/publico";
import { variablesDeTema } from "../../tema/colores";
import { EstadoError, Skeleton, SkeletonLista } from "../../ui/Feedback";
import { useToast } from "../../ui/Toast";
import { ReservaHoja } from "./ReservaHoja";
import { FirmaTurnio } from "./secciones";
import { composicionDe } from "./temas";

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
  const Composicion = composicionDe(negocio.tema);

  return (
    // El color del negocio se aplica **acá**, no en `:root`: es el mismo
    // bundle que sirve el panel del staff, y teñir la raíz dejaría la app
    // entera con el color de la última barbería que alguien visitó. Todo
    // lo que use `bg-acento`, `text-acento`, etc. dentro de este árbol se
    // repinta solo; fuera, sigue el color de Turnio.
    <div style={variablesDeTema(negocio.color_acento)}>
      <Composicion
        negocio={negocio}
        onReservar={setServicioReserva}
        onCompartir={() => compartir(negocio)}
      />
      <div className="mx-auto max-w-2xl px-margin-mobile md:px-margin-desktop">
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
