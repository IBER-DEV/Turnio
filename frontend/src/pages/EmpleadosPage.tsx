import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";

type MiembroNegocio = components["schemas"]["MiembroNegocio"];
type EmpleadoAlta = components["schemas"]["EmpleadoAlta"];

const CAPACIDADES: Array<{ campo: keyof EmpleadoAlta & keyof MiembroNegocio; etiqueta: string }> = [
  { campo: "puede_cobrar", etiqueta: "Cobrar" },
  { campo: "puede_ver_reportes", etiqueta: "Ver reportes" },
  { campo: "puede_editar_precios", etiqueta: "Editar precios" },
  { campo: "puede_gestionar_empleados", etiqueta: "Gestionar empleados" },
  { campo: "puede_gestionar_agenda", etiqueta: "Gestionar agenda" },
];

const NUEVO_VACIO: EmpleadoAlta = {
  email: "",
  nombre: "",
  password: "",
  especialidad: "",
  puede_cobrar: false,
  puede_ver_reportes: false,
  puede_editar_precios: false,
  puede_gestionar_empleados: false,
  puede_gestionar_agenda: false,
};

export function EmpleadosPage() {
  const { membresia } = useAuth();
  const puedeGestionar = membresia?.puede_gestionar_empleados ?? false;

  const [empleados, setEmpleados] = useState<MiembroNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState<EmpleadoAlta>(NUEVO_VACIO);
  const [error, setError] = useState<string | null>(null);

  async function cargarEmpleados() {
    setCargando(true);
    const { data } = await conReintentoDeAuth(() => apiClient.GET("/api/negocios/empleados/"));
    setEmpleados(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarEmpleados();
  }, []);

  async function handleCrear(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/negocios/empleados/", { body: nuevo }),
    );

    if (errorRespuesta) {
      setError("No se pudo crear el empleado. Revisa que el email no esté ya registrado.");
      return;
    }

    setNuevo(NUEVO_VACIO);
    await cargarEmpleados();
  }

  async function handleCambiarCapacidad(
    empleado: MiembroNegocio,
    campo: (typeof CAPACIDADES)[number]["campo"],
    valor: boolean,
  ) {
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/negocios/empleados/{id}/", {
        params: { path: { id: empleado.id } },
        body: { [campo]: valor },
      }),
    );

    if (!errorRespuesta && data) {
      setEmpleados((actual) => actual.map((e) => (e.id === empleado.id ? data : e)));
    }
  }

  return (
    <div>
      <h1>Empleados</h1>

      {puedeGestionar && (
        <form className="formulario-inline" onSubmit={handleCrear}>
          <h2>Nuevo empleado</h2>
          <label>
            Nombre
            <input
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={nuevo.email}
              onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
              required
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={nuevo.password}
              onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
              required
            />
          </label>
          <label>
            Especialidad
            <input
              value={nuevo.especialidad}
              onChange={(e) => setNuevo({ ...nuevo, especialidad: e.target.value })}
              placeholder="Ej. Barbero, Estilista…"
            />
          </label>
          <fieldset>
            <legend>Capacidades</legend>
            {CAPACIDADES.map(({ campo, etiqueta }) => (
              <label key={campo} style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={Boolean(nuevo[campo])}
                  onChange={(e) => setNuevo({ ...nuevo, [campo]: e.target.checked })}
                />
                {etiqueta}
              </label>
            ))}
          </fieldset>
          {error && <p className="mensaje-error">{error}</p>}
          <button type="submit">Crear empleado</button>
        </form>
      )}

      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Especialidad</th>
              {CAPACIDADES.map(({ campo, etiqueta }) => (
                <th key={campo}>{etiqueta}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empleados.map((empleado) => (
              <tr key={empleado.id}>
                <td>{empleado.nombre}</td>
                <td>{empleado.email}</td>
                <td>{empleado.especialidad || "—"}</td>
                {CAPACIDADES.map(({ campo }) => (
                  <td key={campo}>
                    <input
                      type="checkbox"
                      checked={Boolean(empleado[campo])}
                      disabled={!puedeGestionar}
                      onChange={(e) => handleCambiarCapacidad(empleado, campo, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
