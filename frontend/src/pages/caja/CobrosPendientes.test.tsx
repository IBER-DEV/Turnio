import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { apiClient } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { usePermisos } from "../../permisos/usePermisos";
import { ToastProvider } from "../../ui/Toast";
import { CobrosPendientes } from "./CobrosPendientes";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn() },
}));
vi.mock("../../permisos/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: vi.fn() }));

const GET = apiClient.GET as unknown as Mock;

/** Las capacidades de un cargo de **recepción** real: cobra y agenda,
 * pero no administra al equipo. Es el caso que rompía. */
const CAPACIDADES_RECEPCION: Record<string, boolean> = {
  puede_cobrar: true,
  puede_gestionar_agenda: true,
  puede_ver_agenda_completa: true,
};

const RESPUESTAS: Record<string, { data?: unknown; error?: unknown; status: number }> = {
  "/api/caja/ventas/": { data: [], status: 200 },
  "/api/servicios/": {
    data: [
      { id: 1, nombre: "Corte", precio: "25000.00", duracion_minutos: 30, activo: true },
    ],
    status: 200,
  },
  "/api/negocios/equipo/": {
    data: [{ id: 5, nombre: "Andrés Gómez", especialidad: "Barbero", activo: true }],
    status: 200,
  },
};

beforeEach(() => {
  GET.mockReset();
  GET.mockImplementation(async (ruta: string) => {
    const entrada = RESPUESTAS[ruta];
    // Un endpoint no configurado revienta el test con su nombre: es lo
    // que hace que llamar a `/api/negocios/empleados/` (403 para
    // recepción) falle acá en vez de silenciosamente en producción.
    if (entrada === undefined) throw new Error(`GET inesperado a ${ruta}`);
    return { data: entrada.data, error: entrada.error, response: { status: entrada.status } };
  });

  (usePermisos as unknown as Mock).mockReturnValue({
    puede: (capacidad: string) => Boolean(CAPACIDADES_RECEPCION[capacidad]),
    shell: { inicio: "/caja", navegacion: [] },
    tipo: "recepcion",
    cargando: false,
  });
  (useAuth as unknown as Mock).mockReturnValue({
    membresia: { id: 9, tipo: "recepcion" },
    cargando: false,
  });
});

describe("CobrosPendientes", () => {
  it("carga el equipo desde el directorio, que recepción sí puede leer", async () => {
    const usuario = userEvent.setup();

    render(
      <ToastProvider>
        <CobrosPendientes />
      </ToastProvider>,
    );

    await usuario.click(await screen.findByRole("button", { name: /Cuenta sin cita/ }));
    await usuario.click(await screen.findByRole("combobox", { name: /Quién lo hizo/ }));

    // El bug: se pedía `/api/negocios/empleados/`, que exige
    // `puede_gestionar_empleados` incluso para leer. Recepción recibía
    // 403 y el selector quedaba vacío — justo para quien más lo usa.
    // `CONTRATO.md` 5.4: para nombres, `/equipo/`.
    expect(await screen.findByRole("option", { name: "Andrés Gómez" })).toBeInTheDocument();
    expect(GET).toHaveBeenCalledWith("/api/negocios/equipo/");
    expect(GET).not.toHaveBeenCalledWith("/api/negocios/empleados/");
  });
});
