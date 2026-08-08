import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { apiClient } from "../../api/client";
import { usePermisos } from "../../permisos/usePermisos";
import { ToastProvider } from "../../ui/Toast";
import { CajaHoy } from "./CajaHoy";
import type { CajaDetalle } from "./dinero";

vi.mock("../../api/client", () => ({
  apiClient: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock("../../permisos/usePermisos", () => ({
  usePermisos: vi.fn(),
}));

const GET = apiClient.GET as unknown as Mock;
const POST = apiClient.POST as unknown as Mock;

/** Caja abierta con base de $100.000, un cobro de $50.000 en efectivo y
 * uno de $30.000 por Nequi. El esperado del cajón son $150.000: el
 * Nequi **no** entra, que es la regla que estos tests protegen. */
const CAJA_ABIERTA: CajaDetalle = {
  id: 3,
  estado: "abierta",
  saldo_inicial: "100000.00",
  abierta_por: 2,
  abierta_por_nombre: "Dueño",
  abierta_en: "2026-08-07T08:00:00Z",
  cerrada_por: null,
  cerrada_por_nombre: null,
  cerrada_en: null,
  nota_cierre: "",
  efectivo_esperado: null,
  efectivo_contado: null,
  diferencia: null,
  movimientos: [],
  resumen: {
    total_ingresos: "80000.00",
    total_egresos: "0.00",
    total_devoluciones: "0.00",
    neto: "80000.00",
    por_metodo_pago: { efectivo: "50000.00", nequi: "30000.00" },
    egresos_por_categoria: {},
    comisiones_por_empleado: [],
    ventas_sin_cobrar: 0,
    saldo_inicial: "100000.00",
    ingresos_efectivo: "50000.00",
    egresos_efectivo: "0.00",
    devoluciones_efectivo: "0.00",
    efectivo_esperado: "150000.00",
  },
};

/** Cada test decide qué responde cada ruta. `conReintentoDeAuth` (sin
 * mockear, corre real) lee `response.status`, así que toda respuesta
 * necesita ese campo aunque el test no lo use. */
function mockearGet(
  respuestas: Record<string, { data?: unknown; error?: unknown; status: number }>,
) {
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
    mockearGet({ "/api/caja/actual/": { status: 404 } });

    renderCajaHoy();

    expect(await screen.findByText("Todavía no abriste la caja")).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos cargar la caja/)).toBeNull();
  });

  it("un error real al cargar sí muestra el estado de error", async () => {
    mockearGet({ "/api/caja/actual/": { error: { detail: "falló" }, status: 500 } });

    renderCajaHoy();

    expect(await screen.findByText(/No pudimos cargar la caja/)).toBeInTheDocument();
  });

  it("no ofrece registrar ingresos: la plata que entra viene de cobrar una cuenta", async () => {
    mockearGet({ "/api/caja/actual/": { data: CAJA_ABIERTA, status: 200 } });

    renderCajaHoy();
    await screen.findByText("Registrar gasto");

    // El viejo "Registrar movimiento" permitía inventar un ingreso sin
    // venta detrás. Que no exista es el punto entero del rediseño.
    expect(screen.queryByRole("button", { name: /Registrar movimiento/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /ingreso/i })).toBeNull();
  });

  it("el arqueo espera solo el efectivo: el cobro por Nequi no entra al cajón", async () => {
    const usuario = userEvent.setup();
    mockearGet({ "/api/caja/actual/": { data: CAJA_ABIERTA, status: 200 } });

    renderCajaHoy();
    await usuario.click(await screen.findByRole("button", { name: "Cerrar caja" }));

    // Se busca dentro del diálogo y no en toda la pantalla: el mismo
    // total también se muestra en la tarjeta de resumen de atrás, así que
    // una búsqueda global encontraría dos y no probaría nada.
    const dialogo = within(await screen.findByRole("dialog"));

    // 100.000 de base + 50.000 en efectivo = 150.000. Los 30.000 de
    // Nequi quedan fuera, listados aparte para conciliar.
    expect(dialogo.getByText("Debería haber")).toBeInTheDocument();
    expect(dialogo.getByText("$ 150.000")).toBeInTheDocument();
    expect(dialogo.getByText("Cobros que no pasaron por el cajón")).toBeInTheDocument();
    expect(dialogo.getByText("Nequi")).toBeInTheDocument();
  });

  it("calcula el faltante mientras se teclea, antes de enviar nada", async () => {
    const usuario = userEvent.setup();
    mockearGet({ "/api/caja/actual/": { data: CAJA_ABIERTA, status: 200 } });

    renderCajaHoy();
    await usuario.click(await screen.findByRole("button", { name: "Cerrar caja" }));
    await usuario.type(await screen.findByLabelText("¿Cuánto contaste?"), "148000");

    expect(await screen.findByText("Faltan $ 2.000.")).toBeInTheDocument();
    expect(POST).not.toHaveBeenCalled();
  });

  it("cerrar manda el efectivo contado", async () => {
    const usuario = userEvent.setup();
    mockearGet({ "/api/caja/actual/": { data: CAJA_ABIERTA, status: 200 } });
    POST.mockResolvedValue({
      data: { ...CAJA_ABIERTA, estado: "cerrada" },
      error: undefined,
      response: { status: 200 },
    });

    renderCajaHoy();
    await usuario.click(await screen.findByRole("button", { name: "Cerrar caja" }));

    const dialogo = within(await screen.findByRole("dialog"));
    await usuario.type(dialogo.getByLabelText("¿Cuánto contaste?"), "150000");
    await usuario.click(dialogo.getByRole("button", { name: "Cerrar caja" }));

    await waitFor(() => {
      expect(POST).toHaveBeenCalledWith(
        "/api/caja/cerrar/",
        expect.objectContaining({
          body: expect.objectContaining({ efectivo_contado: "150000" }),
        }),
      );
    });
  });

  it("un gasto viaja con su categoría", async () => {
    const usuario = userEvent.setup();
    mockearGet({ "/api/caja/actual/": { data: CAJA_ABIERTA, status: 200 } });
    POST.mockResolvedValue({ data: { id: 9 }, error: undefined, response: { status: 201 } });

    renderCajaHoy();
    await usuario.click(await screen.findByRole("button", { name: "Registrar gasto" }));
    await usuario.type(screen.getByLabelText("¿En qué se gastó?"), "Compra de shampoo");
    await usuario.type(screen.getByLabelText("Monto"), "50000");
    await usuario.click(screen.getByRole("button", { name: "Registrar gasto" }));

    await waitFor(() => {
      expect(POST).toHaveBeenCalledWith(
        "/api/caja/egresos/",
        expect.objectContaining({
          body: expect.objectContaining({
            monto: "50000",
            concepto: "Compra de shampoo",
            categoria: "insumos",
            metodo_pago: "efectivo",
          }),
        }),
      );
    });
  });
});
