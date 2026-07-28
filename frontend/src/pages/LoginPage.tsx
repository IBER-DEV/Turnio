import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { usePermisos } from "../permisos/usePermisos";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { Switch } from "../ui/Switch";

export function LoginPage() {
  const { membresia, cargando, login } = useAuth();
  const { shell } = usePermisos();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recordar, setRecordar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Cada tipo de usuario aterriza donde le sirve: administración en el
  // panel, recepción y operativo directo en la agenda (ver
  // `permisos/shell.ts`). No hace falta navegar a mano tras el login:
  // al llegar la membresía este mismo guard redirige, y así el destino
  // se calcula en un solo lugar.
  if (!cargando && membresia) {
    return <Navigate to={shell.inicio} replace />;
  }

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const resultado = await login(email, password);
    setEnviando(false);
    if (!resultado.ok) setError(resultado.error);
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
            Todo tu negocio,
            <br />
            <span className="text-menta">en un solo lugar.</span>
          </h2>
          <p className="max-w-[340px] text-[15px] leading-relaxed text-white/70">
            Agenda, servicios, equipo, caja y reportes. Turnio reemplaza el
            cuaderno y el WhatsApp para que gestiones tu barbería o salón
            sin perder el control.
          </p>
        </div>

        <div className="relative z-10 flex gap-8 border-t border-white/10 pt-6">
          <div>
            <p className="text-2xl font-bold text-white">5 min</p>
            <p className="text-[12px] text-white/50">Setup completo</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">24/7</p>
            <p className="text-[12px] text-white/50">Reservas en línea</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">$0</p>
            <p className="text-[12px] text-white/50">Para empezar</p>
          </div>
        </div>
      </aside>

      {/* Panel derecho — formulario */}
      <main className="flex flex-1 flex-col items-center justify-center p-margin-mobile md:p-10">
        <div className="w-full max-w-[440px] animate-aparecer">
          {/* Logo mobile */}
          <header className="mb-10 text-center lg:hidden">
            <div className="mb-3 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-extrabold text-white">
                T
              </span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-primary">
              Turn<span className="text-menta">io</span>
            </h1>
          </header>

          <div className="mb-8 lg:mb-10">
            <h1 className="text-2xl font-bold text-primary lg:text-[28px]">
              Bienvenido de vuelta
            </h1>
            <p className="mt-1.5 text-[15px] text-on-surface-variant">
              Ingresa a tu cuenta para gestionar tu negocio.
            </p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
            <Input
              label="Email"
              icono="mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@correo.com"
              autoComplete="email"
              required
            />

            <Input
              label="Contraseña"
              icono="lock"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              error={error ?? undefined}
            />

            <div className="flex items-center justify-between gap-3">
              <Switch
                checked={recordar}
                onChange={setRecordar}
                label="Recordar sesión"
              />
              <button
                type="button"
                className="shrink-0 text-[13px] font-semibold text-menta transition-colors hover:text-menta-oscura"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <Button type="submit" tamano="lg" anchoCompleto cargando={enviando} className="mt-2">
              {enviando ? "Verificando…" : "Entrar"}
              {!enviando && <Icon name="arrow_forward" />}
            </Button>
          </form>

          {/* Separador */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-outline-variant" />
            <span className="text-[12px] font-medium text-on-surface-variant">¿Nuevo en Turnio?</span>
            <div className="h-px flex-1 bg-outline-variant" />
          </div>

          <Link
            to="/registro"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-menta/30 bg-menta/5 px-7 py-3.5 text-[14px] font-bold text-menta transition-all hover:bg-menta/10"
          >
            <Icon name="storefront" className="text-[20px]" />
            Registra tu negocio gratis
          </Link>
        </div>
      </main>
    </div>
  );
}
