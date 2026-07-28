import { useMemo, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { conReintentoDeAuth } from "../../auth/refresh";
import {
  CATALOGO_SERVICIOS,
  CATEGORIAS_CATALOGO,
  sugerenciaAServicio,
} from "../../data/catalogoServicios";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Icon } from "../../ui/Icon";
import { Modal } from "../../ui/Modal";
import { ToggleGroup, ToggleGroupItem } from "../../ui/ToggleGroup";
import { useToast } from "../../ui/Toast";

type Servicio = components["schemas"]["Servicio"];

const MONEDA = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Alta en lote desde el catálogo semilla, para no obligar a teclear la
 * carta entera servicio por servicio al abrir el negocio. Lo que se crea
 * es editable después como cualquier servicio propio. */
export function ModalCatalogo({
  abierto,
  onCerrar,
  yaExistentes,
  onCreados,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Nombres ya cargados, para no ofrecer duplicados. */
  yaExistentes: string[];
  onCreados: () => Promise<void>;
}) {
  const { mostrar } = useToast();
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_CATALOGO[0]);
  const [guardando, setGuardando] = useState(false);

  const existentes = useMemo(
    () => new Set(yaExistentes.map((nombre) => nombre.trim().toLowerCase())),
    [yaExistentes],
  );

  const visibles = CATALOGO_SERVICIOS.filter((item) => item.categoria === categoria);

  function alternar(nombre: string) {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(nombre)) siguiente.delete(nombre);
      else siguiente.add(nombre);
      return siguiente;
    });
  }

  async function agregar() {
    const elegidos = CATALOGO_SERVICIOS.filter((item) => seleccion.has(item.nombre));
    if (elegidos.length === 0) return;

    setGuardando(true);

    // `POST /api/servicios/lote/` los crea todos o ninguno (ver
    // CONTRATO.md 5.5). Antes era un POST por servicio, y con 10
    // marcados era normal que entraran 7 y el usuario quedara sin saber
    // cuáles reintentar.
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/servicios/lote/", {
        body: { servicios: elegidos.map(sugerenciaAServicio) as Servicio[] },
      }),
    );

    setGuardando(false);

    if (errorRespuesta) {
      mostrar("error", "No se pudo agregar el catálogo. No se creó ninguno.");
      return;
    }

    mostrar(
      "exito",
      `Se ${elegidos.length === 1 ? "agregó" : "agregaron"} ${elegidos.length} ${
        elegidos.length === 1 ? "servicio" : "servicios"
      }.`,
    );
    setSeleccion(new Set());
    await onCreados();
    onCerrar();
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Agregar desde el catálogo"
      descripcion="Elige los que ofreces. Puedes ajustar precio y duración después."
    >
      <div className="space-y-6">
        {/* Filtro por categoría */}
        <ToggleGroup
          valor={categoria}
          onChange={setCategoria}
          className="-mx-6 px-6"
        >
          {CATEGORIAS_CATALOGO.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {item}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ul className="space-y-2">
          {visibles.map((item) => {
            const yaEsta = existentes.has(item.nombre.trim().toLowerCase());
            const elegido = seleccion.has(item.nombre);

            return (
              <li key={item.nombre}>
                <button
                  type="button"
                  disabled={yaEsta}
                  onClick={() => alternar(item.nombre)}
                  aria-pressed={elegido}
                  className={cn(
                    "tactile flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    elegido
                      ? "border-menta bg-menta/10"
                      : "border-outline-variant bg-white",
                    yaEsta && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      elegido ? "border-menta bg-menta" : "border-outline-variant",
                    )}
                  >
                    {elegido && <Icon name="check" className="text-[16px] text-on-primary" />}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-label-md text-label-md text-primary">
                      {item.nombre}
                    </span>
                    <span className="block truncate font-caption text-caption text-on-surface-variant">
                      {yaEsta
                        ? "Ya lo tienes"
                        : `${MONEDA.format(Number(item.precio))} · ${item.duracion_minutos} min`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={agregar}
            cargando={guardando}
            disabled={seleccion.size === 0}
          >
            {seleccion.size === 0
              ? "Agregar"
              : `Agregar ${seleccion.size} ${seleccion.size === 1 ? "servicio" : "servicios"}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
