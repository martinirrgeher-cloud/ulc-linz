// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import MainMenu from "./pages/MainMenu";
import Kindertraining from "./modules/Kindertraining/Kindertraining"; // 👈 wichtig!
import Wochentage from "./modules/Kindertraining/Wochentage";
import Statistik from "./modules/Kindertraining/Statistik";
import { initGoogleAuth } from "./lib/googleAuth";
import { ROUTES } from "./routes";

export default function App() {
  // Google Auth direkt beim App-Start initialisieren
  useEffect(() => {
    initGoogleAuth();
  }, []);

  return (
    <Router>
      <Routes>
        {/* Login */}
        <Route path={ROUTES.LOGIN} element={<Login />} />

        {/* Hauptmenü */}
        <Route
          path={ROUTES.MENU}
          element={
            <ProtectedRoute>
              <MainMenu />
            </ProtectedRoute>
          }
        />

        {/* Kindertraining-Modul */}
        <Route
          path={ROUTES.KINDERTRAINING}
          element={
            <ProtectedRoute>
              <Kindertraining />
            </ProtectedRoute>
          }
        />
{/* Wochentage */}
<Route
  path={ROUTES.KINDERTRAINING_WOCHENTAGE}
  element={
    <ProtectedRoute>
      <Wochentage />
    </ProtectedRoute>
  }
/>

{/* Statistik */}
<Route
  path={ROUTES.KINDERTRAINING_STATISTIK}
  element={
    <ProtectedRoute>
      <Statistik />
    </ProtectedRoute>
  }
/>

        {/* Fallback: unbekannte Pfade -> Login */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}
