import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { usePermisos } from "../permisos/usePermisos";
import { Icon } from "../ui/Icon";
import { cn } from "../ui/cn";
import { PasoEnlace } from "./PasoEnlace";
import { PasoEquipo } from "./PasoEquipo";
import { PasoHorario } from "./PasoHorario";
import { PasoServicios } from "./PasoServicios";
import { useEstadoNegocio } from "./estadoNegocio";

type Paso = "equipo" | "horario" | "servicios" | "enlace";

const TITULOS: Record<Paso, { titulo: string; bajada: string }> = {
  equipo: {
    titulo: "¿Quién atiende?",
    bajada: "Con esto sabemos cómo organizar tu agenda.",
  },
  horario: {
    titulo: "¿Cuándo abres?",
    bajada: "Es lo que define las horas que tus clientes van a poder reservar.",
  },
  servicios: {
    titulo: "¿Qué ofreces?",
    bajada: "Marca los que haces. Los precios los ajustas después.",
  },
  enlace: {
    titulo: "Listo. Este es tu enlace",
    bajada: "Compártelo y deja de coordinar citas por chat.",
  },
};

/** El primer minuto en Turnio.
 *
 * Existe porque el producto tenía un **estado muerto silencioso**: un
 * negocio recién registrado no tiene horario ni servicios, así que su
 * enlace público responde `200`, se ve bien, se puede compartir — y no
 * puede producir una sola reserva. Nada se lo decía al dueño, que
 * aterrizaba en un panel vacío sin saber qué le faltaba.
 *
 * Tres decisiones que valen la pena entender antes de tocarlo:
 *
 * 1. **Cada paso guarda al terminarlo**, no todo al final. Quien
 *    abandona a la mitad conserva lo que ya hizo, y al volver a entrar
 *    retoma donde iba en vez de repetirlo.
 * 2. **Es una puerta que reaparece**, no un evento de una sola vez: no
 *    se marca "onboarding hecho" en ninguna parte. La condición es el
 *    estado real del negocio (¿tiene horario?, ¿tiene servicios?), así
 *    que si alguien borra todos sus servicios, vuelve — que es
 *    exactamente lo correcto, porque su enlace volvió a estar muerto.
 * 3. **"Solo yo" no se persiste.** Decide qué pasos se muestran y nada
 *    más; el operador único es el caso n=1 del mismo diseño, no un modo
 *    (ver `../CLAUDE.md`). Lo contrario quedaría mentiroso el día que
 *    contrate a alguien.
 */
export function BienvenidaPage() {
  const navigate = useNavigate();
  const { membresia } = useAuth();
  const { puede, shell } = usePermisos();
  const { tieneHorario, tieneServicios, revalidar } = useEstadoNegocio();

  const puedeGestionarEquipo = puede("puede_gestionar_empleados");

  // Se retoma en lo primero que falte, para que volver no sea repetir.
  const [paso, setPaso] = useState<Paso>(() => {
    if (puedeGestionarEquipo && !tieneHorario && !tieneServicios) return "equipo";
    if (!tieneHorario) return "horario";
    if (!tieneServicios) return "servicios";
    return "enlace";
  });
  const [conEquipo, setConEquipo] = useState(false);

  const visibles: Paso[] = puedeGestionarEquipo
    ? ["equipo", "horario", "servicios", "enlace"]
    : ["horario", "servicios", "enlace"];
  const indiceActual = visibles.indexOf(paso);
  const { titulo, bajada } = TITULOS[paso];

  function terminar() {
    navigate(shell.inicio, { replace: true });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {visibles.map((nombre, indice) => (
            <span
              key={nombre}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                indice <= indiceActual ? "bg-menta" : "bg-outline-variant",
              )}
              aria-hidden
            />
          ))}
        </div>
        <p className="sr-only" role="status">
          Paso {indiceActual + 1} de {visibles.length}
        </p>

        <div>
          <h1 className="font-headline-md text-headline-md-mobile font-bold text-primary md:text-headline-md">
            {titulo}
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{bajada}</p>
        </div>
      </header>

      {paso === "equipo" && (
        <PasoEquipo
          onListo={(eligioEquipo) => {
            setConEquipo(eligioEquipo);
            setPaso("horario");
          }}
        />
      )}

      {paso === "horario" && (
        <PasoHorario
          conEquipo={conEquipo}
          onListo={async () => {
            await revalidar();
            setPaso("servicios");
          }}
        />
      )}

      {paso === "servicios" && (
        <PasoServicios
          onListo={async () => {
            await revalidar();
            setPaso("enlace");
          }}
        />
      )}

      {paso === "enlace" && membresia && (
        <PasoEnlace slug={membresia.negocio.slug} onTerminar={terminar} />
      )}

      {/* Salir siempre es posible: encerrar a alguien en un wizard es
          peor que un negocio incompleto, y la puerta lo vuelve a traer
          mientras siga faltando algo. */}
      {paso !== "enlace" && (
        <button
          type="button"
          onClick={terminar}
          className="mx-auto flex items-center gap-1 font-caption text-caption text-on-surface-variant hover:underline"
        >
          Configurar esto después
          <Icon name="chevron_right" className="text-[16px]" />
        </button>
      )}
    </div>
  );
}
