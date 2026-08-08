import { useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { conReintentoDeAuth } from "../../auth/refresh";
import { useAuth } from "../../auth/AuthContext";
import { usePermisos } from "../../permisos/usePermisos";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { SelectCustom, SelectItem } from "../../ui/SelectCustom";
import { formatearMoneda } from "../../ui/moneda";
import { useToast } from "../../ui/Toast";
import { aNumero } from "./dinero";
import type { Venta } from "./dinero";

type Servicio = components["schemas"]["Servicio"];
type Empleado = components["schemas"]["MiembroEquipo"];

interface LineaFormulario {
  /** `id` local, solo para la `key` de React: los items todavía no
   * existen en el backend. */
  clave: number;
  servicioId: string;
  empleadoId: string;
  cantidad: string;
}

let siguienteClave = 1;

function lineaVacia(empleadoPorDefecto: string): LineaFormulario {
  return {
    clave: siguienteClave++,
    servicioId: "",
    empleadoId: empleadoPorDefecto,
    cantidad: "1",
  };
}

/** Abrir una cuenta para el cliente que llegó sin cita (walk-in).
 *
 * Es la puerta de atrás del flujo normal: lo esperable es que la cuenta
 * la genere sola la cita al completarse, y por eso este formulario no
 * está en primer plano. Pero un local real recibe gente sin cita todo el
 * día, y sin esto esa plata no tendría dónde entrar.
 *
 * Varias líneas desde el inicio, cada una con **su** empleado: "Corte +
 * Barba" en una sola cuenta es lo normal en una barbería, y no siempre
 * las hace la misma persona. El precio y la comisión los congela el
 * backend al crear cada línea, así que acá no se mandan.
 */
export function ModalVenta({
  abierto,
  servicios,
  empleados,
  onCerrar,
  onCreada,
}: {
  abierto: boolean;
  servicios: Servicio[];
  empleados: Empleado[];
  onCerrar: () => void;
  onCreada: (venta: Venta) => void;
}) {
  const { mostrar } = useToast();
  const { membresia } = useAuth();
  const { puede } = usePermisos();
  // Sin `puede_cobrar` uno solo puede facturar trabajo propio, así que el
  // selector de empleado se bloquea en uno mismo (el backend lo rechaza
  // igual — ver `CONTRATO.md` 5.13 — pero mostrar un selector que va a
  // devolver 400 es una trampa).
  const puedeElegirEmpleado = puede("puede_cobrar");
  const yo = membresia ? String(membresia.id) : "";

  const [nombreCliente, setNombreCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [lineas, setLineas] = useState<LineaFormulario[]>([lineaVacia(yo)]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const total = lineas.reduce((suma, linea) => {
    const servicio = servicios.find((s) => String(s.id) === linea.servicioId);
    if (!servicio) return suma;
    return suma + aNumero(servicio.precio) * Math.max(1, Number(linea.cantidad) || 1);
  }, 0);

  function actualizar(clave: number, cambios: Partial<LineaFormulario>) {
    setLineas((actual) =>
      actual.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)),
    );
  }

  function cerrar() {
    setNombreCliente("");
    setTelefono("");
    setLineas([lineaVacia(yo)]);
    setError(null);
    onCerrar();
  }

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!nombreCliente.trim()) {
      setError("Escribe a nombre de quién queda la cuenta.");
      return;
    }
    const completas = lineas.filter((linea) => linea.servicioId && linea.empleadoId);
    if (completas.length === 0) {
      setError("Agrega al menos un servicio, con quién lo hizo.");
      return;
    }

    setGuardando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/caja/ventas/", {
        body: {
          nombre_cliente: nombreCliente.trim(),
          telefono_cliente: telefono.trim(),
          items: completas.map((linea) => ({
            servicio: Number(linea.servicioId),
            empleado: Number(linea.empleadoId),
            cantidad: Math.max(1, Number(linea.cantidad) || 1),
          })),
          // `items` viaja con la forma de entrada (sin los campos de solo
          // lectura que el schema no separa); el cast es el mismo patrón
          // que ya usa `ServicioInput` — ver el "wart" de contrato en
          // `frontend/CLAUDE.md`.
        } as never,
      }),
    );
    setGuardando(false);

    if (errorRespuesta || !data) {
      setError("No se pudo abrir la cuenta. Revisa los datos e intenta de nuevo.");
      return;
    }

    mostrar("exito", `Cuenta abierta por ${formatearMoneda(data.total)}.`);
    cerrar();
    onCreada(data);
  }

  const serviciosActivos = servicios.filter((servicio) => servicio.activo);

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Cuenta sin cita"
      descripcion="Para el cliente que llegó de sorpresa. Si tenía cita, la cuenta se genera sola al completarla."
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <Input
          label="Cliente"
          value={nombreCliente}
          onChange={(e) => setNombreCliente(e.target.value)}
          placeholder="Nombre de quien recibe el servicio"
          required
        />
        <Input
          label="Teléfono (opcional)"
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="300 000 0000"
        />

        <div className="flex flex-col gap-3">
          <p className="font-label-md text-label-md text-on-surface">¿Qué se le hizo?</p>

          {lineas.map((linea, indice) => (
            <div
              key={linea.clave}
              className="flex flex-col gap-3 rounded-xl border border-outline-variant p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-caption text-caption text-on-surface-variant">
                  Servicio {indice + 1}
                </span>
                {lineas.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLineas((actual) => actual.filter((otra) => otra.clave !== linea.clave))
                    }
                    className="flex items-center gap-1 font-caption text-caption text-error hover:underline"
                  >
                    <Icon name="close" className="text-[16px]" />
                    Quitar
                  </button>
                )}
              </div>

              <SelectCustom
                label="Servicio"
                valor={linea.servicioId}
                onChange={(valor) => actualizar(linea.clave, { servicioId: valor })}
                placeholder="Elige el servicio"
              >
                {serviciosActivos.map((servicio) => (
                  <SelectItem key={servicio.id} value={String(servicio.id)}>
                    {servicio.nombre} — {formatearMoneda(servicio.precio)}
                  </SelectItem>
                ))}
              </SelectCustom>

              <SelectCustom
                label="¿Quién lo hizo?"
                valor={linea.empleadoId}
                onChange={(valor) => actualizar(linea.clave, { empleadoId: valor })}
                disabled={!puedeElegirEmpleado}
                ayuda={
                  puedeElegirEmpleado
                    ? "De acá sale la comisión, así que importa que sea quien de verdad lo hizo."
                    : "Solo puedes registrar tu propio trabajo."
                }
              >
                {empleados.map((empleado) => (
                  <SelectItem key={empleado.id} value={String(empleado.id)}>
                    {empleado.nombre}
                  </SelectItem>
                ))}
              </SelectCustom>

              <Input
                label="Cantidad"
                type="number"
                min="1"
                step="1"
                value={linea.cantidad}
                onChange={(e) => actualizar(linea.clave, { cantidad: e.target.value })}
              />
            </div>
          ))}

          <Button
            type="button"
            variante="secondary"
            icono="add"
            tamano="sm"
            onClick={() => setLineas((actual) => [...actual, lineaVacia(yo)])}
          >
            Agregar otro servicio
          </Button>
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 font-label-md text-label-md">
            <span className="text-on-surface">Total</span>
            <span className="text-primary">{formatearMoneda(String(total))}</span>
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
            <Icon name="error" className="shrink-0 text-[18px]" />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="ghost" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={guardando}>
            Abrir cuenta
          </Button>
        </div>
      </form>
    </Modal>
  );
}
