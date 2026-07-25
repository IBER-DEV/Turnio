import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import type { ServicioInput } from "../api/types";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";
import { Card, EstadoError, EstadoVacio, SkeletonLista } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { Modal, ModalConfirmacion } from "../ui/Modal";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";
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
  const { membresia } = useAuth();
  const { mostrar } = useToast();
  const puedeEditar = membresia?.puede_editar_precios ?? false;

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
    <div className="space-y-md">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-primary md:text-headline-lg">
            Servicios
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Administra el catálogo de servicios de tu negocio.
          </p>
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
      ) : servicios.length === 0 ? (
        <EstadoVacio
          icono="content_cut"
          titulo="Aún no tienes servicios"
          descripcion="Empieza desde el catálogo y ajusta precios a tu gusto, o crea uno desde cero."
          accion={
            puedeEditar
              ? { etiqueta: "Ver catálogo", onClick: () => setCatalogoAbierto(true) }
              : undefined
          }
          accionSecundaria={
            puedeEditar ? { etiqueta: "Crear desde cero", onClick: abrirCreacion } : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {servicios.map((servicio) => {
            const inactivo = !servicio.activo;
            return (
              <Card
                key={servicio.id}
                className={cn(
                  "animate-slide-in-bottom p-4 transition-shadow hover:shadow-card",
                  inactivo && "opacity-70",
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-high">
                    <Icon name="content_cut" className="text-primary" />
                  </span>
                  {puedeEditar && (
                    <Switch
                      label={`${servicio.activo ? "Desactivar" : "Activar"} ${servicio.nombre}`}
                      checked={servicio.activo ?? false}
                      onChange={(valor) => {
                        // Desactivar deja de ofrecerse al agendar: se
                        // confirma; activar es reversible sin fricción.
                        if (!valor) setPorDesactivar(servicio);
                        else cambiarActivo(servicio, true);
                      }}
                    />
                  )}
                </div>

                <h2
                  className={cn(
                    "font-headline-md text-body-lg font-bold text-primary",
                    inactivo && "text-on-surface-variant line-through",
                  )}
                >
                  {servicio.nombre}
                </h2>
                <p className="font-caption text-caption text-secondary">
                  {servicio.categoria || "Sin categoría"}
                </p>

                <div className="mt-3 flex items-end justify-between border-t border-outline-variant pt-3">
                  <div>
                    <p className="font-caption text-caption text-on-surface-variant">Precio</p>
                    <p className="font-label-md text-label-md text-on-surface">
                      {formatearPrecio(servicio.precio)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-caption text-caption text-on-surface-variant">Duración</p>
                    <p className="font-label-md text-label-md text-on-surface">
                      {servicio.duracion_minutos} min
                    </p>
                  </div>
                  {puedeEditar && (
                    <Button
                      variante="ghost"
                      onClick={() => abrirEdicion(servicio)}
                      aria-label={`Editar ${servicio.nombre}`}
                      className="px-2"
                    >
                      <Icon name="edit" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
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
        <form className="flex flex-col gap-md" onSubmit={handleGuardar}>
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
            <p role="alert" className="flex items-center gap-xs font-caption text-caption text-error">
              <Icon name="error" className="text-[18px]" />
              {errorFormulario}
            </p>
          )}

          <div className="flex flex-col-reverse gap-xs sm:flex-row sm:justify-end">
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
