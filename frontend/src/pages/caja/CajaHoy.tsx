import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import type { MovimientoCajaInput } from "../../api/types";
import { conReintentoDeAuth } from "../../auth/refresh";
import { usePermisos } from "../../permisos/usePermisos";
import { Button } from "../../ui/Button";
import { ESTILO_ESTADO_CAJA } from "../../ui/EstadoCaja";
import { Badge, Card, EstadoError, EstadoVacio, SkeletonLista } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { SelectCustom, SelectItem } from "../../ui/SelectCustom";
import { ToggleGroup, ToggleGroupItem } from "../../ui/ToggleGroup";
import { formatearMoneda } from "../../ui/moneda";
import { useToast } from "../../ui/Toast";
import { cn } from "../../ui/cn";

type CajaDetalle = components["schemas"]["CajaDetalle"];
type MovimientoCaja = components["schemas"]["MovimientoCaja"];
type RegistroServicio = components["schemas"]["RegistroServicio"];
type Servicio = components["schemas"]["Servicio"];
type TipoMovimiento = components["schemas"]["MovimientoCajaTipoEnum"];
type MetodoPago = "efectivo" | "nequi" | "daviplata" | "bre_b" | "otro";

const METODOS_PAGO: Array<{ value: MetodoPago; etiqueta: string }> = [
  { value: "efectivo", etiqueta: "Efectivo" },
  { value: "nequi", etiqueta: "Nequi" },
  { value: "daviplata", etiqueta: "Daviplata" },
  { value: "bre_b", etiqueta: "Bre-B" },
  { value: "otro", etiqueta: "Otro" },
];

const SIN_VINCULAR = "ninguno";

function formatearHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FormularioMovimiento {
  tipo: TipoMovimiento;
  metodoPago: MetodoPago;
  monto: string;
  concepto: string;
  registroServicioId: string;
}

function formularioVacio(): FormularioMovimiento {
  return {
    tipo: "ingreso",
    metodoPago: "efectivo",
    monto: "",
    concepto: "",
    registroServicioId: SIN_VINCULAR,
  };
}

export function CajaHoy() {
  const { mostrar } = useToast();
  const { puede } = usePermisos();
  const puedeVerHistorico = puede("puede_ver_reportes");

  const [caja, setCaja] = useState<CajaDetalle | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [registrosAprobados, setRegistrosAprobados] = useState<RegistroServicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [abrirAbierto, setAbrirAbierto] = useState(false);
  const [saldoInicial, setSaldoInicial] = useState("");
  const [abriendo, setAbriendo] = useState(false);

  const [movimientoAbierto, setMovimientoAbierto] = useState(false);
  const [datos, setDatos] = useState<FormularioMovimiento>(formularioVacio());
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);

  const [cerrarAbierto, setCerrarAbierto] = useState(false);
  const [notaCierre, setNotaCierre] = useState("");
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    const [actualResp, serviciosResp, registrosResp] = await Promise.all([
      conReintentoDeAuth(() => apiClient.GET("/api/caja/actual/")),
      conReintentoDeAuth(() => apiClient.GET("/api/servicios/")),
      conReintentoDeAuth(() =>
        apiClient.GET("/api/servicios/registros/", { params: { query: { estado: "aprobado" } } }),
      ),
    ]);

    if (serviciosResp.error || registrosResp.error) {
      setError(true);
      setCargando(false);
      return;
    }
    setServicios((serviciosResp.data ?? []).filter((servicio) => servicio.activo));
    setRegistrosAprobados(registrosResp.data ?? []);

    if (actualResp.response.status === 404) {
      // No hay caja abierta — es el estado normal de "todavía no arrancó
      // el día", no un error.
      setCaja(null);
    } else if (actualResp.error || !actualResp.data) {
      setError(true);
      setCargando(false);
      return;
    } else {
      setCaja(actualResp.data);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleAbrir(evento: FormEvent) {
    evento.preventDefault();
    setAbriendo(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/caja/abrir/", {
        body: { saldo_inicial: saldoInicial.trim() === "" ? "0" : saldoInicial },
      }),
    );
    setAbriendo(false);

    if (errorRespuesta || !data) {
      mostrar("error", "No se pudo abrir la caja.");
      return;
    }
    setCaja(data);
    setAbrirAbierto(false);
    setSaldoInicial("");
    mostrar("exito", "Caja abierta.");
  }

  function abrirFormularioMovimiento() {
    setDatos(formularioVacio());
    setErrorFormulario(null);
    setMovimientoAbierto(true);
  }

  function elegirRegistro(id: string) {
    if (id === SIN_VINCULAR) {
      setDatos({ ...datos, registroServicioId: id });
      return;
    }
    const registro = registrosAprobados.find((r) => String(r.id) === id);
    const servicio = servicios.find((s) => s.id === registro?.servicio);
    setDatos({
      ...datos,
      registroServicioId: id,
      concepto: registro?.servicio_nombre ?? datos.concepto,
      monto: servicio?.precio ?? datos.monto,
    });
  }

  async function handleRegistrarMovimiento(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);

    if (!datos.monto || Number(datos.monto) <= 0) {
      setErrorFormulario("El monto debe ser mayor a cero.");
      return;
    }
    if (!datos.concepto.trim()) {
      setErrorFormulario("Describe brevemente el movimiento.");
      return;
    }

    // Tipado contra `MovimientoCajaInput` (sin los campos de solo
    // lectura) para atrapar errores de tipeo al armarlo; el cast a la
    // forma completa del schema es el mismo patrón que ya usa
    // `ServicioInput`/`Servicio` en `ServiciosPage.tsx` — ver el "wart"
    // de contrato documentado en `frontend/CLAUDE.md`.
    const cuerpo: MovimientoCajaInput = {
      tipo: datos.tipo,
      monto: datos.monto,
      concepto: datos.concepto.trim(),
      metodo_pago: datos.tipo === "ingreso" ? datos.metodoPago : undefined,
      registro_servicio:
        datos.tipo === "ingreso" && datos.registroServicioId !== SIN_VINCULAR
          ? Number(datos.registroServicioId)
          : undefined,
    };
    setGuardandoMovimiento(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/caja/movimientos/", {
        body: cuerpo as MovimientoCaja,
      }),
    );
    setGuardandoMovimiento(false);

    if (errorRespuesta || !data) {
      setErrorFormulario("No se pudo registrar. Revisa los datos e intenta de nuevo.");
      return;
    }

    mostrar("exito", datos.tipo === "ingreso" ? "Ingreso registrado." : "Egreso registrado.");
    setMovimientoAbierto(false);
    await cargar();
  }

  function abrirCierre() {
    setNotaCierre("");
    setCerrarAbierto(true);
  }

  async function handleCerrar(evento: FormEvent) {
    evento.preventDefault();
    setCerrando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/caja/cerrar/", { body: { nota_cierre: notaCierre } }),
    );
    setCerrando(false);

    if (errorRespuesta || !data) {
      mostrar("error", "No se pudo cerrar la caja.");
      return;
    }
    setCerrarAbierto(false);
    mostrar("exito", "Caja cerrada.");
    await cargar();
  }

  if (cargando) {
    return <SkeletonLista filas={4} />;
  }

  if (error) {
    return (
      <EstadoError mensaje="No pudimos cargar la caja. Revisa tu conexión." onReintentar={cargar} />
    );
  }

  if (!caja) {
    return (
      <>
        <EstadoVacio
          icono="point_of_sale"
          titulo="Todavía no abriste la caja"
          descripcion="Abrila para empezar a registrar los cobros del día."
          accion={{ etiqueta: "Abrir caja", onClick: () => setAbrirAbierto(true) }}
        />
        <Modal
          abierto={abrirAbierto}
          onCerrar={() => setAbrirAbierto(false)}
          titulo="Abrir caja"
          descripcion="Con cuánto efectivo arrancas el día (opcional)."
        >
          <form className="flex flex-col gap-6" onSubmit={handleAbrir}>
            <Input
              label="Saldo inicial (opcional)"
              type="number"
              min="0"
              step="0.01"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              placeholder="0"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variante="ghost"
                onClick={() => setAbrirAbierto(false)}
                disabled={abriendo}
              >
                Cancelar
              </Button>
              <Button type="submit" cargando={abriendo}>
                Abrir caja
              </Button>
            </div>
          </form>
        </Modal>
      </>
    );
  }

  const { resumen } = caja;
  const registrosDisponibles = registrosAprobados.filter(
    (registro) =>
      !caja.movimientos.some((movimiento) => movimiento.registro_servicio === registro.id),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge className={ESTILO_ESTADO_CAJA.abierta.badge}>
            {ESTILO_ESTADO_CAJA.abierta.etiqueta}
          </Badge>
          <span className="font-caption text-caption text-on-surface-variant">
            Desde {formatearHora(caja.abierta_en)} · {caja.abierta_por_nombre}
          </span>
        </div>
        <div className="flex gap-2">
          <Button icono="add" tamano="sm" onClick={abrirFormularioMovimiento}>
            Registrar movimiento
          </Button>
          <Button icono="lock" tamano="sm" variante="secondary" onClick={abrirCierre}>
            Cerrar caja
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="font-caption text-caption text-on-surface-variant">Ingresos</p>
          <p className="mt-1 text-lg font-bold text-completada">
            {formatearMoneda(resumen.total_ingresos)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-caption text-caption text-on-surface-variant">Egresos</p>
          <p className="mt-1 text-lg font-bold text-error">
            {formatearMoneda(resumen.total_egresos)}
          </p>
        </Card>
        <Card className="col-span-2 p-4 sm:col-span-1">
          <p className="font-caption text-caption text-on-surface-variant">Neto</p>
          <p className="mt-1 text-lg font-bold text-primary">{formatearMoneda(resumen.neto)}</p>
        </Card>
      </div>

      {resumen.comisiones_por_empleado.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 font-label-md text-label-md text-on-surface">Comisiones del día</p>
          <ul className="space-y-1.5">
            {resumen.comisiones_por_empleado.map((fila) => (
              <li key={fila.empleado} className="flex items-center justify-between text-body-md">
                <span className="text-on-surface-variant">{fila.empleado_nombre}</span>
                <span className="font-label-md text-on-surface">{formatearMoneda(fila.monto)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {resumen.servicios_aprobados_sin_cobrar > 0 && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-tertiary-container px-3 py-2 font-caption text-caption text-on-tertiary-container"
        >
          <Icon name="info" className="mt-0.5 shrink-0 text-[18px]" />
          {resumen.servicios_aprobados_sin_cobrar === 1
            ? "Hay 1 servicio aprobado que todavía no se cobró."
            : `Hay ${resumen.servicios_aprobados_sin_cobrar} servicios aprobados que todavía no se cobraron.`}
        </p>
      )}

      {caja.movimientos.length === 0 ? (
        <EstadoVacio
          icono="point_of_sale"
          titulo="Sin movimientos todavía"
          descripcion="Registra el primer ingreso o egreso del día."
          accion={{ etiqueta: "Registrar movimiento", onClick: abrirFormularioMovimiento }}
        />
      ) : (
        <ul className="space-y-2">
          {caja.movimientos.map((movimiento: MovimientoCaja) => (
            <li key={movimiento.id}>
              <Card className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      movimiento.tipo === "ingreso"
                        ? "bg-completada/15 text-completada"
                        : "bg-error/15 text-error",
                    )}
                  >
                    <Icon
                      name={movimiento.tipo === "ingreso" ? "add_circle" : "cancel"}
                      className="text-[18px]"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-label-md text-label-md text-on-surface">
                      {movimiento.concepto}
                    </p>
                    <p className="truncate text-[12px] text-on-surface-variant">
                      {formatearHora(movimiento.creado_en)}
                      {movimiento.metodo_pago &&
                        ` · ${METODOS_PAGO.find((m) => m.value === movimiento.metodo_pago)?.etiqueta ?? movimiento.metodo_pago}`}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-label-md text-label-md",
                    movimiento.tipo === "ingreso" ? "text-completada" : "text-error",
                  )}
                >
                  {movimiento.tipo === "egreso" ? "− " : ""}
                  {formatearMoneda(movimiento.monto)}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!puedeVerHistorico && (
        <p className="font-caption text-caption text-on-surface-variant">
          Con permiso para ver reportes también verías el histórico de cajas de otros días.
        </p>
      )}

      <Modal
        abierto={movimientoAbierto}
        onCerrar={() => setMovimientoAbierto(false)}
        titulo="Registrar movimiento"
      >
        <form className="flex flex-col gap-6" onSubmit={handleRegistrarMovimiento}>
          <ToggleGroup
            valor={datos.tipo}
            onChange={(valor) =>
              setDatos({ ...formularioVacio(), tipo: valor as TipoMovimiento })
            }
          >
            <ToggleGroupItem value="ingreso">Ingreso</ToggleGroupItem>
            <ToggleGroupItem value="egreso">Egreso</ToggleGroupItem>
          </ToggleGroup>

          {datos.tipo === "ingreso" && (
            <>
              <SelectCustom
                label="Método de pago"
                valor={datos.metodoPago}
                onChange={(valor) => setDatos({ ...datos, metodoPago: valor as MetodoPago })}
              >
                {METODOS_PAGO.map((metodo) => (
                  <SelectItem key={metodo.value} value={metodo.value}>
                    {metodo.etiqueta}
                  </SelectItem>
                ))}
              </SelectCustom>

              {registrosDisponibles.length > 0 && (
                <SelectCustom
                  label="¿Viene de un servicio ya validado? (opcional)"
                  valor={datos.registroServicioId}
                  onChange={elegirRegistro}
                  ayuda="Al elegir uno, la comisión queda a nombre de quien lo hizo."
                >
                  <SelectItem value={SIN_VINCULAR}>Ninguno</SelectItem>
                  {registrosDisponibles.map((registro) => (
                    <SelectItem key={registro.id} value={String(registro.id)}>
                      {registro.servicio_nombre} — {registro.empleado_nombre} (
                      {registro.nombre_cliente})
                    </SelectItem>
                  ))}
                </SelectCustom>
              )}

              {datos.registroServicioId !== SIN_VINCULAR && (
                <p className="-mt-3 font-caption text-caption text-on-surface-variant">
                  Comisión para:{" "}
                  <strong className="text-on-surface">
                    {
                      registrosAprobados.find((r) => String(r.id) === datos.registroServicioId)
                        ?.empleado_nombre
                    }
                  </strong>
                </p>
              )}
            </>
          )}

          <Input
            label="Monto"
            type="number"
            min="0.01"
            step="0.01"
            value={datos.monto}
            onChange={(e) => setDatos({ ...datos, monto: e.target.value })}
            placeholder="20000"
            required
          />
          <Input
            label="Concepto"
            value={datos.concepto}
            onChange={(e) => setDatos({ ...datos, concepto: e.target.value })}
            placeholder={datos.tipo === "ingreso" ? "Ej: Corte de cabello" : "Ej: Compra de insumos"}
            required
          />

          {errorFormulario && (
            <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
              <Icon name="error" className="shrink-0 text-[18px]" />
              {errorFormulario}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variante="ghost"
              onClick={() => setMovimientoAbierto(false)}
              disabled={guardandoMovimiento}
            >
              Cancelar
            </Button>
            <Button type="submit" cargando={guardandoMovimiento}>
              Registrar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        abierto={cerrarAbierto}
        onCerrar={() => setCerrarAbierto(false)}
        titulo="¿Cerrar la caja?"
        descripcion="No vas a poder registrar más movimientos hasta que abras una nueva."
      >
        <form className="flex flex-col gap-6" onSubmit={handleCerrar}>
          <div className="rounded-xl border border-outline-variant p-4">
            <div className="flex items-center justify-between font-body-md text-body-md">
              <span className="text-on-surface-variant">Ingresos</span>
              <span className="text-on-surface">{formatearMoneda(resumen.total_ingresos)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between font-body-md text-body-md">
              <span className="text-on-surface-variant">Egresos</span>
              <span className="text-on-surface">{formatearMoneda(resumen.total_egresos)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-outline-variant pt-2 font-label-md text-label-md">
              <span className="text-on-surface">Neto</span>
              <span className="text-primary">{formatearMoneda(resumen.neto)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-label-md text-label-md text-on-surface">
              Nota de cierre (opcional)
            </label>
            <textarea
              value={notaCierre}
              onChange={(e) => setNotaCierre(e.target.value)}
              rows={2}
              placeholder="Cualquier detalle sobre el cierre del día"
              className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 font-body-md text-body-md text-on-surface outline-hidden transition-all placeholder:text-outline focus:border-menta focus:ring-2 focus:ring-menta/20"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variante="ghost"
              onClick={() => setCerrarAbierto(false)}
              disabled={cerrando}
            >
              Cancelar
            </Button>
            <Button type="submit" variante="danger" cargando={cerrando}>
              Cerrar caja
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
