import { useState } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import {
  CATALOGO_SERVICIOS,
  CATEGORIAS_CATALOGO,
  sugerenciaAServicio,
} from "../data/catalogoServicios";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { ToggleGroup, ToggleGroupItem } from "../ui/ToggleGroup";
import { cn } from "../ui/cn";
import { formatearMoneda } from "../ui/moneda";

type Servicio = components["schemas"]["Servicio"];

/** Qué servicios ofrece, elegidos del catálogo semilla.
 *
 * Reusa el mismo catálogo y el mismo endpoint en lote que la pantalla de
 * Servicios (`ModalCatalogo`): acá no hay nada nuevo salvo el envoltorio
 * de wizard. Los precios son referencias de mercado, editables después —
 * lo que importa en este minuto es que el enlace público tenga algo que
 * ofrecer, no que la carta quede perfecta.
 */
export function PasoServicios({ onListo }: { onListo: () => Promise<void> }) {
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_CATALOGO[0]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const visibles = CATALOGO_SERVICIOS.filter((item) => item.categoria === categoria);

  function alternar(nombre: string) {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(nombre)) siguiente.delete(nombre);
      else siguiente.add(nombre);
      return siguiente;
    });
  }

  async function guardar() {
    setError(null);
    const elegidos = CATALOGO_SERVICIOS.filter((item) => seleccion.has(item.nombre));
    if (elegidos.length === 0) {
      setError("Marca al menos uno. Sin servicios no hay nada que reservar.");
      return;
    }

    setGuardando(true);
    // Todos o ninguno (`CONTRATO.md` 5.6): con diez marcados y la red de
    // un local comercial, entrar a medias dejaría al dueño sin saber
    // cuáles reintentar.
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/servicios/lote/", {
        body: { servicios: elegidos.map(sugerenciaAServicio) as Servicio[] },
      }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setError("No se pudieron agregar. Intenta de nuevo.");
      return;
    }
    await onListo();
  }

  return (
    <div className="flex flex-col gap-5">
      <ToggleGroup valor={categoria} onChange={setCategoria}>
        {CATEGORIAS_CATALOGO.map((nombre) => (
          <ToggleGroupItem key={nombre} value={nombre}>
            {nombre}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ul className="flex flex-col gap-2">
        {visibles.map((servicio) => {
          const marcado = seleccion.has(servicio.nombre);
          return (
            <li key={servicio.nombre}>
              <button
                type="button"
                onClick={() => alternar(servicio.nombre)}
                aria-pressed={marcado}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors",
                  marcado ? "border-menta bg-menta/5" : "border-outline-variant hover:border-menta/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border",
                    marcado ? "border-menta bg-menta text-white" : "border-outline-variant",
                  )}
                >
                  {marcado && <Icon name="check" className="text-[16px]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-label-md text-label-md text-on-surface">
                    {servicio.nombre}
                  </span>
                  <span className="block font-caption text-caption text-on-surface-variant">
                    {servicio.duracion_minutos} min
                  </span>
                </span>
                <span className="shrink-0 font-label-md text-label-md text-primary">
                  {formatearMoneda(servicio.precio)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="flex items-start gap-2 font-caption text-caption text-on-surface-variant">
        <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
        Los precios son una referencia para arrancar. Los ajustas en Servicios cuando quieras, y ahí
        mismo defines la comisión de cada uno.
      </p>

      {error && (
        <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
          <Icon name="error" className="shrink-0 text-[18px]" />
          {error}
        </p>
      )}

      <Button onClick={guardar} cargando={guardando} anchoCompleto>
        {seleccion.size > 0 ? `Agregar ${seleccion.size} y continuar` : "Continuar"}
      </Button>
    </div>
  );
}
