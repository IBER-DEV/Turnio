import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { apiPublico } from "../../api/publico";
import { ToastProvider } from "../../ui/Toast";
import { PerfilNegocioPage } from "./PerfilNegocioPage";

vi.mock("../../api/publico", () => ({
  apiPublico: { GET: vi.fn(), POST: vi.fn() },
}));

const GET = apiPublico.GET as unknown as Mock;
const POST = apiPublico.POST as unknown as Mock;

const NEGOCIO = {
  slug: "barberia-castro",
  nombre: "Barbería Castro",
  ciudad: "Medellín",
  direccion: "Cra 45 #10-20",
  telefono: "3001234567",
  servicios: [
    {
      id: 1,
      nombre: "Corte clásico",
      descripcion: "",
      categoria: "",
      precio: "25000",
      duracion_minutos: 30,
    },
  ],
  profesionales: [{ id: 9, nombre: "Andrés Gómez", especialidad: "Fades" }],
  horario: [{ dia_semana: 0, hora_inicio: "09:00:00", hora_fin: "18:00:00" }],
};

/** Cada test decide qué responde `GET` según la ruta pedida — la misma
 * página dispara el perfil y (al abrir la hoja) la disponibilidad. */
function mockearGet(respuestas: Record<string, unknown>) {
  GET.mockImplementation(async (ruta: string) => {
    const entrada = respuestas[ruta];
    if (entrada === undefined) throw new Error(`GET no configurado para ${ruta}`);
    return entrada;
  });
}

function renderPerfil(slug = "barberia-castro") {
  return render(
    <MemoryRouter initialEntries={[`/${slug}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/:slug" element={<PerfilNegocioPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  GET.mockReset();
  POST.mockReset();
});

describe("PerfilNegocioPage", () => {
  it("muestra los datos reales del negocio: servicios, equipo y horario", async () => {
    mockearGet({ "/api/publico/negocios/{slug}/": { data: NEGOCIO, error: undefined } });

    renderPerfil();

    expect(await screen.findByRole("heading", { name: "Barbería Castro" })).toBeInTheDocument();
    expect(screen.getByText(/Medellín/)).toBeInTheDocument();
    expect(screen.getByText("Corte clásico")).toBeInTheDocument();
    expect(screen.getByText(/\$\s?25\.000|25,000/)).toBeInTheDocument();
    expect(screen.getByText("Andrés Gómez")).toBeInTheDocument();
    expect(screen.getByText("Lunes")).toBeInTheDocument();
    expect(screen.getByText("09:00–18:00")).toBeInTheDocument();
  });

  it("un negocio que no existe o está inactivo muestra el error, no un 404 en blanco", async () => {
    mockearGet({
      "/api/publico/negocios/{slug}/": { data: undefined, error: { detail: "No encontrado." } },
    });

    renderPerfil("no-existe");

    expect(
      await screen.findByText(/Este negocio no existe o ya no está activo/),
    ).toBeInTheDocument();
  });

  it("catálogo vacío ofrece el estado vacío, no una lista en blanco", async () => {
    mockearGet({
      "/api/publico/negocios/{slug}/": {
        data: { ...NEGOCIO, servicios: [] },
        error: undefined,
      },
    });

    renderPerfil();

    expect(await screen.findByText("Sin servicios publicados")).toBeInTheDocument();
  });

  it("reservar: elegir hora, completar datos y confirmar", async () => {
    const usuario = userEvent.setup();
    mockearGet({
      "/api/publico/negocios/{slug}/": { data: NEGOCIO, error: undefined },
      "/api/publico/negocios/{slug}/disponibilidad/": {
        data: [{ inicio: "2026-08-03T14:00:00Z" }],
        error: undefined,
      },
    });
    POST.mockResolvedValue({
      data: {
        negocio: "Barbería Castro",
        servicio: "Corte clásico",
        profesional: "Andrés Gómez",
        fecha_hora_inicio: "2026-08-03T14:00:00Z",
        fecha_hora_fin: "2026-08-03T14:30:00Z",
        nombre_cliente: "Juan Pérez",
      },
      error: undefined,
    });

    renderPerfil();
    await usuario.click(await screen.findByRole("button", { name: "Reservar" }));

    const hoja = await screen.findByRole("dialog");

    // El botón de confirmar no se habilita hasta tener hora, nombre y
    // teléfono — el disparador más probable de un "reservó sin querer".
    const confirmar = within(hoja).getByRole("button", { name: "Confirmar reserva" });
    expect(confirmar).toBeDisabled();

    await usuario.click(within(hoja).getByRole("radio", { name: /09:00/ }));
    await usuario.type(within(hoja).getByLabelText("Tu nombre"), "Juan Pérez");
    await usuario.type(within(hoja).getByLabelText("Tu teléfono"), "3001112233");

    expect(confirmar).toBeEnabled();
    await usuario.click(confirmar);

    expect(await within(hoja).findByText("¡Listo!")).toBeInTheDocument();
    expect(within(hoja).getByText(/Corte clásico con Andrés Gómez/)).toBeInTheDocument();
    expect(POST).toHaveBeenCalledWith(
      "/api/publico/negocios/{slug}/reservar/",
      expect.objectContaining({
        params: { path: { slug: "barberia-castro" } },
        body: expect.objectContaining({
          servicio: 1,
          fecha_hora_inicio: "2026-08-03T14:00:00Z",
          nombre_cliente: "Juan Pérez",
          telefono_cliente: "3001112233",
          empleado: null,
        }),
      }),
    );
  });

  it("si el hueco se ocupó entre que se mostró y se confirmó, avisa y refresca las horas", async () => {
    const usuario = userEvent.setup();
    mockearGet({
      "/api/publico/negocios/{slug}/": { data: NEGOCIO, error: undefined },
      "/api/publico/negocios/{slug}/disponibilidad/": {
        data: [{ inicio: "2026-08-03T14:00:00Z" }],
        error: undefined,
      },
    });
    POST.mockResolvedValue({
      data: undefined,
      error: { non_field_errors: ["Ese horario ya no está disponible. Elige otro."] },
    });

    renderPerfil();
    await usuario.click(await screen.findByRole("button", { name: "Reservar" }));
    const hoja = await screen.findByRole("dialog");

    await usuario.click(within(hoja).getByRole("radio", { name: /09:00/ }));
    await usuario.type(within(hoja).getByLabelText("Tu nombre"), "Juan Pérez");
    await usuario.type(within(hoja).getByLabelText("Tu teléfono"), "3001112233");
    await usuario.click(within(hoja).getByRole("button", { name: "Confirmar reserva" }));

    expect(
      await within(hoja).findByText("Ese horario ya no está disponible. Elige otro."),
    ).toBeInTheDocument();
    // Se refrescó la disponibilidad: dos llamadas a GET de disponibilidad
    // (la inicial al abrir la fecha, y la de después del 400).
    await waitFor(() => {
      const llamadasDisponibilidad = GET.mock.calls.filter(
        ([ruta]) => ruta === "/api/publico/negocios/{slug}/disponibilidad/",
      );
      expect(llamadasDisponibilidad.length).toBeGreaterThanOrEqual(2);
    });
  });
});
