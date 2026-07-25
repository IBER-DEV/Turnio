import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { RutaProtegida } from "./components/RutaProtegida";
import { AgendaPage } from "./pages/AgendaPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EmpleadosPage } from "./pages/EmpleadosPage";
import { LoginPage } from "./pages/LoginPage";
import { RegistroNegocioPage } from "./pages/RegistroNegocioPage";
import { ServiciosPage } from "./pages/ServiciosPage";
import { ToastProvider } from "./ui/Toast";

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
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
                <RutaProtegida>
                  <Layout>
                    <EmpleadosPage />
                  </Layout>
                </RutaProtegida>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
