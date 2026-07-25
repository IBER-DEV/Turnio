import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

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
    <div className="pantalla-login">
      <form className="formulario" onSubmit={handleSubmit}>
        <h1>Turnio</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mensaje-error">{error}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
        <p>
          ¿No tienes negocio todavía? <Link to="/registro">Regístralo aquí</Link>
        </p>
      </form>
    </div>
  );
}
