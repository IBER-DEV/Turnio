import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import type { ServicioInput } from "../api/types";
import { conReintentoDeAuth } from "../auth/refresh";
import { obtenerImagenServicio } from "../data/catalogoServicios";
import { Button } from "../ui/Button";
import { EstadoError, SkeletonLista } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { MenuAcciones, MenuAccionesItem, MenuAccionesSeparator } from "../ui/MenuAcciones";
import { Modal, ModalConfirmacion } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { usePermisos } from "../permisos/usePermisos";
import { cn } from "../ui/cn";
import { ModalCatalogo } from "./servicios/ModalCatalogo";

type Servicio = components["schemas"]["Servicio"];

const SERVICIO_VACIO: ServicioInput = {
  nombre: "",
  descripcion: "",
  categoria: "",
  precio: "",
  duracion_minutos: 30,
  porcentaje_comision: "0",
  activo: true,
};

const MONEDA = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatearPrecio(precio: string): string {
  const numero = Number(precio);
  return Number.isNaN(numero) ? precio : MONEDA.format(numero);
}

export function ServiciosPage() {
  const { mostrar } = useToast();
  const { puede } = usePermisos();
  const puedeEditar = puede("puede_editar_precios");

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [editando, setEditando] = useState<Servicio | null>(null);
  const [datos, setDatos] = useState<ServicioInput>(SERVICIO_VACIO);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [porDesactivar, setPorDesactivar] = useState<Servicio | null>(null);
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);

  async function cargar() {
    setCargando(true);
    setError(false);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.GET("/api/servicios/"),
    );
    if (errorRespuesta || !data) {
      setError(true);
    } else {
      setServicios(data);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  function abrirCreacion() {
    setEditando(null);
    setDatos(SERVICIO_VACIO);
    setErrorFormulario(null);
    setFormularioAbierto(true);
  }

  function abrirEdicion(servicio: Servicio) {
    setEditando(servicio);
    setDatos({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? "",
      categoria: servicio.categoria ?? "",
      precio: servicio.precio,
      duracion_minutos: servicio.duracion_minutos,
      porcentaje_comision: servicio.porcentaje_comision ?? "0",
      activo: servicio.activo ?? true,
    });
    setErrorFormulario(null);
    setFormularioAbierto(true);
  }

  async function handleGuardar(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);

    const respuesta = editando
      ? await conReintentoDeAuth(() =>
          apiClient.PATCH("/api/servicios/{id}/", {
            params: { path: { id: editando.id } },
            body: datos,
          }),
        )
      : await conReintentoDeAuth(() =>
          apiClient.POST("/api/servicios/", {
            body: datos as Servicio,
          }),
        );

    setGuardando(false);

    if (respuesta.error) {
      setErrorFormulario("Revisa los datos: el precio y la duración deben ser mayores a cero.");
      return;
    }

    mostrar("exito", editando ? "Servicio actualizado." : "Servicio creado.");
    setFormularioAbierto(false);
    await cargar();
  }

  async function cambiarActivo(servicio: Servicio, activo: boolean) {
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/servicios/{id}/", {
        params: { path: { id: servicio.id } },
        body: { activo },
      }),
    );

    if (errorRespuesta || !data) {
      mostrar("error", "No se pudo cambiar el estado del servicio.");
      return;
    }

    setServicios((actual) => actual.map((item) => (item.id === servicio.id ? data : item)));
    mostrar("exito", activo ? "Servicio activado." : "Servicio desactivado.");
  }

  return (
    <div className="space-y-6">
      {/* El título "Servicios" ya lo muestra la TopAppBar de escritorio
          (Layout.tsx); acá solo se repite en mobile. */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 lg:hidden">
            <Icon name="content_cut" className="text-[20px]" />
          </span>
          <div>
            <h1 className="font-headline-md text-headline-md-mobile font-bold text-slate-900 tracking-tight lg:hidden">
              Servicios
            </h1>
            <p className="text-xs text-slate-500">
              {servicios.length} {servicios.length === 1 ? "servicio" : "servicios"} en tu catálogo
            </p>
          </div>
        </div>
        {puedeEditar && (
          <div className="flex shrink-0 gap-2">
            <Button
              variante="secondary"
              icono="list_alt"
              onClick={() => setCatalogoAbierto(true)}
              aria-label="Agregar desde el catálogo"
            >
              <span className="hidden sm:inline">Catálogo</span>
            </Button>
            <Button icono="add" onClick={abrirCreacion} aria-label="Nuevo servicio">
              <span className="hidden sm:inline">Nuevo</span>
            </Button>
          </div>
        )}
      </header>

      {cargando ? (
        <SkeletonLista />
      ) : error ? (
        <EstadoError
          mensaje="No pudimos cargar los servicios. Revisa tu conexión."
          onReintentar={cargar}
        />
      ) : (
        <div className="space-y-8">
          {/* Bento de arranque: siempre visible, es el atajo más usado
              incluso con el catálogo ya lleno (agregar otro servicio). */}
          {puedeEditar && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setCatalogoAbierto(true)}
                className="group relative flex min-h-40 flex-col items-start overflow-hidden rounded-xl bg-emerald-500 p-6 text-left text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98]"
              >
                <Icon
                  name="stars"
                  className="pointer-events-none absolute -right-2 -top-2 text-[96px] opacity-10 transition-opacity group-hover:opacity-20"
                />
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
                  <Icon name="library_add" className="text-[22px] text-white" />
                </div>
                <h3 className="text-lg font-bold">Catálogo Prediseñado</h3>
                <p className="mt-1 text-sm text-white/80">
                  Empieza rápido con servicios configurados para tu sector.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-emerald-600">
                  Elegir del Catálogo
                  <Icon name="arrow_forward" className="text-[14px]" />
                </span>
              </button>

              <button
                type="button"
                onClick={abrirCreacion}
                className="group flex min-h-40 flex-col items-start rounded-xl border border-slate-200 bg-white p-6 text-left transition-all hover:border-emerald-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-emerald-50">
                  <Icon
                    name="add_circle"
                    className="text-[22px] text-slate-600 transition-colors group-hover:text-emerald-600"
                  />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Servicio Personalizado</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Configura cada detalle desde cero para un control total.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors group-hover:border-emerald-500 group-hover:text-emerald-600">
                  Crear Personalizado
                </span>
              </button>
            </div>
          )}

          {servicios.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <Icon name="content_cut" className="mx-auto text-[24px] text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">
                Aún no tienes servicios registrados en tu catálogo.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Activos actualmente
                </h3>
                <span className="text-xs text-slate-500">
                  {servicios.length} {servicios.length === 1 ? "servicio" : "servicios"}
                </span>
              </div>
              <div className="space-y-3">
                {servicios.map((servicio) => {
                  const inactivo = !servicio.activo;
                  const imgUrl = obtenerImagenServicio(servicio);
                  return (
                    <div
                      key={servicio.id}
                      className={cn(
                        "flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-emerald-200",
                        inactivo && "opacity-60",
                      )}
                    >
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        <img
                          src={imgUrl}
                          alt={servicio.nombre}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2
                          className={cn(
                            "truncate text-base text-slate-900",
                            inactivo && "text-slate-400 line-through",
                          )}
                        >
                          {servicio.nombre}
                        </h2>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Icon name="schedule" className="text-[14px]" />
                            {servicio.duracion_minutos} min
                          </span>
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                            {formatearPrecio(servicio.precio)}
                          </span>
                          {servicio.categoria && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              {servicio.categoria}
                            </span>
                          )}
                          {inactivo && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                              Inactivo
                            </span>
                          )}
                        </div>
                      </div>

                      {puedeEditar && (
                        <MenuAcciones
                          trigger={
                            <button
                              type="button"
                              className="flex h-9 w-9 shrink-0 items-center justify-center text-slate-400 hover:text-slate-900"
                              aria-label={`Acciones de ${servicio.nombre}`}
                            >
                              <Icon name="more_vert" className="text-[20px]" />
                            </button>
                          }
                        >
                          <MenuAccionesItem icono="edit" onClick={() => abrirEdicion(servicio)}>
                            Editar
                          </MenuAccionesItem>
                          <MenuAccionesSeparator />
                          <MenuAccionesItem
                            icono={servicio.activo ? "visibility_off" : "visibility"}
                            destructivo={servicio.activo ?? false}
                            onClick={() => {
                              if (servicio.activo) setPorDesactivar(servicio);
                              else cambiarActivo(servicio, true);
                            }}
                          >
                            {servicio.activo ? "Desactivar" : "Activar"}
                          </MenuAccionesItem>
                        </MenuAcciones>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
        titulo={editando ? "Editar servicio" : "Nuevo servicio"}
        descripcion={
          editando ? "Los cambios aplican a las próximas citas." : "Define precio y duración."
        }
      >
        <form className="flex flex-col gap-6" onSubmit={handleGuardar}>
          <Input
            label="Nombre"
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
            placeholder="Ej: Corte de cabello"
            required
          />
          <Input
            label="Categoría"
            value={datos.categoria}
            onChange={(e) => setDatos({ ...datos, categoria: e.target.value })}
            placeholder="Ej: Peluquería, Barbería…"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio"
              type="number"
              min="1"
              step="0.01"
              value={datos.precio}
              onChange={(e) => setDatos({ ...datos, precio: e.target.value })}
              placeholder="20000"
              required
            />
            <Input
              label="Duración (min)"
              type="number"
              min="1"
              // Se guarda el texto crudo mientras se edita: con
              // `Number(e.target.value)` directo, borrar el campo lo
              // repintaba en 0 y había que borrar ese 0 para escribir.
              value={datos.duracion_minutos === 0 ? "" : datos.duracion_minutos}
              onChange={(e) =>
                setDatos({
                  ...datos,
                  duracion_minutos: e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
              required
            />
          </div>
          <Input
            label="% Comisión"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={datos.porcentaje_comision}
            onChange={(e) => setDatos({ ...datos, porcentaje_comision: e.target.value })}
            ayuda="Se usará para calcular comisiones cuando exista el módulo de caja."
          />

          {errorFormulario && (
            <p role="alert" className="flex items-center gap-2 font-caption text-caption text-error">
              <Icon name="error" className="text-[18px]" />
              {errorFormulario}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variante="ghost"
              onClick={() => setFormularioAbierto(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando}>
              {editando ? "Guardar cambios" : "Crear servicio"}
            </Button>
          </div>
        </form>
      </Modal>

      <ModalCatalogo
        abierto={catalogoAbierto}
        onCerrar={() => setCatalogoAbierto(false)}
        yaExistentes={servicios.map((servicio) => servicio.nombre)}
        onCreados={cargar}
      />

      <ModalConfirmacion
        abierto={porDesactivar !== null}
        titulo="¿Desactivar este servicio?"
        mensaje={`"${porDesactivar?.nombre}" dejará de estar disponible al agendar nuevas citas. Las citas ya agendadas no se ven afectadas.`}
        etiquetaConfirmar="Desactivar"
        onCancelar={() => setPorDesactivar(null)}
        onConfirmar={async () => {
          if (porDesactivar) await cambiarActivo(porDesactivar, false);
          setPorDesactivar(null);
        }}
      />
    </div>
  );
}
