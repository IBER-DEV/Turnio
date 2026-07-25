import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import type { ServicioInput } from "../api/types";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";

type Servicio = components["schemas"]["Servicio"];

const SERVICIO_VACIO: ServicioInput = {
  nombre: "",
  descripcion: "",
  categoria: "",
  precio: "0",
  duracion_minutos: 30,
  porcentaje_comision: "0",
  activo: true,
};

export function ServiciosPage() {
  const { membresia } = useAuth();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState<ServicioInput>(SERVICIO_VACIO);
  const [error, setError] = useState<string | null>(null);

  const puedeEditar = membresia?.puede_editar_precios ?? false;

  async function cargarServicios() {
    setCargando(true);
    const { data } = await conReintentoDeAuth(() => apiClient.GET("/api/servicios/"));
    setServicios(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarServicios();
  }, []);

  async function handleCrear(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/servicios/", {
        body: nuevo as components["schemas"]["Servicio"],
      }),
    );

    if (errorRespuesta) {
      setError("No se pudo crear el servicio. Revisa los datos.");
      return;
    }

    setNuevo(SERVICIO_VACIO);
    await cargarServicios();
  }

  async function handleToggleActivo(servicio: Servicio) {
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/servicios/{id}/", {
        params: { path: { id: servicio.id } },
        body: { activo: !servicio.activo },
      }),
    );
    if (!errorRespuesta && data) {
      setServicios((actual) => actual.map((s) => (s.id === servicio.id ? data : s)));
    }
  }

  return (
    <div>
      <h1>Servicios</h1>

      {puedeEditar && (
        <form className="formulario-inline" onSubmit={handleCrear}>
          <h2>Nuevo servicio</h2>
          <label>
            Nombre
            <input
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              required
            />
          </label>
          <label>
            Categoría
            <input
              value={nuevo.categoria}
              onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
              placeholder="Ej. Corte, Barba…"
            />
          </label>
          <label>
            Precio
            <input
              type="number"
              min="0"
              step="0.01"
              value={nuevo.precio}
              onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
              required
            />
          </label>
          <label>
            Duración (minutos)
            <input
              type="number"
              min="1"
              value={nuevo.duracion_minutos}
              onChange={(e) =>
                setNuevo({ ...nuevo, duracion_minutos: Number(e.target.value) })
              }
              required
            />
          </label>
          <label>
            % Comisión
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={nuevo.porcentaje_comision}
              onChange={(e) => setNuevo({ ...nuevo, porcentaje_comision: e.target.value })}
            />
          </label>
          {error && <p className="mensaje-error">{error}</p>}
          <button type="submit">Crear servicio</button>
        </form>
      )}

      {cargando ? (
        <p>Cargando…</p>
      ) : servicios.length === 0 ? (
        <p>Todavía no hay servicios registrados.</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Duración</th>
              <th>Comisión</th>
              <th>Activo</th>
              {puedeEditar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {servicios.map((servicio) => (
              <tr key={servicio.id}>
                <td>{servicio.nombre}</td>
                <td>{servicio.categoria || "—"}</td>
                <td>${servicio.precio}</td>
                <td>{servicio.duracion_minutos} min</td>
                <td>{servicio.porcentaje_comision}%</td>
                <td>{servicio.activo ? "Sí" : "No"}</td>
                {puedeEditar && (
                  <td>
                    <button type="button" onClick={() => handleToggleActivo(servicio)}>
                      {servicio.activo ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
