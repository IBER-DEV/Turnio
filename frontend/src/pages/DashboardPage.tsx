import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { membresia } = useAuth();
  if (!membresia) return null;

  const capacidades = [
    ["Cobrar", membresia.puede_cobrar],
    ["Ver reportes", membresia.puede_ver_reportes],
    ["Editar precios", membresia.puede_editar_precios],
    ["Gestionar empleados", membresia.puede_gestionar_empleados],
    ["Gestionar agenda", membresia.puede_gestionar_agenda],
  ] as const;

  return (
    <div>
      <h1>Hola, {membresia.nombre}</h1>
      <p>
        Negocio: <strong>{membresia.negocio.nombre}</strong>
        {membresia.negocio.ciudad && ` — ${membresia.negocio.ciudad}`}
      </p>
      <h2>Tus capacidades en este negocio</h2>
      <ul className="lista-capacidades">
        {capacidades.map(([etiqueta, valor]) => (
          <li key={etiqueta} className={valor ? "capacidad-si" : "capacidad-no"}>
            {valor ? "✓" : "✗"} {etiqueta}
          </li>
        ))}
      </ul>
    </div>
  );
}
