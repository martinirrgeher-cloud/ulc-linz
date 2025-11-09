import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Login1 from "@/pages/Login1";
import Login2 from "@/pages/Login2";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/store/AuthContext";
import { ToastProvider } from "@/components/toast/ToastContext";

// Lazy module pages that actually exist in this project
const Kindertraining = React.lazy(() => import("@/modules/kindertraining/Kindertraining"));
const Anmeldung = React.lazy(() => import("@/modules/leistungsgruppe/anmeldung/Anmeldung"));
const Uebungskatalog = React.lazy(() => import("@/modules/uebungskatalog/Uebungskatalog"));
const Uebungspflege = React.lazy(() => import("@/modules/uebungspflege/Uebungspflege"));
const Athleten = React.lazy(() => import("@/modules/athleten/Athleten"));
const DriveDebug = React.lazy(() => import("@/pages/DriveDebug"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div style={{padding:16}}>Laden…</div>}>
            <Routes>
              <Route path="/login1" element={<Login1 />} />
              <Route path="/login2" element={<Login2 />} />

              <Route
                path="/"
                element={
                  <RequireAuth>
                    <AppShell title="Hauptmenü">
                      <Dashboard />
                    </AppShell>
                  </RequireAuth>
                }
              />

              <Route
                path="/kindertraining"
                element={
                  <RequireAuth requiredModules={["KINDERTRAINING"]}>
                    <Kindertraining />
                  </RequireAuth>
                }
              />
              <Route
                path="/leistungsgruppe/anmeldung"
                element={
                  <RequireAuth requiredModules={["LEISTUNGSGRUPPE-ANMELDUNG"]}>
                    <Anmeldung />
                  </RequireAuth>
                }
              />
              <Route
                path="/uebungskatalog"
                element={
                  <RequireAuth requiredModules={["UEBUNGSKATALOG"]}>
                    <Uebungskatalog />
                  </RequireAuth>
                }
              />
              <Route
                path="/uebungspflege"
                element={
                  <RequireAuth requiredModules={["UEBUNGSPFLEGE"]}>
                    <Uebungspflege />
                  </RequireAuth>
                }
              />
              <Route
                path="/athleten"
                element={
                  <RequireAuth requiredModules={["ATHLETEN"]}>
                    <Athleten />
                  </RequireAuth>
                }
              />
              <Route path="/debug/drive" element={<DriveDebug />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
