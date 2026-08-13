import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { usePermisos } from "../permisos/usePermisos";
import { Icon } from "../ui/Icon";
import { cn } from "../ui/cn";
import { PantallaBienvenida } from "./PantallaBienvenida";
import { PasoEnlace } from "./PasoEnlace";
import { PasoEquipo } from "./PasoEquipo";
import { PasoHorario } from "./PasoHorario";
import { PasoServicios } from "./PasoServicios";
import { useEstadoNegocio } from "./estadoNegocio";

type Paso = "bienvenida" | "equipo" | "horario" | "servicios" | "enlace";

type PasoConMarco = Exclude<Paso, "bienvenida" | "enlace">;

/** Los pasos que comparten el marco del wizard. `bienvenida` y `enlace`
 * no están acá porque no piden nada: se componen enteros, cada uno con
 * su propia pantalla. Si el tipo deja de excluirlos, TypeScript exige
 * títulos que nadie va a leer. */
const TITULOS: Record<PasoConMarco, { titulo: string; bajada: string }> = {
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
  // La bienvenida solo aparece cuando no hay nada hecho: a quien ya
  // empezó y volvió a entrar no se le presenta otra vez el producto, se
  // le devuelve al paso donde iba.
  const [paso, setPaso] = useState<Paso>(() => {
    if (!tieneHorario && !tieneServicios) return "bienvenida";
    if (!tieneHorario) return "horario";
    if (!tieneServicios) return "servicios";
    return "enlace";
  });
  const [conEquipo, setConEquipo] = useState(false);

  const visibles: Paso[] = puedeGestionarEquipo
    ? ["bienvenida", "equipo", "horario", "servicios", "enlace"]
    : ["bienvenida", "horario", "servicios", "enlace"];
  const indiceActual = visibles.indexOf(paso);

  function terminar() {
    navigate(shell.inicio, { replace: true });
  }

  // Las dos pantallas compuestas van antes del marco del wizard y no
  // adentro: cada una ocupa la pantalla entera, la de bienvenida con su
  // foto a sangre y la de cierre con su botón pegado abajo. Meterlas en
  // el contenedor de los pasos —que tiene `px-5 py-8` y una barra de
  // progreso arriba— dejaría la foto con márgenes y el botón flotando a
  // mitad de la pantalla.
  if (paso === "bienvenida") {
    return (
      <PantallaBienvenida
        paso={indiceActual + 1}
        totalPasos={visibles.length}
        onComenzar={() => setPaso(puedeGestionarEquipo ? "equipo" : "horario")}
        onSaltar={terminar}
      />
    );
  }

  if (paso === "enlace") {
    // Sin membresía todavía no hay slug que mostrar. El `return null`
    // separado —y no un `paso === "enlace" && membresia` en la
    // condición— es lo que deja que TypeScript descarte `"enlace"` del
    // tipo de `paso` más abajo: con la condición compuesta, el caso se
    // colaba hasta `TITULOS[paso]`, donde no hay entrada, y había que
    // taparlo con un cast que mentía.
    if (!membresia) return null;
    return (
      <PasoEnlace
        slug={membresia.negocio.slug}
        nombre={membresia.nombre}
        onTerminar={terminar}
      />
    );
  }

  const { titulo, bajada } = TITULOS[paso];

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

      {/* Salir siempre es posible: encerrar a alguien en un wizard es
          peor que un negocio incompleto, y la puerta lo vuelve a traer
          mientras siga faltando algo. */}
      <button
        type="button"
        onClick={terminar}
        className="mx-auto flex items-center gap-1 font-caption text-caption text-on-surface-variant hover:underline"
      >
        Configurar esto después
        <Icon name="chevron_right" className="text-[16px]" />
      </button>
    </div>
  );
}
