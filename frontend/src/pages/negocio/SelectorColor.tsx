import { useState } from "react";
import { HexColorPicker } from "react-colorful";

import { PRESETS, avisoDeContraste, textoSobre } from "../../tema/colores";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { Modal } from "../../ui/Modal";
import { cn } from "../../ui/cn";

/** El color de marca del negocio: ocho presets seguros, o el suyo exacto.
 *
 * Los presets no son decoración: todos pasan contraste AA sobre blanco
 * (hay un test que lo fija), así que el camino corto —el que va a tomar
 * la mayoría— nunca produce un perfil ilegible. El color libre existe
 * porque un negocio con identidad propia tiene derecho a su color, y ahí
 * es donde aparece el aviso: se **advierte**, no se bloquea.
 */
export function SelectorColor({
  abierto,
  colorActual,
  guardando,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  /** Cadena vacía = usa el color de Turnio. */
  colorActual: string;
  guardando: boolean;
  onCerrar: () => void;
  onGuardar: (color: string) => void;
}) {
  const [color, setColor] = useState(colorActual || PRESETS[0]!.hex);
  const [modoLibre, setModoLibre] = useState(
    colorActual !== "" && !PRESETS.some((preset) => preset.hex === colorActual),
  );

  const aviso = avisoDeContraste(color);

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Color de tu negocio"
      descripcion="Pinta los botones y los detalles de tu página pública."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => {
                setColor(preset.hex);
                setModoLibre(false);
              }}
              aria-label={preset.nombre}
              aria-pressed={color === preset.hex}
              style={{ backgroundColor: preset.hex, color: textoSobre(preset.hex) }}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-transform",
                color === preset.hex ? "scale-110 ring-2 ring-offset-2 ring-primary" : "hover:scale-105",
              )}
            >
              {color === preset.hex && <Icon name="check" className="text-[20px]" />}
            </button>
          ))}
        </div>

        {modoLibre ? (
          <div className="flex flex-col items-center gap-3">
            {/* `react-colorful`: 2 KB y accesible por teclado. Se prefirió
                a un `<input type="color">` nativo porque en el WebView de
                Capacitor su comportamiento cambia entre Android e iOS. */}
            <HexColorPicker color={color} onChange={setColor} />
            <p className="font-caption text-caption uppercase tracking-wider text-on-surface-variant">
              {color}
            </p>
          </div>
        ) : (
          <Button variante="ghost" tamano="sm" icono="edit" onClick={() => setModoLibre(true)}>
            Usar mi color exacto
          </Button>
        )}

        {/* La vista previa es lo que hace útil el aviso: se ve el botón
            real, con el texto que el sistema eligió por contraste. */}
        <div className="rounded-xl border border-outline-variant p-4">
          <p className="mb-3 font-caption text-caption text-on-surface-variant">Así se verá</p>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex min-h-[44px] items-center rounded-xl px-5 font-label-md text-label-md"
              style={{ backgroundColor: color, color: textoSobre(color) }}
            >
              Reservar
            </span>
            <span className="font-label-md text-label-md" style={{ color }}>
              $25.000
            </span>
          </div>
        </div>

        {aviso && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-tertiary-container px-3 py-2 font-caption text-caption text-on-tertiary-container"
          >
            <Icon name="info" className="mt-0.5 shrink-0 text-[18px]" />
            {aviso}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            variante="ghost"
            onClick={() => onGuardar("")}
            disabled={guardando || colorActual === ""}
          >
            Usar el de Turnio
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variante="ghost" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button cargando={guardando} onClick={() => onGuardar(color)}>
              Guardar color
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
