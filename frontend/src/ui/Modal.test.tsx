import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Input } from "./Input";
import { Modal } from "./Modal";

/** Reproduce el patrón exacto de las pantallas reales: `onCerrar` como
 * arrow function inline (identidad nueva en cada render) y un estado
 * controlado que cambia con cada tecla. Con el Modal artesanal anterior
 * esa combinación hacía que el `useEffect` — que dependía de `onCerrar`
 * — se re-ejecutara por cada letra y su `contenedor.focus()` sacara el
 * foco del input. */
function Anfitrion() {
  const [abierto, setAbierto] = useState(true);
  const [valor, setValor] = useState("");

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => setAbierto(false)}
      titulo="Nuevo servicio"
      descripcion="Define precio y duración."
    >
      <form>
        <Input label="Nombre" value={valor} onChange={(evento) => setValor(evento.target.value)} />
      </form>
    </Modal>
  );
}

describe("Modal", () => {
  it("no roba el foco del input mientras se escribe (regresión)", async () => {
    const usuario = userEvent.setup();
    render(<Anfitrion />);

    const campo = screen.getByLabelText("Nombre");
    await usuario.click(campo);
    expect(campo).toHaveFocus();

    // El bug se manifestaba desde la segunda letra: la primera entraba y
    // el foco saltaba al contenedor del modal.
    await usuario.keyboard("Corte de cabello");

    expect(campo).toHaveFocus();
    expect(campo).toHaveValue("Corte de cabello");
  });

  it("mantiene el foco dentro del modal al tabular (focus trap)", async () => {
    const usuario = userEvent.setup();
    render(<Anfitrion />);

    await usuario.tab();
    await usuario.tab();
    await usuario.tab();
    await usuario.tab();

    const contenido = screen.getByRole("dialog");
    expect(contenido.contains(document.activeElement)).toBe(true);
  });

  it("cierra con Escape", async () => {
    const usuario = userEvent.setup();
    render(<Anfitrion />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("expone título y descripción a lectores de pantalla", () => {
    render(<Anfitrion />);

    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toHaveAccessibleName("Nuevo servicio");
    expect(dialogo).toHaveAccessibleDescription("Define precio y duración.");
  });
});
