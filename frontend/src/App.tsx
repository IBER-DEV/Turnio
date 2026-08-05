import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { RutaProtegida } from "./components/RutaProtegida";
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
const MisServiciosPage = lazy(() =>
  import("./pages/servicios/MisServiciosPage").then((m) => ({ default: m.MisServiciosPage })),
);
const ValidarServiciosPage = lazy(() =>
  import("./pages/servicios/ValidarServiciosPage").then((m) => ({ default: m.ValidarServiciosPage })),
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

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
      <ToastProvider>
        <AuthProvider>
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
              {/* Sin `capacidad`: cualquier miembro puede haber hecho un
                  servicio, incluido el dueño operador único. */}
              <Route
                path="/servicios/mios"
                element={
                  <RutaProtegida>
                    <Layout>
                      <MisServiciosPage />
                    </Layout>
                  </RutaProtegida>
                }
              />
              <Route
                path="/servicios/validar"
                element={
                  <RutaProtegida capacidad="puede_aprobar_servicios">
                    <Layout>
                      <ValidarServiciosPage />
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
        </AuthProvider>
      </ToastProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
