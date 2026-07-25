import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { membresia, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="layout">
      <header className="layout-header">
        <div>
          <strong>{membresia?.negocio.nombre ?? "Turnio"}</strong>
          {membresia && (
            <span className="layout-usuario">
              {" "}
              — {membresia.nombre} ({membresia.especialidad || "sin especialidad"})
            </span>
          )}
        </div>
        {membresia && (
          <nav className="layout-nav">
            <Link to="/">Inicio</Link>
            <Link to="/servicios">Servicios</Link>
            <Link to="/agenda">Agenda</Link>
            <Link to="/empleados">Empleados</Link>
            <button type="button" onClick={handleLogout}>
              Salir
            </button>
          </nav>
        )}
      </header>
      <main className="layout-main">{children}</main>
    </div>
  );
}
