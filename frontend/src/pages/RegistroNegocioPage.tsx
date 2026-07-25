import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

const VACIO = {
  nombre_negocio: "",
  ciudad: "",
  direccion: "",
  telefono: "",
  email_dueno: "",
  nombre_dueno: "",
  password_dueno: "",
};

export function RegistroNegocioPage() {
  const { membresia, cargando, registrarNegocio } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!cargando && membresia) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const resultado = await registrarNegocio(datos);
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
        <h1>Registra tu negocio</h1>
        <p>Arrancas como dueño, con todas las capacidades. Podrás agregar empleados después.</p>
        <label>
          Nombre del negocio
          <input
            value={datos.nombre_negocio}
            onChange={(e) => setDatos({ ...datos, nombre_negocio: e.target.value })}
            required
          />
        </label>
        <label>
          Ciudad
          <input
            value={datos.ciudad}
            onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })}
          />
        </label>
        <label>
          Dirección
          <input
            value={datos.direccion}
            onChange={(e) => setDatos({ ...datos, direccion: e.target.value })}
          />
        </label>
        <label>
          Teléfono
          <input
            value={datos.telefono}
            onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
          />
        </label>
        <hr />
        <label>
          Tu nombre
          <input
            value={datos.nombre_dueno}
            onChange={(e) => setDatos({ ...datos, nombre_dueno: e.target.value })}
            required
          />
        </label>
        <label>
          Tu email
          <input
            type="email"
            value={datos.email_dueno}
            onChange={(e) => setDatos({ ...datos, email_dueno: e.target.value })}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={datos.password_dueno}
            onChange={(e) => setDatos({ ...datos, password_dueno: e.target.value })}
            required
            autoComplete="new-password"
          />
        </label>
        {error && <p className="mensaje-error">{error}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? "Creando…" : "Crear negocio"}
        </button>
        <p>
          ¿Ya tienes cuenta? <Link to="/login">Entra aquí</Link>
        </p>
      </form>
    </div>
  );
}
