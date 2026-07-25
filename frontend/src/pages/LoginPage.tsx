import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

export function LoginPage() {
  const { membresia, cargando, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!cargando && membresia) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const resultado = await login(email, password);
    setEnviando(false);
    if (resultado.ok) {
      navigate("/");
    } else {
      setError(resultado.error);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-margin-mobile">
      {/* Halos de fondo decorativos, solo en pantallas grandes. */}
      <div
        aria-hidden="true"
        className="fixed right-0 top-0 -z-10 hidden h-1/3 w-1/3 opacity-20 md:block"
      >
        <div className="h-full w-full -translate-y-1/2 translate-x-1/2 rounded-full bg-surface-container-high blur-[120px]" />
      </div>
      <div
        aria-hidden="true"
        className="fixed bottom-0 left-0 -z-10 hidden h-1/4 w-1/4 opacity-30 md:block"
      >
        <div className="h-full w-full -translate-x-1/2 translate-y-1/2 rounded-full bg-secondary-fixed-dim blur-[100px]" />
      </div>

      <main className="flex w-full max-w-[440px] flex-col items-center gap-xl">
        <header className="text-center">
          <h1 className="font-headline-lg text-headline-lg-mobile uppercase tracking-tight text-primary md:text-headline-lg">
            Turnio
          </h1>
          <p className="mt-xs font-body-md text-body-md text-on-surface-variant">
            Gestiona tu negocio con calma.
          </p>
        </header>

        <div className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-card md:p-xl">
          <form className="flex flex-col gap-md" onSubmit={handleSubmit} noValidate>
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

            <Button type="submit" tamano="lg" anchoCompleto cargando={enviando} className="mt-md">
              {enviando ? "Verificando…" : "Entrar"}
            </Button>
          </form>

          <div className="mt-lg border-t border-outline-variant pt-lg text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              ¿No tienes cuenta?{" "}
              <Link to="/registro" className="font-bold text-primary hover:underline">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </div>

        <footer className="max-w-sm px-md text-center">
          <p className="font-caption text-caption italic text-on-surface-variant">
            "La herramienta diseñada para barbershops, salones de belleza y centros de bienestar
            profesionales."
          </p>
        </footer>
      </main>
    </div>
  );
}
