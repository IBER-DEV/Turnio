import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { usePermisos } from "../../permisos/usePermisos";
import { ToastProvider } from "../../ui/Toast";
import { CajaHoy } from "./CajaHoy";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock("../../permisos/usePermisos", () => ({
  usePermisos: vi.fn(),
}));

const GET = apiClient.GET as unknown as Mock;
const POST = apiClient.POST as unknown as Mock;

type Servicio = components["schemas"]["Servicio"];
type RegistroServicio = components["schemas"]["RegistroServicio"];
type CajaDetalle = components["schemas"]["CajaDetalle"];

const SERVICIO: Servicio = {
  id: 1,
  nombre: "Corte clásico",
  precio: "25000",
  duracion_minutos: 30,
  activo: true,
};

const REGISTRO: RegistroServicio = {
  id: 7,
  empleado_nombre: "Andrés Gómez",
  servicio: 1,
  servicio_nombre: "Corte clásico",
  nombre_cliente: "Juan Pérez",
  fecha_hora: "2026-08-05T14:00:00Z",
  estado: "aprobado",
  aprobado_por: 2,
  aprobado_por_nombre: "Dueño",
  fecha_revision: "2026-08-05T14:10:00Z",
  motivo_rechazo: "",
  creado_en: "2026-08-05T14:00:00Z",
};

const CAJA_ABIERTA: CajaDetalle = {
  id: 3,
  estado: "abierta",
  saldo_inicial: "0",
  abierta_por: 2,
  abierta_por_nombre: "Dueño",
  abierta_en: "2026-08-05T08:00:00Z",
  cerrada_por: null,
  cerrada_por_nombre: null,
  cerrada_en: null,
  nota_cierre: "",
  movimientos: [],
  resumen: {
    total_ingresos: "0",
    total_egresos: "0",
    neto: "0",
    por_metodo_pago: {},
    comisiones_por_empleado: [],
    servicios_aprobados_sin_cobrar: 0,
  },
};

/** Cada test decide qué responde cada ruta. `conReintentoDeAuth` (sin
 * mockear, corre real) lee `response.status`, así que toda respuesta
 * necesita ese campo aunque el test no lo use. */
function mockearGet(respuestas: Record<string, { data?: unknown; error?: unknown; status: number }>) {
  GET.mockImplementation(async (ruta: string) => {
    const entrada = respuestas[ruta];
    if (entrada === undefined) throw new Error(`GET no configurado para ${ruta}`);
    return { data: entrada.data, error: entrada.error, response: { status: entrada.status } };
  });
}

function renderCajaHoy() {
  return render(
    <ToastProvider>
      <CajaHoy />
    </ToastProvider>,
  );
}

beforeEach(() => {
  GET.mockReset();
  POST.mockReset();
  (usePermisos as unknown as Mock).mockReturnValue({
    puede: () => true,
    shell: { inicio: "/", navegacion: [] },
    tipo: "administracion",
    cargando: false,
  });
});

describe("CajaHoy", () => {
  it("sin caja abierta (404) muestra el estado vacío para abrirla, no un error", async () => {
    mockearGet({
      "/api/caja/actual/": { status: 404 },
      "/api/servicios/": { data: [SERVICIO], status: 200 },
      "/api/servicios/registros/": { data: [], status: 200 },
    });

    renderCajaHoy();

    expect(await screen.findByText("Todavía no abriste la caja")).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos cargar la caja/)).toBeNull();
  });

  it("un error real al cargar sí muestra el estado de error", async () => {
    mockearGet({
      "/api/caja/actual/": { status: 404 },
      "/api/servicios/": { error: { detail: "falló" }, status: 500 },
      "/api/servicios/registros/": { data: [], status: 200 },
    });

    renderCajaHoy();

    expect(await screen.findByText(/No pudimos cargar la caja/)).toBeInTheDocument();
  });

  it("el formulario oculta método de pago y vínculo a servicio cuando el tipo es egreso", async () => {
    const usuario = userEvent.setup();
    mockearGet({
      "/api/caja/actual/": { data: CAJA_ABIERTA, status: 200 },
      "/api/servicios/": { data: [SERVICIO], status: 200 },
      "/api/servicios/registros/": { data: [REGISTRO], status: 200 },
    });

    renderCajaHoy();
    await usuario.click((await screen.findAllByRole("button", { name: "Registrar movimiento" }))[0]);

    // Con tipo=ingreso (default) hay dos combos: método de pago y el
    // vínculo opcional a un RegistroServicio aprobado.
    expect(screen.getAllByRole("combobox")).toHaveLength(2);

    await usuario.click(screen.getByRole("radio", { name: "Egreso" }));

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByText("Método de pago")).toBeNull();
    expect(screen.queryByText(/¿Viene de un servicio ya validado\?/)).toBeNull();

    await usuario.click(screen.getByRole("radio", { name: "Ingreso" }));
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
  });

  it("elegir un RegistroServicio fija el empleado de comisión, sin poder editarlo", async () => {
    const usuario = userEvent.setup();
    mockearGet({
      "/api/caja/actual/": { data: CAJA_ABIERTA, status: 200 },
      "/api/servicios/": { data: [SERVICIO], status: 200 },
      "/api/servicios/registros/": { data: [REGISTRO], status: 200 },
    });

    renderCajaHoy();
    await usuario.click((await screen.findAllByRole("button", { name: "Registrar movimiento" }))[0]);

    const combos = screen.getAllByRole("combobox");
    // El segundo combo es el de vínculo a servicio (el primero es
    // método de pago).
    await usuario.click(combos[1]);
    await usuario.click(await screen.findByRole("option", { name: /Corte clásico/ }));

    expect(await screen.findByText("Comisión para:")).toBeInTheDocument();
    expect(screen.getByText("Andrés Gómez")).toBeInTheDocument();
    // No hay ningún input editable para el empleado — es texto fijo.
    expect(screen.queryByLabelText(/empleado/i)).toBeNull();

    // Y autocompletó concepto/monto desde el servicio vinculado.
    expect(screen.getByDisplayValue("Corte clásico")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25000")).toBeInTheDocument();
  });

  it("registrar un movimiento manda el body y refresca la caja", async () => {
    const usuario = userEvent.setup();
    mockearGet({
      "/api/caja/actual/": { data: CAJA_ABIERTA, status: 200 },
      "/api/servicios/": { data: [SERVICIO], status: 200 },
      "/api/servicios/registros/": { data: [], status: 200 },
    });
    POST.mockResolvedValue({
      data: { ...CAJA_ABIERTA },
      error: undefined,
      response: { status: 201 },
    });

    renderCajaHoy();
    await usuario.click((await screen.findAllByRole("button", { name: "Registrar movimiento" }))[0]);

    await usuario.type(screen.getByLabelText("Monto"), "15000");
    await usuario.type(screen.getByLabelText("Concepto"), "Corte rápido");
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => {
      expect(POST).toHaveBeenCalledWith(
        "/api/caja/movimientos/",
        expect.objectContaining({
          body: expect.objectContaining({
            tipo: "ingreso",
            monto: "15000",
            concepto: "Corte rápido",
            metodo_pago: "efectivo",
          }),
        }),
      );
    });
  });
});
