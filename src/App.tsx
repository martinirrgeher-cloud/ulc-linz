import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Login1 from "@/pages/Login1";
import Login2 from "@/pages/Login2";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/store/AuthContext";
import { MODULES } from "@/modules/registry";
import { ToastProvider } from "@/components/toast/ToastContext";
import { Suspense, lazy } from "react";

/** Lazy imports of module pages (keep your existing files) */
const Kindertraining = React.lazy(() => import("@/modules/kindertraining/Kindertraining"));
const Anmeldung = React.lazy(() => import("@/modules/leistungsgruppe/anmeldung/Anmeldung"));
const Uebungskatalog = React.lazy(() => import("@/modules/uebungskatalog/Uebungskatalog"));
const Uebungspflege  = React.lazy(() => import("@/modules/uebungspflege/Uebungspflege"));
const Athleten = React.lazy(() => import("@/modules/athleten/Athleten"));
const Trainingsplan = React.lazy(() => import("@/modules/trainingsplan/pages/Trainingsplan"));
const DriveDebug = lazy(() => import("@/pages/DriveDebug"));

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return <AppShell title={title} showSettings>{children}</AppShell>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
       <ToastProvider>
        <React.Suspense fallback={<div style={{padding:16}}>Laden…</div>}>
<Suspense fallback={<div className="p-4 text-sm">Lade…</div>}>          
<Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login1" element={<Login1 />} />
            <Route path="/login2" element={<Login2 />} />
            <Route
              path="/kindertraining"
              element={
                <RequireAuth requiredModules={["KINDERTRAINING"]}>
                  <Page title="Kindertraining"><Kindertraining /></Page>
                </RequireAuth>
              }
            />
            <Route
              path="/leistungsgruppe/anmeldung"
              element={
                <RequireAuth requiredModules={["LEISTUNGSGRUPPE-ANMELDUNG"]}>
                  <Page title="Anmeldung"><Anmeldung /></Page>
                </RequireAuth>
              }
            />
            <Route
              path="/uebungskatalog"
              element={
                <RequireAuth requiredModules={["LEISTUNGSGRUPPE","LEISTUNGSGRUPPE-ANMELDUNG","KINDERTRAINING"]}>
                  <Page title="Übungskatalog"><Uebungskatalog /></Page>
                </RequireAuth>
              }
            />
            <Route
              path="/uebungspflege"
              element={
                <RequireAuth requiredModules={["LEISTUNGSGRUPPE","LEISTUNGSGRUPPE-ANMELDUNG","KINDERTRAINING"]}>
                  <Page title="Übung hinzufügen"><Uebungspflege /></Page>
                </RequireAuth>
              }
            />
            <Route
              path="/athleten"
              element={
                <RequireAuth requiredModules={["LEISTUNGSGRUPPE","KINDERTRAINING"]}>
                  <Page title="Athleten"><Athleten /></Page>
                </RequireAuth>
              }
            />
            <Route
              path="/trainingsplan"
              element={
                <RequireAuth requiredModules={["LEISTUNGSGRUPPE","KINDERTRAINING"]}>
                  <Page title="Trainingsplan"><Trainingsplan /></Page>
                </RequireAuth>
              }
            />
<Route>
    
    <Route path="/debug/drive" element={<DriveDebug />} />
  </Route>

<Route path="/debug/drive" element={<DriveDebug />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
</Suspense>
        </React.Suspense>
       </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
