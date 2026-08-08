import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { useAuth } from "../auth/AuthContext";
import { RutaProtegida } from "../components/RutaProtegida";
import { usePermisos } from "../permisos/usePermisos";
import { useEstadoNegocio } from "./estadoNegocio";

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../permisos/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("./estadoNegocio", () => ({ useEstadoNegocio: vi.fn() }));

/** Capacidades de un dueño (administración): puede completar el
 * onboarding. */
const DUENO = ["puede_configurar_horarios", "puede_editar_precios", "puede_gestionar_empleados"];
/** Un barbero raso: no puede tocar ni horarios ni precios. */
const BARBERO: string[] = [];

function montar({
  capacidades,
  listo,
  cargando = false,
}: {
  capacidades: string[];
  listo: boolean;
  cargando?: boolean;
}) {
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
    cargando,
    tieneHorario: listo,
    tieneServicios: listo,
    listo,
    revalidar: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <RutaProtegida>
              <p>Panel</p>
            </RutaProtegida>
          }
        />
        <Route path="/bienvenida" element={<p>Onboarding</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("puerta del onboarding", () => {
  it("manda al onboarding cuando el negocio no puede recibir reservas", () => {
    // Sin horario ni servicios el enlace público responde 200, se ve
    // bien y no produce una sola reserva. Aterrizar en el panel sin que
    // nada lo diga era el estado muerto que esta puerta cierra.
    montar({ capacidades: DUENO, listo: false });

    expect(screen.getByText("Onboarding")).toBeInTheDocument();
  });

  it("deja pasar cuando el negocio ya está listo", () => {
    montar({ capacidades: DUENO, listo: true });

    expect(screen.getByText("Panel")).toBeInTheDocument();
  });

  it("no encierra a quien no puede completarlo", () => {
    // Un barbero no tiene `puede_configurar_horarios` ni
    // `puede_editar_precios`: mandarlo al wizard sería dejarlo en una
    // pantalla donde no puede hacer nada. El negocio incompleto es
    // problema del dueño.
    montar({ capacidades: BARBERO, listo: false });

    expect(screen.getByText("Panel")).toBeInTheDocument();
  });

  it("no decide nada mientras todavía no sabe", () => {
    // Redirigir con la respuesta en vuelo haría parpadear el onboarding
    // en cada recarga de un negocio perfectamente configurado.
    montar({ capacidades: DUENO, listo: false, cargando: true });

    expect(screen.queryByText("Onboarding")).toBeNull();
    expect(screen.queryByText("Panel")).toBeNull();
  });
});
