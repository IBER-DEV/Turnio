import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { apiClient } from "../api/client";
import { cuerpoMultipart } from "../api/multipart";
import type { components } from "../api/schema";
import { useAuth } from "../auth/AuthContext";
import { conReintentoDeAuth } from "../auth/refresh";
import { CATALOGO_PLANTILLAS } from "../tema/plantillas";
import { SelectorColor } from "./negocio/SelectorColor";
import { Button } from "../ui/Button";
import { Card, EstadoError, Skeleton } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { ModalConfirmacion } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { cn } from "../ui/cn";

type MiNegocio = components["schemas"]["MiNegocio"];
type PatchedMiNegocio = components["schemas"]["PatchedMiNegocio"];
type FotoNegocio = components["schemas"]["FotoNegocio"];

/** Los mismos límites que aplica el backend (`CONTRATO.md` 5.12).
 *
 * Duplicados acá **a propósito**: el backend sigue siendo quien decide
 * —esto no es la validación, es la cortesía de no hacerle subir 8 MB por
 * datos móviles a alguien para después decirle que no. Si cambian allá,
 * cambian acá. */
const MAX_FOTOS = 10;
const MAX_MB = 5;

/** Los datos de texto de la ficha, que se editan como un formulario. */
type Datos = Pick<MiNegocio, "nombre" | "ciudad" | "direccion" | "telefono">;

function datosDe(negocio: MiNegocio): Datos {
  return {
    nombre: negocio.nombre,
    ciudad: negocio.ciudad ?? "",
    direccion: negocio.direccion ?? "",
    telefono: negocio.telefono ?? "",
  };
}

function pesaDemasiado(archivo: File): boolean {
  return archivo.size > MAX_MB * 1024 * 1024;
}

export function ConfiguracionNegocioPage() {
  const { mostrar } = useToast();
  const { refrescarMembresia } = useAuth();

  const [negocio, setNegocio] = useState<MiNegocio | null>(null);
  const [fotos, setFotos] = useState<FotoNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [datos, setDatos] = useState<Datos | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [reordenando, setReordenando] = useState(false);
  const [fotoPorBorrar, setFotoPorBorrar] = useState<FotoNegocio | null>(null);
  const [quitandoLogo, setQuitandoLogo] = useState(false);
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [quitandoPortada, setQuitandoPortada] = useState(false);
  const [cambiandoTema, setCambiandoTema] = useState(false);
  const [colorAbierto, setColorAbierto] = useState(false);
  const [guardandoColor, setGuardandoColor] = useState(false);

  const inputLogo = useRef<HTMLInputElement>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputPortada = useRef<HTMLInputElement>(null);

  async function cargar() {
    setCargando(true);
    setError(false);
    const [ficha, galeria] = await Promise.all([
      conReintentoDeAuth(() => apiClient.GET("/api/negocios/mi-negocio/")),
      conReintentoDeAuth(() => apiClient.GET("/api/negocios/mi-negocio/fotos/")),
    ]);

    if (ficha.error || !ficha.data) {
      setError(true);
    } else {
      setNegocio(ficha.data);
      setDatos(datosDe(ficha.data));
      setFotos(galeria.data ?? []);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleGuardarDatos(evento: FormEvent) {
    evento.preventDefault();
    if (!datos) return;
    setGuardando(true);

    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/negocios/mi-negocio/", { body: datos }),
    );
    setGuardando(false);

    if (errorRespuesta || !data) {
      mostrar("error", "No pudimos guardar los cambios. Revisa los datos e intenta de nuevo.");
      return;
    }

    setNegocio(data);
    setDatos(datosDe(data));
    mostrar("exito", "Datos actualizados.");
    // El nombre del negocio se ve en la cabecera y en la barra lateral:
    // sin esto, quien lo cambia sigue viendo el viejo hasta recargar.
    await refrescarMembresia();
  }

  /** Sube el logo o la portada: son el mismo flujo sobre distinto campo.
   *
   * `etiqueta` viaja solo para los mensajes — el usuario no piensa en
   * "campos", piensa en "mi logo" y "mi portada". */
  async function subirImagen(
    campo: "logo" | "portada",
    etiqueta: string,
    evento: ChangeEvent<HTMLInputElement>,
    marcarSubiendo: (subiendo: boolean) => void,
  ) {
    const archivo = evento.target.files?.[0];
    // El input se limpia siempre: si no, elegir el mismo archivo dos
    // veces seguidas (por ejemplo tras un error) no dispara `change`.
    evento.target.value = "";
    if (!archivo) return;

    if (pesaDemasiado(archivo)) {
      mostrar("error", `Esa imagen pesa más de ${MAX_MB} MB. Elige una más liviana.`);
      return;
    }

    marcarSubiendo(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/negocios/mi-negocio/", {
        body: cuerpoMultipart<PatchedMiNegocio>({ [campo]: archivo }),
      }),
    );
    marcarSubiendo(false);

    if (errorRespuesta || !data) {
      mostrar("error", `No pudimos subir ${etiqueta}. Intenta con otra imagen.`);
      return;
    }
    setNegocio(data);
    mostrar("exito", "Imagen actualizada.");
  }

  async function quitarImagen(
    campo: "logo" | "portada",
    etiqueta: string,
    marcarQuitando: (quitando: boolean) => void,
  ) {
    marcarQuitando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/negocios/mi-negocio/", { body: { [campo]: null } }),
    );
    marcarQuitando(false);

    if (errorRespuesta || !data) {
      mostrar("error", `No pudimos quitar ${etiqueta}.`);
      return;
    }
    setNegocio(data);
    mostrar("exito", `Quitamos ${etiqueta}.`);
  }

  /** Cambia el tema o el color. Se guarda al instante, sin botón: son
   * decisiones que se toman mirando el resultado, y obligar a confirmar
   * cada prueba haría que nadie pruebe. */
  async function guardarApariencia(
    cambio: Pick<PatchedMiNegocio, "tema"> | Pick<PatchedMiNegocio, "color_acento">,
    marcarGuardando: (guardando: boolean) => void,
  ) {
    marcarGuardando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/negocios/mi-negocio/", { body: cambio }),
    );
    marcarGuardando(false);

    if (errorRespuesta || !data) {
      mostrar("error", "No pudimos guardar el cambio.");
      return false;
    }
    setNegocio(data);
    return true;
  }

  async function handleFoto(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;

    if (pesaDemasiado(archivo)) {
      mostrar("error", `Esa imagen pesa más de ${MAX_MB} MB. Elige una más liviana.`);
      return;
    }

    setSubiendoFoto(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/negocios/mi-negocio/fotos/", {
        body: cuerpoMultipart<FotoNegocio>({ imagen: archivo }),
      }),
    );
    setSubiendoFoto(false);

    if (errorRespuesta || !data) {
      mostrar("error", "No pudimos subir la foto. Intenta con otra imagen.");
      return;
    }
    setFotos((actuales) => [...actuales, data]);
    mostrar("exito", "Foto agregada.");
  }

  async function borrarFoto(foto: FotoNegocio) {
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.DELETE("/api/negocios/mi-negocio/fotos/{id}/", {
        params: { path: { id: foto.id } },
      }),
    );

    if (errorRespuesta) {
      mostrar("error", "No pudimos borrar la foto.");
      return;
    }
    setFotos((actuales) => actuales.filter((otra) => otra.id !== foto.id));
    mostrar("exito", "Foto eliminada.");
  }

  /** Mueve una foto un lugar en el carrusel.
   *
   * El endpoint recibe la galería **completa** en orden (ver
   * `CONTRATO.md` 5.12), así que acá se arma la lista entera y se manda
   * de una: no hay un "mover esta foto" del lado del backend. */
  async function mover(indice: number, desplazamiento: number) {
    const destino = indice + desplazamiento;
    if (destino < 0 || destino >= fotos.length) return;

    const movida = fotos[indice];
    if (!movida) return;
    const reordenadas = [...fotos];
    reordenadas.splice(indice, 1);
    reordenadas.splice(destino, 0, movida);

    // Optimista: arrastrar fotos y esperar un request por cada golpe se
    // siente roto. Si el backend rechaza, se recarga desde el servidor.
    const previas = fotos;
    setFotos(reordenadas);
    setReordenando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PUT("/api/negocios/mi-negocio/fotos/orden/", {
        body: { ids: reordenadas.map((foto) => foto.id) },
      }),
    );
    setReordenando(false);

    if (errorRespuesta || !data) {
      setFotos(previas);
      mostrar("error", "No pudimos guardar el orden.");
      return;
    }
    setFotos(data);
  }

  if (cargando) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !negocio || !datos) {
    return (
      <EstadoError
        mensaje="No pudimos cargar los datos de tu negocio. Revisa tu conexión."
        onReintentar={cargar}
      />
    );
  }

  const enlacePublico = `${window.location.origin}/${negocio.slug}`;

  return (
    <div className="space-y-8">
      {/* El título ya lo muestra la TopAppBar de escritorio (Layout.tsx,
          etiqueta "Perfil del negocio"); acá solo se repite en mobile. */}
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 lg:hidden">
          Configuración del Perfil
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Personaliza la apariencia y los datos públicos de tu negocio.
        </p>
      </header>

      {/* El enlace público ya no vive en su propia tarjeta: la acción de
          verlo se mudó acá, junto a donde se elige cómo se ve — a pedido
          del humano, que la encontró más premium y más fiel al mockup.
          Copiarlo se queda como ícono compacto al lado: perderlo del
          todo habría sido una regresión de una acción real (compartir el
          enlace por WhatsApp), no solo un ajuste de estilo. */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Diseño de tu página</h2>
          <div className="flex shrink-0 items-center gap-2">
            <span className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
              Visualización en vivo
            </span>
            <button
              type="button"
              aria-label="Copiar enlace público"
              onClick={async () => {
                await navigator.clipboard.writeText(enlacePublico);
                mostrar("exito", "Enlace copiado.");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon name="share" className="text-[18px]" />
            </button>
            <Button
              variante="secondary"
              tamano="sm"
              icono="visibility"
              onClick={() => window.open(`/${negocio.slug}`, "_blank", "noopener")}
            >
              Vista previa
            </Button>
          </div>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {CATALOGO_PLANTILLAS.map((plantilla) => {
            const elegida = negocio.tema === plantilla.id;
            return (
              <li key={plantilla.id}>
                <button
                  type="button"
                  disabled={cambiandoTema}
                  aria-pressed={elegida}
                  onClick={async () => {
                    if (elegida) return;
                    const ok = await guardarApariencia({ tema: plantilla.id }, setCambiandoTema);
                    if (ok) mostrar("exito", `Diseño ${plantilla.nombre} aplicado.`);
                  }}
                  className={cn(
                    "w-full overflow-hidden rounded-xl bg-white text-left transition-all disabled:opacity-60",
                    elegida
                      ? "border-2 border-emerald-500"
                      : "border border-slate-200 hover:border-emerald-300",
                  )}
                >
                  <img
                    src={plantilla.portadaMuestra}
                    alt=""
                    loading="lazy"
                    className="h-32 w-full object-cover"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{plantilla.nombre}</h3>
                      {elegida && (
                        <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          Seleccionado
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{plantilla.descripcion}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Card className="p-6 md:p-8">
        <form className="flex flex-col gap-6" onSubmit={handleGuardarDatos}>
          <h2 className="text-lg font-bold text-slate-900">Detalles del Negocio</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Input
              label="Nombre Comercial"
              value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              required
            />
            <Input
              label="Ciudad"
              value={datos.ciudad ?? ""}
              onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })}
              placeholder="Ej: Medellín"
            />
            <Input
              label="Teléfono"
              type="tel"
              value={datos.telefono ?? ""}
              onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
              placeholder="3001112233"
            />
            <Input
              label="Dirección Física"
              value={datos.direccion ?? ""}
              onChange={(e) => setDatos({ ...datos, direccion: e.target.value })}
              placeholder="Ej: Cra 45 #10-20"
              icono="location_on"
              ayuda="Aparece en tu perfil público para que tus clientes te ubiquen."
            />
          </div>
          <div className="flex justify-end border-t border-slate-100 pt-5">
            <Button type="submit" cargando={guardando}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-label-md text-label-md text-on-surface">Color de tu negocio</h2>
        <button
          type="button"
          onClick={() => setColorAbierto(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-outline-variant px-4 py-3 text-left transition-colors hover:border-menta/40"
        >
          <span
            className="h-8 w-8 shrink-0 rounded-full border border-outline-variant"
            style={{ backgroundColor: negocio.color_acento || undefined }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block font-label-md text-label-md text-on-surface">
              {negocio.color_acento || "Color de Turnio"}
            </span>
            <span className="block font-caption text-caption text-on-surface-variant">
              Pinta los botones y los detalles de tu página
            </span>
          </span>
          <Icon name="chevron_right" className="shrink-0 text-outline" />
        </button>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-label-md text-label-md text-on-surface">Logo</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low">
            {negocio.logo ? (
              <img
                src={negocio.logo}
                alt={`Logo de ${negocio.nombre}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Icon name="storefront" className="text-[28px] text-outline" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variante="secondary"
                tamano="sm"
                icono="add_photo_alternate"
                cargando={subiendoLogo}
                onClick={() => inputLogo.current?.click()}
              >
                {negocio.logo ? "Cambiar" : "Subir logo"}
              </Button>
              {negocio.logo && (
                <Button
                  variante="ghost"
                  tamano="sm"
                  icono="delete"
                  cargando={quitandoLogo}
                  onClick={() => quitarImagen("logo", "el logo", setQuitandoLogo)}
                >
                  Quitar
                </Button>
              )}
            </div>
            <p className="font-caption text-caption text-on-surface-variant">
              Cuadrado se ve mejor. Máximo {MAX_MB} MB.
            </p>
          </div>
          <input
            ref={inputLogo}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(evento) => subirImagen("logo", "el logo", evento, setSubiendoLogo)}
            aria-label="Elegir archivo de logo"
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-label-md text-label-md text-on-surface">Portada</h2>
        <p className="mb-4 font-caption text-caption text-on-surface-variant">
          La imagen ancha del encabezado. Es también la que se ve al compartir tu enlace por
          WhatsApp, así que conviene una foto del local.
        </p>
        <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
          {negocio.portada ? (
            <img
              src={negocio.portada}
              alt={`Portada de ${negocio.nombre}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <Icon name="add_photo_alternate" className="text-[32px] text-outline" />
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variante="secondary"
            tamano="sm"
            icono="add_photo_alternate"
            cargando={subiendoPortada}
            onClick={() => inputPortada.current?.click()}
          >
            {negocio.portada ? "Cambiar portada" : "Subir portada"}
          </Button>
          {negocio.portada && (
            <Button
              variante="ghost"
              tamano="sm"
              icono="delete"
              cargando={quitandoPortada}
              onClick={() => quitarImagen("portada", "la portada", setQuitandoPortada)}
            >
              Quitar
            </Button>
          )}
        </div>
        <input
          ref={inputPortada}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(evento) => subirImagen("portada", "la portada", evento, setSubiendoPortada)}
          aria-label="Elegir imagen de portada"
        />
      </Card>

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="font-label-md text-label-md text-on-surface">Fotos del local</h2>
          <span className="font-caption text-caption text-on-surface-variant">
            {fotos.length} de {MAX_FOTOS}
          </span>
        </div>
        <p className="mb-4 font-caption text-caption text-on-surface-variant">
          La primera es la que se ve más grande. Muestra el local y algunos trabajos.
        </p>

        {fotos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant px-6 py-8 text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              Todavía no tienes fotos publicadas.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {fotos.map((foto, indice) => (
              <li
                key={foto.id}
                className="group relative overflow-hidden rounded-xl border border-outline-variant"
              >
                <img
                  src={foto.imagen}
                  alt={`Foto ${indice + 1} de ${negocio.nombre}`}
                  className="aspect-square w-full object-cover"
                />
                {indice === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Portada
                  </span>
                )}
                <div className="flex items-center justify-between gap-1 border-t border-outline-variant bg-white px-1 py-1">
                  <div className="flex">
                    <button
                      type="button"
                      disabled={indice === 0 || reordenando}
                      onClick={() => mover(indice, -1)}
                      aria-label={`Mover la foto ${indice + 1} hacia atrás`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-30"
                    >
                      <Icon name="chevron_left" className="text-[20px]" />
                    </button>
                    <button
                      type="button"
                      disabled={indice === fotos.length - 1 || reordenando}
                      onClick={() => mover(indice, 1)}
                      aria-label={`Mover la foto ${indice + 1} hacia adelante`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-30"
                    >
                      <Icon name="chevron_right" className="text-[20px]" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFotoPorBorrar(foto)}
                    aria-label={`Borrar la foto ${indice + 1}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-error transition-colors hover:bg-error/10"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variante="secondary"
            icono="add_photo_alternate"
            cargando={subiendoFoto}
            disabled={fotos.length >= MAX_FOTOS}
            onClick={() => inputFoto.current?.click()}
          >
            Agregar foto
          </Button>
          {fotos.length >= MAX_FOTOS && (
            <p className="font-caption text-caption text-on-surface-variant">
              Llegaste al máximo. Borra alguna para subir otra.
            </p>
          )}
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFoto}
            aria-label="Elegir foto del local"
          />
        </div>
      </Card>

      {colorAbierto && (
        <SelectorColor
          abierto
          colorActual={negocio.color_acento ?? ""}
          guardando={guardandoColor}
          onCerrar={() => setColorAbierto(false)}
          onGuardar={async (color) => {
            const ok = await guardarApariencia({ color_acento: color }, setGuardandoColor);
            if (ok) {
              setColorAbierto(false);
              mostrar("exito", color ? "Color actualizado." : "Volviste al color de Turnio.");
            }
          }}
        />
      )}

      <ModalConfirmacion
        abierto={fotoPorBorrar !== null}
        titulo="¿Borrar esta foto?"
        mensaje="Desaparece de tu perfil público de inmediato. No se puede deshacer."
        etiquetaConfirmar="Borrar"
        onCancelar={() => setFotoPorBorrar(null)}
        onConfirmar={async () => {
          if (fotoPorBorrar) await borrarFoto(fotoPorBorrar);
          setFotoPorBorrar(null);
        }}
      />
    </div>
  );
}
