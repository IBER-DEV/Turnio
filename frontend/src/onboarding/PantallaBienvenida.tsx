import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import type { NombreIcono } from "../ui/Icon";

/** Lo que Turnio hace el primer día, en dos frases.
 *
 * Son **dos y no cuatro** por la misma razón que el wizard tiene cuatro
 * pasos y no diez: esta pantalla se pasa de largo en tres segundos, y una
 * lista larga se lee como un folleto en vez de como una promesa.
 *
 * Las dos son cosas que el producto ya hace hoy. No se anuncia acá la
 * ficha de clientes ni los reportes (Fase 4) por tentador que sea llenar
 * la lista: la primera pantalla de la app es el peor lugar posible para
 * prometer algo que la persona no va a encontrar cuando lo busque.
 */
const PROMESAS: Array<{
  icono: NombreIcono;
  tinte: string;
  titulo: string;
  descripcion: string;
}> = [
  {
    icono: "calendar_month",
    tinte: "bg-menta/15 text-menta",
    titulo: "Una agenda por empleado",
    descripcion:
      "Cada quien con su calendario y sus horas, aunque en tu negocio trabajes solo tú.",
  },
  {
    icono: "link",
    tinte: "bg-primary/10 text-primary",
    titulo: "Tu enlace de reservas",
    descripcion: "Tus clientes reservan su turno solos, sin llamarte ni escribirte.",
  },
];

/** La primera pantalla del onboarding: qué es Turnio, antes de pedir nada.
 *
 * Rompe con el resto del wizard a propósito. Los otros pasos comparten un
 * marco (barra de progreso, título, bajada, contenido) porque todos hacen
 * lo mismo: pedir un dato. Esta no pide nada — presenta — así que se
 * compone entera, con la foto ocupando la mitad superior de la pantalla.
 * Por eso `BienvenidaPage` la renderiza fuera de ese marco en vez de
 * meterla adentro como un paso más.
 *
 * La imagen va en `public/` y no importada por Vite: es la única foto
 * grande del proyecto y no gana nada pasando por el bundler. Está
 * recortada y reescalada a 1200px de ancho (el original de 2752px y 2,4
 * MB quedó en `design/onboarding/`) porque esto es un bundle Capacitor:
 * el peso se descarga una vez al instalar y se paga en el espacio del
 * teléfono, no en una CDN.
 */
export function PantallaBienvenida({
  paso,
  totalPasos,
  onComenzar,
  onSaltar,
}: {
  paso: number;
  totalPasos: number;
  onComenzar: () => void;
  onSaltar: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-background">
      {/* Mitad superior: la foto. Se mide en `dvh` y no en `%` ni en
          `aspect-*`. En `%` no resolvería —el contenedor declara
          `min-h-dvh`, que es una altura mínima, no una definida— y con
          `aspect-*` la foto cambiaría de reparto entre un teléfono chico
          y uno grande. Lo que tiene que quedar constante es cuánta
          pantalla se lleva la foto, que es el 45% del mockup. */}
      <div className="relative h-[45dvh] min-h-[280px] w-full shrink-0">
        <img
          src="/portada.jpeg"
          alt=""
          className="h-full w-full object-cover"
          // `alt` vacío y `aria-hidden`: es una foto de ambiente. Quien
          // navega con lector de pantalla ya recibe el mismo mensaje del
          // titular y las dos promesas que vienen debajo; describirla otra
          // vez solo alarga el camino hasta el botón.
          aria-hidden
        />
        {/* El degradado hasta el color de fondo es lo que hace que la foto
            "termine" en vez de cortarse con un borde recto. */}
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/20 to-background" />

        <div className="absolute right-4 top-4 rounded-full border border-outline-variant/30 bg-surface/80 px-3 py-1.5 backdrop-blur-md safe-top">
          <span className="font-caption text-caption font-semibold tracking-wide text-on-surface-variant">
            Paso {paso} de {totalPasos}
          </span>
        </div>
      </div>

      {/* Mitad inferior. Sube 1rem sobre la foto con esquinas redondeadas:
          es lo que da la sensación de hoja apoyada encima y no de dos
          bloques pegados. */}
      <div className="relative z-10 -mt-4 flex flex-1 flex-col rounded-t-3xl bg-background px-4 pb-8 pt-2">
        <div className="mb-6 mt-4 text-center">
          <h1 className="mb-2 font-headline-lg text-headline-lg-mobile text-primary">
            Bienvenido a Turnio
          </h1>
          <p className="mx-auto max-w-[280px] font-body-md text-body-md text-on-surface-variant">
            Todo lo de tu negocio en un solo lugar: la agenda, tu equipo y el enlace con el
            que tus clientes reservan.
          </p>
        </div>

        <div className="mb-auto flex flex-col gap-3 px-2">
          {PROMESAS.map(({ icono, tinte, titulo, descripcion }) => (
            <div
              key={titulo}
              className="flex items-start gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tinte}`}
              >
                <Icon name={icono} filled className="text-[22px]" />
              </span>
              <div>
                <h2 className="mb-1 font-body-md text-body-md font-semibold text-on-surface">
                  {titulo}
                </h2>
                <p className="font-caption text-caption text-on-surface-variant">{descripcion}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 pt-4">
          <Button tamano="lg" anchoCompleto onClick={onComenzar} className="py-4">
            Comenzar configuración
            <Icon name="arrow_forward" className="text-[20px]" />
          </Button>
          {/* Salir sigue siendo posible desde el primer segundo, igual que
              en los pasos siguientes: la puerta del onboarding lo vuelve a
              traer mientras siga faltando algo. */}
          <button
            type="button"
            onClick={onSaltar}
            className="font-caption text-caption text-on-surface-variant hover:underline"
          >
            Configurar esto después
          </button>
        </div>
      </div>
    </div>
  );
}
