import { useCallback, useEffect, useState } from "react";

import { apiPublico } from "../../api/publico";
import type { Hueco, NegocioPublico, ReservaConfirmada, ServicioPublico } from "../../api/publico";
import { Button } from "../../ui/Button";
import { EstadoError, Skeleton } from "../../ui/Feedback";
import { Hoja } from "../../ui/Hoja";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { ToggleGroup, ToggleGroupItem } from "../../ui/ToggleGroup";
import { variablesDeTema } from "../../tema/colores";

/** El mensaje que ya devuelve el backend para `SinDisponibilidad`
 * (`apps/publico/views.py`, `ReservarView.post`) — deliberadamente
 * genérico, sin distinguir "se acaba de ocupar" de "nunca estuvo
 * disponible". Se repite el mismo texto acá en vez de parsear el cuerpo
 * del 400: con datos ya validados en el cliente, esa es la única causa
 * realista de un error en este endpoint. */
const MENSAJE_HUECO_OCUPADO = "Ese horario ya no está disponible. Elige otro.";
const MENSAJE_SIN_CONEXION = "No se pudo conectar. Revisa tu internet e intenta de nuevo.";

function hoyISO(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function formatearHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

type EstadoHuecos =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; huecos: Hueco[] };

type EstadoEnvio =
  | { tipo: "inactivo" }
  | { tipo: "enviando" }
  | { tipo: "error"; mensaje: string }
  | { tipo: "confirmada"; datos: ReservaConfirmada };

export function ReservaHoja({
  negocio,
  servicio,
  onCerrar,
}: {
  negocio: NegocioPublico;
  servicio: ServicioPublico;
  onCerrar: () => void;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [huecos, setHuecos] = useState<EstadoHuecos>({ tipo: "cargando" });
  const [horaElegida, setHoraElegida] = useState("");
  const [profesionalId, setProfesionalId] = useState("cualquiera");
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [notas, setNotas] = useState("");
  const [envio, setEnvio] = useState<EstadoEnvio>({ tipo: "inactivo" });

  // La hoja vive en un portal colgado del `body`, fuera del árbol del
  // perfil: el color del negocio hay que volver a declararlo acá o esta
  // sería la única pantalla del flujo con el color de Turnio.
  const tema = variablesDeTema(negocio.color_acento);

  const cargarHuecos = useCallback(async () => {
    setHuecos({ tipo: "cargando" });
    const { data, error } = await apiPublico.GET("/api/publico/negocios/{slug}/disponibilidad/", {
      params: { path: { slug: negocio.slug }, query: { servicio: servicio.id, fecha } },
    });
    setHuecos(error || !data ? { tipo: "error" } : { tipo: "listo", huecos: data });
  }, [fecha, servicio.id, negocio.slug]);

  useEffect(() => {
    setHoraElegida("");
    let cancelado = false;
    cargarHuecos().catch(() => {
      if (!cancelado) setHuecos({ tipo: "error" });
    });
    return () => {
      cancelado = true;
    };
  }, [cargarHuecos]);

  async function reservar() {
    if (!horaElegida) return;
    setEnvio({ tipo: "enviando" });
    try {
      const { data, error } = await apiPublico.POST("/api/publico/negocios/{slug}/reservar/", {
        params: { path: { slug: negocio.slug } },
        body: {
          servicio: servicio.id,
          fecha_hora_inicio: horaElegida,
          nombre_cliente: nombreCliente.trim(),
          telefono_cliente: telefonoCliente.trim(),
          empleado: profesionalId === "cualquiera" ? null : Number(profesionalId),
          notas: notas.trim(),
        },
      });

      if (error || !data) {
        setEnvio({ tipo: "error", mensaje: MENSAJE_HUECO_OCUPADO });
        // El hueco que se acaba de perder no debe seguir apareciendo.
        await cargarHuecos();
        return;
      }

      setEnvio({ tipo: "confirmada", datos: data });
    } catch {
      setEnvio({ tipo: "error", mensaje: MENSAJE_SIN_CONEXION });
    }
  }

  if (envio.tipo === "confirmada") {
    const { datos } = envio;
    return (
      <Hoja
        abierta
        titulo="¡Listo!"
        descripcion="Tu cita quedó confirmada."
        onCerrar={onCerrar}
        style={tema}
      >
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-completada/10">
            <Icon name="event_available" className="text-[32px] text-completada" />
          </span>
          <div>
            <p className="font-headline-md text-headline-md text-primary">{datos.negocio}</p>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              {datos.servicio} con {datos.profesional}
            </p>
            <p className="mt-1 font-label-md text-label-md text-on-surface">
              {new Date(datos.fecha_hora_inicio).toLocaleString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <p className="font-caption text-caption text-on-surface-variant">
            Guardado a nombre de {datos.nombre_cliente}. Si necesitas cambiar algo, contacta al
            negocio directamente — todavía no hay cancelación en línea.
          </p>
          <Button anchoCompleto onClick={onCerrar}>
            Listo
          </Button>
        </div>
      </Hoja>
    );
  }

  const enviando = envio.tipo === "enviando";
  const puedeConfirmar = horaElegida !== "" && nombreCliente.trim() !== "" && telefonoCliente.trim() !== "";

  return (
    <Hoja
      abierta
      titulo="Reservar"
      descripcion={`${servicio.nombre} · ${negocio.nombre}`}
      onCerrar={onCerrar}
      style={tema}
    >
      <div className="flex flex-col gap-6">
        <Input
          label="Fecha"
          type="date"
          value={fecha}
          min={hoyISO()}
          onChange={(evento) => setFecha(evento.target.value)}
        />

        <div>
          <p className="mb-2 font-label-md text-label-md text-on-surface">Hora</p>
          {huecos.tipo === "cargando" && (
            <div className="flex gap-2">
              <Skeleton className="h-10 w-16 rounded-full" />
              <Skeleton className="h-10 w-16 rounded-full" />
              <Skeleton className="h-10 w-16 rounded-full" />
            </div>
          )}
          {huecos.tipo === "error" && (
            <EstadoError
              mensaje="No se pudieron cargar las horas disponibles."
              onReintentar={() => {
                cargarHuecos().catch(() => setHuecos({ tipo: "error" }));
              }}
            />
          )}
          {huecos.tipo === "listo" && huecos.huecos.length === 0 && (
            <p className="font-body-md text-body-md text-on-surface-variant">
              Sin horas disponibles ese día. Prueba otra fecha.
            </p>
          )}
          {huecos.tipo === "listo" && huecos.huecos.length > 0 && (
            <ToggleGroup valor={horaElegida} onChange={setHoraElegida}>
              {huecos.huecos.map((hueco) => (
                <ToggleGroupItem key={hueco.inicio} value={hueco.inicio}>
                  {formatearHora(hueco.inicio)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>

        {negocio.profesionales.length > 0 && (
          <div>
            <p className="mb-2 font-label-md text-label-md text-on-surface">Con quién (opcional)</p>
            <ToggleGroup valor={profesionalId} onChange={setProfesionalId}>
              <ToggleGroupItem value="cualquiera">Cualquiera disponible</ToggleGroupItem>
              {negocio.profesionales.map((profesional) => (
                <ToggleGroupItem key={profesional.id} value={String(profesional.id)}>
                  {profesional.nombre}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        <Input
          label="Tu nombre"
          value={nombreCliente}
          onChange={(evento) => setNombreCliente(evento.target.value)}
          placeholder="Nombre y apellido"
        />
        <Input
          label="Tu teléfono"
          type="tel"
          value={telefonoCliente}
          onChange={(evento) => setTelefonoCliente(evento.target.value)}
          placeholder="300 000 0000"
          ayuda="Por si el negocio necesita confirmar algo contigo."
        />
        <Input
          label="Notas (opcional)"
          value={notas}
          onChange={(evento) => setNotas(evento.target.value)}
          placeholder="Ej. primera vez, alguna preferencia…"
        />

        {envio.tipo === "error" && (
          <p role="alert" className="flex items-center gap-2 font-caption text-caption text-error">
            <Icon name="error" className="text-[18px]" />
            {envio.mensaje}
          </p>
        )}

        {/* Con el color del negocio, no el de Turnio: la hoja se abre
            dentro del contenedor tematizado del perfil (ver
            `PerfilNegocioPage`) y este es el botón que remata la reserva. */}
        <Button
          variante="negocio"
          anchoCompleto
          disabled={!puedeConfirmar}
          cargando={enviando}
          onClick={reservar}
        >
          Confirmar reserva
        </Button>
      </div>
    </Hoja>
  );
}
