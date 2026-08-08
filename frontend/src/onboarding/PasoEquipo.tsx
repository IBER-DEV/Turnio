import { useState } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { Button } from "../ui/Button";
import { Card } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { cn } from "../ui/cn";

type EmpleadoAlta = components["schemas"]["EmpleadoAlta"];

interface Borrador {
  nombre: string;
  email: string;
  password: string;
  especialidad: string;
}

function borradorVacio(): Borrador {
  return { nombre: "", email: "", password: "", especialidad: "" };
}

/** ¿Trabajas solo o con equipo?
 *
 * **La respuesta no se guarda en ninguna parte.** Solo decide qué pasos
 * ve la persona en este wizard y cómo se redacta el de horario. Es una
 * distinción que importa: el `CLAUDE.md` del proyecto es explícito en que
 * el operador único es el **caso n=1 del mismo diseño**, no un modo
 * aparte, y persistir un "modo solo yo" sería exactamente eso — además de
 * quedar mentiroso el día que contrate a alguien.
 *
 * Quien trabaja solo toca "Solo yo" y sigue de largo: ese es el ahorro de
 * pasos, sin que el sistema tenga que acordarse de nada.
 */
export function PasoEquipo({ onListo }: { onListo: (conEquipo: boolean) => void }) {
  const [modo, setModo] = useState<"solo" | "equipo" | null>(null);
  const [agregados, setAgregados] = useState<string[]>([]);
  const [borrador, setBorrador] = useState<Borrador>(borradorVacio());
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar() {
    setError(null);
    if (!borrador.nombre.trim() || !borrador.email.trim() || !borrador.password) {
      setError("Nombre, correo y contraseña son necesarios para que pueda entrar.");
      return;
    }

    setGuardando(true);
    const cuerpo: EmpleadoAlta = {
      nombre: borrador.nombre.trim(),
      email: borrador.email.trim(),
      password: borrador.password,
      especialidad: borrador.especialidad.trim(),
    };
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/negocios/empleados/", { body: cuerpo }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setError("No se pudo agregar. Revisa que el correo no esté usado y que la clave sea segura.");
      return;
    }
    setAgregados((actual) => [...actual, cuerpo.nombre]);
    setBorrador(borradorVacio());
  }

  if (modo === null) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onListo(false)}
          className="flex items-center gap-4 rounded-xl border border-outline-variant bg-white p-4 text-left transition-colors hover:border-menta/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-menta/10">
            <Icon name="person" className="text-[22px] text-menta" />
          </span>
          <span>
            <span className="block font-label-md text-label-md text-on-surface">Solo yo</span>
            <span className="block font-caption text-caption text-on-surface-variant">
              Atiendo yo mismo. Puedo agregar gente después.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setModo("equipo")}
          className="flex items-center gap-4 rounded-xl border border-outline-variant bg-white p-4 text-left transition-colors hover:border-menta/40"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-menta/10">
            <Icon name="group" className="text-[22px] text-menta" />
          </span>
          <span>
            <span className="block font-label-md text-label-md text-on-surface">Tengo equipo</span>
            <span className="block font-caption text-caption text-on-surface-variant">
              Cada uno con su agenda y su comisión.
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {agregados.length > 0 && (
        <ul className="flex flex-col gap-2">
          {agregados.map((nombre) => (
            <li key={nombre}>
              <Card className="flex items-center gap-3 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-completada/15">
                  <Icon name="check_circle" className="text-[18px] text-completada" />
                </span>
                <span className="font-label-md text-label-md text-on-surface">{nombre}</span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-4">
        <Input
          label="Nombre"
          value={borrador.nombre}
          onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
          placeholder="Andrés Gómez"
        />
        <Input
          label="Correo"
          type="email"
          value={borrador.email}
          onChange={(e) => setBorrador({ ...borrador, email: e.target.value })}
          placeholder="andres@correo.com"
          ayuda="Con este correo entra a la app para ver su agenda."
        />
        <Input
          label="Contraseña"
          type="password"
          value={borrador.password}
          onChange={(e) => setBorrador({ ...borrador, password: e.target.value })}
          ayuda="Se la compartes para que entre; él la puede cambiar después."
        />
        <Input
          label="Especialidad (opcional)"
          value={borrador.especialidad}
          onChange={(e) => setBorrador({ ...borrador, especialidad: e.target.value })}
          placeholder="Barbero, colorista…"
        />
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
          <Icon name="error" className="shrink-0 text-[18px]" />
          {error}
        </p>
      )}

      <div className={cn("flex flex-col gap-2 sm:flex-row")}>
        <Button variante="secondary" onClick={agregar} cargando={guardando} className="flex-1">
          Agregar a mi equipo
        </Button>
        <Button onClick={() => onListo(true)} className="flex-1" disabled={guardando}>
          {agregados.length > 0 ? "Continuar" : "Lo hago después"}
        </Button>
      </div>
    </div>
  );
}
