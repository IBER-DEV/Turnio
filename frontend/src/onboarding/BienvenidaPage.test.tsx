import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { usePermisos } from "../permisos/usePermisos";
import { ToastProvider } from "../ui/Toast";
import { BienvenidaPage } from "./BienvenidaPage";
import { useEstadoNegocio } from "./estadoNegocio";

vi.mock("../api/client", () => ({ apiClient: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() } }));
vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../permisos/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("./estadoNegocio", () => ({ useEstadoNegocio: vi.fn() }));

const POST = apiClient.POST as unknown as Mock;
const PUT = apiClient.PUT as unknown as Mock;
const revalidar = vi.fn();

function montar(capacidades: string[] = ["puede_gestionar_empleados"]) {
  (useAuth as unknown as Mock).mockReturnValue({
    cargando: false,
    membresia: { id: 1, negocio: { slug: "mi-negocio" } },
  });
  (usePermisos as unknown as Mock).mockReturnValue({
    puede: (capacidad: string) => capacidades.includes(capacidad),
    shell: { inicio: "/", navegacion: [] },
    tipo: "administracion",
    cargando: false,
  });
  (useEstadoNegocio as unknown as Mock).mockReturnValue({
    cargando: false,
    tieneHorario: false,
    tieneServicios: false,
    listo: false,
    revalidar,
  });

  return render(
    <MemoryRouter>
      <ToastProvider>
        <BienvenidaPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  PUT.mockResolvedValue({ data: [], error: undefined, response: { status: 200 } });
  POST.mockResolvedValue({ data: [], error: undefined, response: { status: 201 } });
});

describe("BienvenidaPage", () => {
  it('"Solo yo" no guarda ningún modo: solo salta el paso de equipo', async () => {
    // El operador único es el caso n=1 del mismo diseño, no un modo
    // (ver `CLAUDE.md`). Persistirlo quedaría mentiroso el día que
    // contrate a alguien, y haría que el sistema se comporte distinto
    // según una respuesta de un formulario que nadie vuelve a mirar.
    const usuario = montar() && userEvent.setup();

    await usuario.click(screen.getByRole("button", { name: /Solo yo/ }));

    expect(await screen.findByText("¿Cuándo abres?")).toBeInTheDocument();
    // Ni un solo request salió de elegir "solo yo".
    expect(POST).not.toHaveBeenCalled();
    expect(PUT).not.toHaveBeenCalled();
  });

  it("guarda el horario al terminar ese paso, no todo al final", async () => {
    // Quien abandona a la mitad conserva lo que ya hizo. Guardar todo al
    // final haría que cerrar la pestaña en el paso 3 tirara los dos
    // primeros.
    const usuario = montar() && userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: /Solo yo/ }));

    await usuario.click(await screen.findByRole("button", { name: "Continuar" }));

    expect(PUT).toHaveBeenCalledWith(
      "/api/agenda/horario-negocio/",
      expect.objectContaining({
        body: expect.objectContaining({
          franjas: expect.arrayContaining([
            expect.objectContaining({ hora_inicio: "09:00", hora_fin: "19:00" }),
          ]),
        }),
      }),
    );
    expect(revalidar).toHaveBeenCalled();
  });

  it("sin permiso para gestionar equipo, ese paso no existe", () => {
    // Alguien que puede configurar el local pero no dar de alta gente no
    // debería ver un paso que no puede completar.
    montar([]);

    expect(screen.getByText("¿Cuándo abres?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Solo yo/ })).toBeNull();
  });

  it("el horario exige al menos un día", async () => {
    const usuario = montar([]) && userEvent.setup();

    for (const dia of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]) {
      await usuario.click(screen.getByRole("button", { name: dia }));
    }
    await usuario.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("Marca al menos un día de atención.")).toBeInTheDocument();
    expect(PUT).not.toHaveBeenCalled();
  });
});
