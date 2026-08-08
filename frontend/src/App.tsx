import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { RutaProtegida } from "./components/RutaProtegida";
import { EstadoNegocioProvider } from "./onboarding/estadoNegocio";
import { ToastProvider } from "./ui/Toast";
import { TooltipProvider } from "./ui/Tooltip";

// Cada pantalla en su propio chunk (`import()` dinámico): un visitante
// que abre `/{slug}` — sin sesión, muchas veces con datos móviles — no
// tiene por qué descargar el panel del staff (formularios de Agenda,
// calendario, gestión de equipo…) para ver un perfil público, ni al
// revés. `Layout` y `RutaProtegida` se quedan eager: son la cáscara que
// comparten todas las pantallas de staff, no el peso que había que
// separar.
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ServiciosPage = lazy(() => import("./pages/ServiciosPage").then((m) => ({ default: m.ServiciosPage })));
const AgendaPage = lazy(() => import("./pages/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const EmpleadosPage = lazy(() => import("./pages/EmpleadosPage").then((m) => ({ default: m.EmpleadosPage })));
const ConfiguracionCargosPage = lazy(() =>
  import("./pages/ConfiguracionCargosPage").then((m) => ({ default: m.ConfiguracionCargosPage })),
);
const ConfiguracionNegocioPage = lazy(() =>
  import("./pages/ConfiguracionNegocioPage").then((m) => ({ default: m.ConfiguracionNegocioPage })),
);
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegistroNegocioPage = lazy(() =>
  import("./pages/RegistroNegocioPage").then((m) => ({ default: m.RegistroNegocioPage })),
);
const PerfilNegocioPage = lazy(() =>
  import("./pages/publico/PerfilNegocioPage").then((m) => ({ default: m.PerfilNegocioPage })),
);
const MiTrabajoPage = lazy(() =>
  import("./pages/MiTrabajoPage").then((m) => ({ default: m.MiTrabajoPage })),
);
const CajaPage = lazy(() => import("./pages/caja/CajaPage").then((m) => ({ default: m.CajaPage })));
const BienvenidaPage = lazy(() =>
  import("./onboarding/BienvenidaPage").then((m) => ({ default: m.BienvenidaPage })),
);

function CargandoRuta() {
  // Sin logo ni layout propio a propósito: esta pantalla la ve tanto un
  // visitante público como el staff, mientras el chunk de la ruta
  // llega. Un parpadeo de "Turnio" en cada navegación sería más ruido
  // que ayuda para algo que dura una fracción de segundo con caché tibia.
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="font-body-md text-body-md text-on-surface-variant">Cargando…</p>
    </div>
  );
}

/** El onboarding, exigiendo sesión pero sin la puerta que redirige acá.
 *
 * `RutaProtegida` manda a `/bienvenida` cuando el negocio está
 * incompleto; envolver esta ruta con ella sería un bucle. Se repite el
 * chequeo mínimo de sesión, que es lo único que de verdad hace falta.
 */
function RutaBienvenida() {
  const { cargando, membresia } = useAuth();

  if (cargando) {
    return <CargandoRuta />;
  }
  if (!membresia) {
    return <Navigate to="/login" replace />;
  }
  return <BienvenidaPage />;
}

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
      <ToastProvider>
        <AuthProvider>
          <EstadoNegocioProvider>
          <Suspense fallback={<CargandoRuta />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/registro" element={<RegistroNegocioPage />} />
              <Route
                path="/"
                element={
                  <RutaProtegida>
                    <Layout>
                      <DashboardPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              {/* Sin `Layout` a propósito: el onboarding es pantalla
                  completa. La barra de navegación ofrece secciones que
                  todavía no sirven de nada (una agenda sin horario, una
                  caja sin servicios) y sería justo la distracción que
                  este flujo existe para evitar.

                  Tampoco lleva `RutaProtegida`: esa es la que redirige
                  acá, y usarla se mordería la cola. La sesión se exige a
                  mano abajo. */}
              <Route path="/bienvenida" element={<RutaBienvenida />} />
              <Route
                path="/servicios"
                element={
                  <RutaProtegida>
                    <Layout>
                      <ServiciosPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              <Route
                path="/agenda"
                element={
                  <RutaProtegida>
                    <Layout>
                      <AgendaPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              <Route
                path="/empleados"
                element={
                  <RutaProtegida capacidad="puede_gestionar_empleados">
                    <Layout>
                      <EmpleadosPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              <Route
                path="/configuracion/cargos"
                element={
                  <RutaProtegida capacidad="puede_gestionar_empleados">
                    <Layout>
                      <ConfiguracionCargosPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              <Route
                path="/configuracion/negocio"
                element={
                  <RutaProtegida capacidad="puede_editar_negocio">
                    <Layout>
                      <ConfiguracionNegocioPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              {/* Sin `capacidad`: cualquier miembro tiene trabajo propio
                  que mirar, incluido el dueño operador único. El backend
                  ya acota el listado a lo suyo. */}
              <Route
                path="/mi-trabajo"
                element={
                  <RutaProtegida>
                    <Layout>
                      <MiTrabajoPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              {/* `puede_cobrar` **o** `puede_ver_reportes`: quien solo ve
                  reportes entra al histórico de cajas sin poder cobrar
                  (`CONTRATO.md` 5.14), y la pantalla ya esconde las
                  acciones que no le corresponden. */}
              <Route
                path="/caja"
                element={
                  <RutaProtegida capacidades={["puede_cobrar", "puede_ver_reportes"]}>
                    <Layout>
                      <CajaPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              {/* Perfil público del negocio, sin auth — el reemplazo de
                  "escríbeme por WhatsApp" que es Fase 2. Un segmento
                  literal (`/login`, `/agenda`, …) siempre gana sobre
                  `:slug` en el ranking de React Router, así que el
                  orden de declaración no importa acá; igual va al
                  final por legibilidad, reflejando que es el catch-all
                  que `SLUGS_RESERVADOS` (backend) protege. */}
              <Route path="/:slug" element={<PerfilNegocioPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </EstadoNegocioProvider>
        </AuthProvider>
      </ToastProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
