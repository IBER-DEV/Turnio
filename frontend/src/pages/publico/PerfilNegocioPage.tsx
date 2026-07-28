import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiPublico } from "../../api/publico";
import type { NegocioPublico, ServicioPublico } from "../../api/publico";
import { Avatar } from "../../ui/Avatar";
import { Card, EstadoError, EstadoVacio, Skeleton, SkeletonLista } from "../../ui/Feedback";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { useToast } from "../../ui/Toast";
import { ReservaHoja } from "./ReservaHoja";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const MONEDA = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatearPrecio(precio: string): string {
  const numero = Number(precio);
  return Number.isNaN(numero) ? precio : MONEDA.format(numero);
}

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
  const horarioPorDia = new Map<number, NegocioPublico["horario"]>();
  for (const franja of negocio.horario) {
    horarioPorDia.set(franja.dia_semana, [...(horarioPorDia.get(franja.dia_semana) ?? []), franja]);
  }

  return (
    <div className="mx-auto max-w-2xl px-margin-mobile pb-16 pt-8 md:px-margin-desktop">
      <header className="mb-10 flex items-start gap-4">
        <Avatar nombre={negocio.nombre} tamano="lg" forma="cuadrado" />
        <div className="min-w-0 flex-1">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary md:font-headline-lg md:text-headline-lg">
            {negocio.nombre}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 font-body-md text-body-md text-on-surface-variant">
            <Icon name="location_on" className="text-[18px]" />
            {negocio.ciudad}
            {negocio.direccion ? ` · ${negocio.direccion}` : ""}
          </p>
          {negocio.telefono && (
            <a
              href={`tel:${negocio.telefono}`}
              className="mt-1 flex items-center gap-1.5 font-body-md text-body-md text-menta hover:underline"
            >
              <Icon name="call" className="text-[18px]" />
              {negocio.telefono}
            </a>
          )}
        </div>
        <Button
          variante="ghost"
          tamano="sm"
          icono="share"
          onClick={() => compartir(negocio)}
          aria-label="Compartir enlace del negocio"
        />
      </header>

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
                  <Button tamano="sm" onClick={() => setServicioReserva(servicio)}>
                    Reservar
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

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
