import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { usePermisos } from "../permisos/usePermisos";
import { ToastProvider } from "../ui/Toast";
import { AgendaPage } from "./AgendaPage";

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../permisos/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("../api/client", () => ({ apiClient: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() } }));

function Sonda() {
  const { search } = useLocation();
  return <p>consulta: {search || "(vacía)"}</p>;
}

function montar({ capacidades, ruta }: { capacidades: string[]; ruta: string }) {
  (useAuth as unknown as Mock).mockReturnValue({
    membresia: { id: 1, nombre: "Ana Ruiz", negocio: { nombre: "Barbería Ana" } },
  });
  (usePermisos as unknown as Mock).mockReturnValue({
    puede: (capacidad: string) => capacidades.includes(capacidad),
    shell: { inicio: "/", navegacion: [] },
    tipo: "administracion",
    cargando: false,
  });
  // Agenda vacía: alcanza para que la pantalla monte. Lo que se prueba
  // acá es la reacción al parámetro de la URL, no el listado.
  // `response` no es opcional: `conReintentoDeAuth` mira su `status` para
  // decidir si toca refrescar el token.
  (apiClient.GET as unknown as Mock).mockResolvedValue({
    data: [],
    error: undefined,
    response: { status: 200 },
  });

  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route
          path="/agenda"
          element={
            <ToastProvider>
              <Sonda />
              <AgendaPage />
            </ToastProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agendar desde otra pantalla (?nueva=1)", () => {
  it("abre el formulario y consume el parámetro", async () => {
    montar({ capacidades: ["puede_gestionar_agenda"], ruta: "/agenda?nueva=1" });

    expect(await screen.findByRole("dialog", { name: /agendar cita/i })).toBeInTheDocument();
    // Consumido: si se quedara en la URL, cerrar el formulario y recargar
    // lo volvería a abrir solo.
    await waitFor(() => expect(screen.getByText("consulta: (vacía)")).toBeInTheDocument());
  });

  it("ignora la señal de quien no puede gestionar la agenda", async () => {
    montar({ capacidades: [], ruta: "/agenda?nueva=1" });

    await waitFor(() => expect(screen.getByText("consulta: (vacía)")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
