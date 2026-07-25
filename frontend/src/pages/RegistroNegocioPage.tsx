import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { useToast } from "../ui/Toast";

const VACIO = {
  nombre_negocio: "",
  ciudad: "",
  direccion: "",
  telefono: "",
  nombre_dueno: "",
  email_dueno: "",
  password_dueno: "",
};

export function RegistroNegocioPage() {
  const { membresia, cargando, registrarNegocio } = useAuth();
  const navigate = useNavigate();
  const { mostrar } = useToast();

  const [paso, setPaso] = useState<1 | 2>(1);
  const [datos, setDatos] = useState(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!cargando && membresia) {
    return <Navigate to="/" replace />;
  }

  function actualizar(campo: keyof typeof VACIO, valor: string) {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
  }

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();

    // El paso 1 solo avanza; el envío real ocurre en el paso 2.
    if (paso === 1) {
      setPaso(2);
      return;
    }

    setError(null);
    setEnviando(true);
    const resultado = await registrarNegocio(datos);
    setEnviando(false);

    if (resultado.ok) {
      mostrar("exito", "¡Bienvenido a Turnio! Tu negocio está listo.");
      navigate("/");
    } else {
      setError(resultado.error);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 flex w-full items-center justify-between bg-surface/80 px-margin-mobile py-6 backdrop-blur-md safe-top md:px-margin-desktop">
        <span className="font-headline-md text-headline-md font-bold tracking-tight text-primary">
          Turnio
        </span>
        <span className="font-label-md text-label-md text-on-surface-variant">
          Paso {paso} de 2
        </span>
      </header>

      {/* Sin `noValidate`: al ser un formulario por pasos, la validación
          nativa del navegador solo evalúa los campos del paso montado,
          que es justo el comportamiento deseado al pulsar "Siguiente". */}
      <form onSubmit={handleSubmit}>
        <main className="mx-auto max-w-4xl px-margin-mobile pb-40 pt-4 md:px-margin-desktop">
          <section className="mb-xl text-center md:text-left">
            <h1 className="mb-4 font-headline-lg text-headline-lg-mobile text-primary md:text-headline-lg">
              Crea tu negocio en Turnio
            </h1>
            <p className="max-w-xl text-on-surface-variant">
              Estás a solo unos pasos de profesionalizar tu salón o barbería con la plataforma
              líder en gestión de citas.
            </p>

            <div
              className="mx-auto mt-lg flex w-full max-w-md gap-2 md:mx-0"
              role="progressbar"
              aria-valuenow={paso}
              aria-valuemin={1}
              aria-valuemax={2}
              aria-label={`Paso ${paso} de 2`}
            >
              <div className="h-1.5 flex-1 rounded-full bg-primary transition-all duration-500" />
              <div
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-500",
                  paso === 2 ? "bg-primary" : "bg-surface-container-highest",
                )}
              />
            </div>
          </section>

          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-md shadow-card-soft md:p-10">
            <div className="mb-lg flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <Icon name={paso === 1 ? "storefront" : "person"} />
              </span>
              <h2 className="font-headline-md text-headline-md text-primary">
                {paso === 1 ? "Datos del Negocio" : "Datos del Dueño"}
              </h2>
            </div>

            {paso === 1 ? (
              <div className="grid grid-cols-1 gap-md md:grid-cols-2">
                <Input
                  label="Nombre del Negocio"
                  value={datos.nombre_negocio}
                  onChange={(e) => actualizar("nombre_negocio", e.target.value)}
                  placeholder="Ej: Barbería El Corte Real"
                  ayuda="Este es el nombre que verán tus clientes en la app."
                  required
                />
                <Input
                  label="Ciudad"
                  value={datos.ciudad}
                  onChange={(e) => actualizar("ciudad", e.target.value)}
                  placeholder="Ej: Bogotá"
                  ayuda="Ayuda a los clientes locales a encontrarte."
                />
                <div className="md:col-span-2">
                  <Input
                    label="Dirección Física"
                    value={datos.direccion}
                    onChange={(e) => actualizar("direccion", e.target.value)}
                    placeholder="Calle, Número, Local"
                    ayuda="Dirección completa para el mapa de navegación."
                  />
                </div>
                <Input
                  label="Teléfono de Contacto"
                  type="tel"
                  value={datos.telefono}
                  onChange={(e) => actualizar("telefono", e.target.value)}
                  placeholder="+57 300 000 0000"
                  ayuda="Para coordinaciones rápidas con clientes."
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-md">
                <Input
                  label="Nombre Completo"
                  value={datos.nombre_dueno}
                  onChange={(e) => actualizar("nombre_dueno", e.target.value)}
                  placeholder="Tu nombre y apellido"
                  ayuda="Como responsable de la cuenta del negocio."
                  autoComplete="name"
                  required
                />
                <Input
                  label="Email Profesional"
                  type="email"
                  value={datos.email_dueno}
                  onChange={(e) => actualizar("email_dueno", e.target.value)}
                  placeholder="ejemplo@tu-negocio.com"
                  ayuda="Con este email entrarás a Turnio."
                  autoComplete="email"
                  required
                />
                <Input
                  label="Contraseña"
                  type="password"
                  value={datos.password_dueno}
                  onChange={(e) => actualizar("password_dueno", e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  ayuda="Asegúrate de que sea segura y privada."
                  autoComplete="new-password"
                  required
                  error={error ?? undefined}
                />
              </div>
            )}
          </div>

          <p className="mt-md text-center font-body-md text-body-md text-on-surface-variant">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              Entra aquí
            </Link>
          </p>
        </main>

        <footer className="fixed bottom-0 left-0 z-50 w-full border-t border-outline-variant/20 bg-surface-container-lowest/80 p-md backdrop-blur-lg safe-bottom">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            {paso === 2 ? (
              <Button
                type="button"
                variante="secondary"
                tamano="lg"
                className="rounded-full"
                onClick={() => setPaso(1)}
                disabled={enviando}
              >
                Anterior
              </Button>
            ) : (
              <div className="hidden md:block" />
            )}
            <Button
              type="submit"
              tamano="lg"
              cargando={enviando}
              className="w-full rounded-full px-10 md:w-auto"
            >
              {paso === 1 ? "Siguiente Paso" : "Crear Negocio"}
              {!enviando && <Icon name={paso === 1 ? "arrow_forward" : "rocket_launch"} />}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
