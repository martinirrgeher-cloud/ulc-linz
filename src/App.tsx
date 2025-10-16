// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";

import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import MainMenu from "./pages/MainMenu";
import Kindertraining from "./modules/Kindertraining/Kindertraining";
import Wochentage from "./modules/Kindertraining/Wochentage";
import Statistik from "./modules/Kindertraining/Statistik";
import { initGoogleAuth } from "./lib/googleAuth";
import { ROUTES } from "./routes";
import AuthCallback from "./pages/AuthCallback";
import UserLogin from "./pages/UserLogin";

export default function App() {
  useEffect(() => {
    initGoogleAuth();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />

        {/* Stufe 2 */}
        <Route path={ROUTES.LOGIN_INTERNAL} element={<UserLogin />} />

        {/* Menü (Token genügt) */}
        <Route
          path={ROUTES.MENU}
          element={
            <ProtectedRoute>
              <MainMenu />
            </ProtectedRoute>
          }
        />

        {/* Module (Token + ggf. Benutzerrechte) */}
        <Route
          path={ROUTES.KINDERTRAINING}
          element={
            <ProtectedRoute requireModule="KINDERTRAINING">
              <Kindertraining />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.KINDERTRAINING_WOCHENTAGE}
          element={
            <ProtectedRoute requireModule="KINDERTRAINING">
              <Wochentage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.KINDERTRAINING_STATISTIK}
          element={
            <ProtectedRoute requireModule="KINDERTRAINING">
              <Statistik />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
}
