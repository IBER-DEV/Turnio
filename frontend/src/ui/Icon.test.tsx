import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon } from "./Icon";
import { ICONOS } from "./iconos.generated";

describe("Icon", () => {
  it("dibuja un SVG inline, sin pedir ninguna fuente", () => {
    const { container } = render(<Icon name="close" />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector("path")).toBeInTheDocument();
  });

  it("queda oculto a lectores de pantalla", () => {
    const { container } = render(<Icon name="close" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("usa la variante rellena cuando se pide `filled`", () => {
    const dNormal = render(<Icon name="group" />)
      .container.querySelector("path")
      ?.getAttribute("d");
    const dRelleno = render(<Icon name="group" filled />)
      .container.querySelector("path")
      ?.getAttribute("d");

    expect(dRelleno).not.toBe(dNormal);
    // Se compara el atributo `d` y no el HTML crudo: el SVG de origen
    // trae `<path/>` autocerrado y el DOM lo serializa `<path></path>`.
    expect(ICONOS["group--fill"]).toContain(dRelleno);
  });

  it("cae en la variante normal si el icono no tiene relleno generado", () => {
    // `close` no está en CON_RELLENO, así que pedir `filled` no debe
    // romper: simplemente dibuja el contorno.
    const normal = render(<Icon name="close" />).container.innerHTML;
    const relleno = render(<Icon name="close" filled />).container.innerHTML;

    expect(relleno).toBe(normal);
  });

  it("hereda el tamaño de la tipografía, para que las clases de texto sigan sirviendo", () => {
    const { container } = render(<Icon name="close" className="text-[32px]" />);

    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("h-[1em]");
    expect(svg?.getAttribute("class")).toContain("text-[32px]");
  });
});
