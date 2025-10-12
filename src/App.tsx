// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ROUTES } from "./routes";
import { restoreAccessToken } from "./lib/googleAuth";
import { isLoggedIn, logout } from "./lib/authStore";

// Pages
import Login from "./pages/Login";
import MainMenu from "./pages/MainMenu";
import Kindertraining from "./modules/Kindertraining/Kindertraining";
import Wochentage from "./modules/Kindertraining/Wochentage";
import Statistik from "./modules/Kindertraining/Statistik";
import U12 from "./modules/U12/U12";
import U14 from "./modules/U14/U14";
import Leistungsgruppe from "./modules/Leistungsgruppe/Leistungsgruppe";

// Protected Route
import ProtectedRoute from "./components/ProtectedRoute";

// 🪝 Beim Laden Token wiederherstellen
restoreAccessToken();
if (!localStorage.getItem("gAccessToken") || !isLoggedIn()) {
  logout();
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path={ROUTES.ROOT} element={<Navigate to={ROUTES.LOGIN} replace />} />
        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route
          path={ROUTES.MENU}
          element={
            <ProtectedRoute>
              <MainMenu />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.KINDERTRAINING}
          element={
            <ProtectedRoute module="KINDERTRAINING">
              <Kindertraining />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.KINDERTRAINING_WOCHENTAGE}
          element={
            <ProtectedRoute module="KINDERTRAINING">
              <Wochentage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.KINDERTRAINING_STATISTIK}
          element={
            <ProtectedRoute module="KINDERTRAINING">
              <Statistik />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.U12}
          element={
            <ProtectedRoute module="U12">
              <U12 />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.U14}
          element={
            <ProtectedRoute module="U14">
              <U14 />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.LEISTUNGSGRUPPE}
          element={
            <ProtectedRoute module="LEISTUNGSGRUPPE">
              <Leistungsgruppe />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
