import { useState, useMemo } from "react";
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

function PasswordStrength({ password }: { password: string }) {
  const { nivel, label, color, porcentaje } = useMemo(() => {
    if (password.length === 0) return { nivel: 0, label: "", color: "", porcentaje: 0 };
    if (password.length < 6) return { nivel: 1, label: "Muy débil", color: "bg-error", porcentaje: 25 };
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    const score = [password.length >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    if (score <= 1) return { nivel: 1, label: "Débil", color: "bg-error", porcentaje: 25 };
    if (score === 2) return { nivel: 2, label: "Regular", color: "bg-amber-500", porcentaje: 50 };
    if (score === 3) return { nivel: 3, label: "Buena", color: "bg-menta", porcentaje: 75 };
    return { nivel: 4, label: "Fuerte", color: "bg-menta", porcentaje: 100 };
  }, [password]);

  if (nivel === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-outline-variant/40">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <span className={cn(
        "text-[11px] font-semibold",
        nivel <= 1 ? "text-error" : nivel === 2 ? "text-amber-600" : "text-menta",
      )}>
        {label}
      </span>
    </div>
  );
}

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
    <div className="flex min-h-dvh">
      {/* Panel izquierdo — solo desktop */}
      <aside className="relative hidden w-[480px] shrink-0 flex-col justify-between overflow-hidden bg-primary p-10 lg:flex xl:w-[520px]">
        <div className="absolute inset-0 bg-linear-to-br from-primary via-primary-container/40 to-primary" />
        <div className="absolute -bottom-20 -right-20 h-[400px] w-[400px] rounded-full bg-menta/10 blur-[100px]" />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-sm font-extrabold text-white">
              T
            </span>
            <span className="text-lg font-bold text-white">
              Turn<span className="text-menta">io</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-[28px] font-bold leading-tight text-white">
            La plataforma completa
            <br />
            <span className="text-menta">para tu negocio.</span>
          </h2>
          <p className="max-w-[340px] text-[15px] leading-relaxed text-white/70">
            Citas, servicios, equipo, permisos, caja y reportes. Todo lo que
            necesitas para dejar el cuaderno atrás.
          </p>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-menta/20">
                <Icon name="check" className="text-[16px] text-menta" />
              </span>
              <span className="text-[14px] text-white/80">Agenda inteligente por empleado</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-menta/20">
                <Icon name="check" className="text-[16px] text-menta" />
              </span>
              <span className="text-[14px] text-white/80">Catálogo de servicios con precios en pesos</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-menta/20">
                <Icon name="check" className="text-[16px] text-menta" />
              </span>
              <span className="text-[14px] text-white/80">Permisos granulares por persona</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-menta/20">
                <Icon name="check" className="text-[16px] text-menta" />
              </span>
              <span className="text-[14px] text-white/80">Tus clientes reservan solos, 24/7</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex gap-8 border-t border-white/10 pt-6">
          <div>
            <p className="text-2xl font-bold text-white">2 min</p>
            <p className="text-[12px] text-white/50">Setup completo</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">∞</p>
            <p className="text-[12px] text-white/50">Empleados</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">$0</p>
            <p className="text-[12px] text-white/50">Para empezar</p>
          </div>
        </div>
      </aside>

      {/* Panel derecho — formulario */}
      <main className="flex flex-1 flex-col">
        {/* Header mobile */}
        <header className="flex items-center justify-between border-b border-outline-variant/40 px-margin-mobile py-4 lg:px-10">
          <span className="text-lg font-bold tracking-tight text-primary lg:hidden">
            Turn<span className="text-menta">io</span>
          </span>
          <span className="hidden text-[14px] text-on-surface-variant lg:block">
            Registro de negocio
          </span>
          <Link
            to="/login"
            className="text-[13px] font-semibold text-menta hover:text-menta-oscura hover:underline"
          >
            Ya tengo cuenta
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 px-margin-mobile py-8 lg:px-10">
            <div className="mx-auto max-w-[560px]">
              {/* Stepper */}
              <nav aria-label="Progreso del registro" className="mb-10">
                <ol className="flex items-center">
                  {[
                    { n: 1 as const, titulo: "Negocio", sub: "Datos del local" },
                    { n: 2 as const, titulo: "Tu cuenta", sub: "Acceso a Turnio" },
                  ].map((s, i, arr) => {
                    const activo = paso === s.n;
                    const hecho = paso > s.n;
                    return (
                      <li key={s.n} className={cn("flex items-center", i < arr.length - 1 && "flex-1")}>
                        <button
                          type="button"
                          disabled={s.n > paso || enviando}
                          onClick={() => s.n < paso && setPaso(s.n)}
                          className={cn(
                            "flex items-center gap-3 text-left transition-opacity",
                            s.n > paso && "cursor-default opacity-50",
                            s.n < paso && "cursor-pointer hover:opacity-80",
                          )}
                          aria-current={activo ? "step" : undefined}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-all duration-300",
                              hecho && "bg-menta text-white",
                              activo && "bg-primary text-white ring-4 ring-primary/15",
                              !hecho && !activo && "bg-outline-variant/40 text-on-surface-variant",
                            )}
                          >
                            {hecho ? <Icon name="check" className="text-[18px]" /> : s.n}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={cn(
                                "block text-[12px] font-bold sm:text-[13px]",
                                activo || hecho ? "text-primary" : "text-on-surface-variant",
                              )}
                            >
                              {s.titulo}
                            </span>
                            <span className="block text-[10px] text-on-surface-variant sm:text-[11px]">
                              {s.sub}
                            </span>
                          </span>
                        </button>
                        {i < arr.length - 1 && (
                          <div
                            className={cn(
                              "mx-2 h-0.5 flex-1 rounded-full transition-colors duration-500 sm:mx-4",
                              hecho ? "bg-menta" : "bg-outline-variant/40",
                            )}
                            aria-hidden
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {/* Step header */}
              <div className="mb-8">
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-menta/10 text-menta">
                    <Icon name={paso === 1 ? "storefront" : "person"} className="text-[22px]" />
                  </span>
                  <div>
                    <h1 className="text-xl font-bold text-primary lg:text-2xl">
                      {paso === 1 ? "Datos del Negocio" : "Tu cuenta"}
                    </h1>
                    <p className="text-[13px] text-on-surface-variant">
                      {paso === 1
                        ? "Información que verán tus clientes"
                        : "Con estos datos accederás a Turnio"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 1: Business data */}
              {paso === 1 ? (
                <div className="animate-aparecer space-y-5">
                  <Input
                    label="Nombre del Negocio"
                    icono="storefront"
                    value={datos.nombre_negocio}
                    onChange={(e) => actualizar("nombre_negocio", e.target.value)}
                    placeholder="Ej: Barbería El Corte Real"
                    ayuda="Nombre que verán tus clientes en la app."
                    required
                  />

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Input
                      label="Ciudad"
                      value={datos.ciudad}
                      onChange={(e) => actualizar("ciudad", e.target.value)}
                      placeholder="Ej: Bogotá"
                      ayuda="Ayuda a clientes locales a encontrarte."
                    />
                    <Input
                      label="Teléfono de Contacto"
                      icono="call"
                      type="tel"
                      value={datos.telefono}
                      onChange={(e) => actualizar("telefono", e.target.value)}
                      placeholder="+57 300 000 0000"
                      ayuda="Para coordinaciones con clientes."
                    />
                  </div>

                  <Input
                    label="Dirección Física"
                    value={datos.direccion}
                    onChange={(e) => actualizar("direccion", e.target.value)}
                    placeholder="Calle, Número, Local"
                    ayuda="Dirección completa para el mapa de navegación."
                  />
                </div>
              ) : (
                <div className="animate-aparecer space-y-5">
                  <Input
                    label="Nombre Completo"
                    icono="person"
                    value={datos.nombre_dueno}
                    onChange={(e) => actualizar("nombre_dueno", e.target.value)}
                    placeholder="Tu nombre y apellido"
                    ayuda="Como responsable de la cuenta."
                    autoComplete="name"
                    required
                  />

                  <Input
                    label="Email Profesional"
                    icono="mail"
                    type="email"
                    value={datos.email_dueno}
                    onChange={(e) => actualizar("email_dueno", e.target.value)}
                    placeholder="ejemplo@tu-negocio.com"
                    ayuda="Con este email entrarás a Turnio."
                    autoComplete="email"
                    required
                  />

                  <div className="space-y-2">
                    <Input
                      label="Contraseña"
                      icono="lock"
                      type="password"
                      value={datos.password_dueno}
                      onChange={(e) => actualizar("password_dueno", e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      required
                      error={error ?? undefined}
                    />
                    <PasswordStrength password={datos.password_dueno} />
                  </div>

                  {/* Terms notice */}
                  <div className="rounded-xl bg-surface-container-low/50 p-4">
                    <p className="text-[12px] leading-relaxed text-on-surface-variant">
                      Al crear tu cuenta aceptas los{" "}
                      <button type="button" className="font-semibold text-menta hover:underline">
                        términos de servicio
                      </button>{" "}
                      y la{" "}
                      <button type="button" className="font-semibold text-menta hover:underline">
                        política de privacidad
                      </button>{" "}
                      de Turnio.
                    </p>
                  </div>
                </div>
              )}

              <p className="mt-8 text-center text-[13px] text-on-surface-variant">
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="font-bold text-menta hover:text-menta-oscura hover:underline">
                  Entra aquí
                </Link>
              </p>
            </div>
          </div>

          {/* Footer con botones */}
          <footer className="sticky bottom-0 border-t border-outline-variant/40 bg-white/80 px-margin-mobile py-4 backdrop-blur-lg safe-bottom lg:px-10">
            <div className="mx-auto flex max-w-[560px] items-center justify-between gap-4">
              {paso === 2 ? (
                <Button
                  type="button"
                  variante="ghost"
                  tamano="lg"
                  onClick={() => setPaso(1)}
                  disabled={enviando}
                >
                  <Icon name="chevron_left" className="text-[20px]" />
                  Anterior
                </Button>
              ) : (
                <div />
              )}
              <Button
                type="submit"
                tamano="lg"
                cargando={enviando}
                className="min-w-[180px]"
              >
                {paso === 1 ? "Siguiente" : "Crear Negocio"}
                {!enviando && <Icon name={paso === 1 ? "arrow_forward" : "rocket_launch"} />}
              </Button>
            </div>
          </footer>
        </form>
      </main>
    </div>
  );
}
