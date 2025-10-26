import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, AuthProvider } from "@/store/AuthContext";
import Login1 from "@/pages/Login1";
import Login2 from "@/pages/Login2";
import Dashboard from "@/pages/Dashboard";
import RequireAuth from "@/components/RequireAuth";
import Kindertraining from "@/modules/kindertraining/Kindertraining";
import Statistik from "@/modules/kindertraining/pages/statistik";
import Anmeldung from "@/modules/leistungsgruppe/anmeldung/Anmeldung";
import AthletenPage from "@/modules/athleten/pages/Athleten";
import UebungHinzufuegen from "@/modules/uebungspflege/pages/UebungHinzufuegen";
import Katalog from "@/modules/uebungskatalog/pages/Katalog";
import Trainingsplan from "@/modules/trainingsplan/pages/Trainingsplan";

/**
 * Standard-Login-Schutz — sorgt dafür, dass:
 * - kein Zugriff ohne Token
 * - bei Login1 / Login2 korrekt weitergeleitet wird
 */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login1" replace />;
  if (token && !user) return <Navigate to="/login2" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Loginrouten */}
          <Route path="/login1" element={<Login1 />} />
          <Route path="/login2" element={<Login2 />} />

          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />

          {/* Kindertraining */}
          <Route
            path="/kindertraining"
            element={
              <PrivateRoute>
                <Kindertraining />
              </PrivateRoute>
            }
          />
          <Route
            path="/kindertraining/statistik"
            element={
              <PrivateRoute>
                <Statistik />
              </PrivateRoute>
            }
          />

          {/* Leistungsgruppe */}
          <Route
            path="/leistungsgruppe/anmeldung"
            element={
              <PrivateRoute>
                <Anmeldung />
              </PrivateRoute>
            }
          />

          {/* ⚡ Trainingsplan: Zugriff nur für LEISTUNGSGRUPPE */}
          <Route
            path="/trainingsplan"
            element={
              <RequireAuth requiredModules={["TRAININGSPLAN"]}>
                <Trainingsplan />
              </RequireAuth>
            }
          />

          {/* ⚡ Nur für bestimmte Rollen */}
          <Route
            path="/athleten"
            element={
              <RequireAuth requiredModules={["ATHLETEN"]}>
                <AthletenPage />
              </RequireAuth>
            }
          />
          <Route
            path="/uebungspflege"
            element={
              <RequireAuth requiredModules={["UEBUNGS_PFLEGE"]}>
                <UebungHinzufuegen />
              </RequireAuth>
            }
          />
          <Route
            path="/uebungskatalog"
            element={
              <RequireAuth requiredModules={["UEBUNGSKATALOG"]}>
                <Katalog />
              </RequireAuth>
            }
          />

          {/* Standardweiterleitung */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
