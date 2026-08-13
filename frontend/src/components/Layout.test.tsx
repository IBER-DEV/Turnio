import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { useAuth } from "../auth/AuthContext";
import { usePermisos } from "../permisos/usePermisos";
import { Layout } from "./Layout";

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../permisos/usePermisos", () => ({ usePermisos: vi.fn() }));

const NAVEGACION = [
  { to: "/", etiqueta: "Inicio", icono: "dashboard" },
  { to: "/agenda", etiqueta: "Agenda", icono: "calendar_today" },
  { to: "/caja", etiqueta: "Caja", icono: "point_of_sale" },
  { to: "/servicios", etiqueta: "Servicios", icono: "content_cut" },
];

/** Muestra la URL actual para poder afirmar a dónde llevó un toque. */
function Sonda() {
  const { pathname, search } = useLocation();
  return <p>ruta: {pathname + search}</p>;
}

function montar({ capacidades, ruta = "/" }: { capacidades: string[]; ruta?: string }) {
  (useAuth as unknown as Mock).mockReturnValue({
    membresia: { nombre: "Ana Ruiz", email: "ana@x.co", negocio: { nombre: "Barbería Ana" } },
    logout: vi.fn(),
  });
  (usePermisos as unknown as Mock).mockReturnValue({
    puede: (capacidad: string) => capacidades.includes(capacidad),
    shell: { inicio: "/", navegacion: NAVEGACION },
    tipo: "administracion",
    cargando: false,
  });

  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="*" element={<Layout><Sonda /></Layout>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("barra inferior de móvil", () => {
  it("lleva a agendar desde cualquier pantalla con la señal que abre el formulario", async () => {
    montar({ capacidades: ["puede_gestionar_agenda"], ruta: "/caja" });

    await userEvent.click(screen.getByRole("button", { name: "Agendar cita" }));

    // `?nueva=1` es el contrato con `AgendaPage`: si se renombra acá sin
    // renombrarlo allá, el botón navega y no pasa nada más — un fallo
    // silencioso que ninguna otra prueba detecta.
    expect(screen.getByText("ruta: /agenda?nueva=1")).toBeInTheDocument();
  });

  it("no ofrece agendar a quien no puede gestionar la agenda", () => {
    montar({ capacidades: [] });

    expect(screen.queryByRole("button", { name: "Agendar cita" })).not.toBeInTheDocument();
  });
});

describe("cabecera de móvil", () => {
  it("cede el borde superior a la portada en Inicio y vuelve en el resto", () => {
    const { unmount } = montar({ capacidades: [], ruta: "/" });
    // En Inicio la cabecera existe en el DOM pero está oculta: la portada
    // del Dashboard lleva su propio saludo y su propio menú de cuenta.
    expect(screen.getAllByRole("banner")[0]).toHaveClass("hidden");
    unmount();

    montar({ capacidades: [], ruta: "/caja" });
    expect(screen.getAllByRole("banner")[0]).toHaveClass("flex");
  });
});
