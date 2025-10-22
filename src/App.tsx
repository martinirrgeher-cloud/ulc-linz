import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import useTokenRefresh from "@/hooks/useTokenRefresh";
import Login1 from "./pages/Login1";
import Login2 from "./pages/Login2";
import Dashboard from "./pages/Dashboard";
import Kindertraining from "./modules/kindertraining/Kindertraining";
import RequireAuth from "./components/RequireAuth";
import StatistikPage from "@/modules/kindertraining/pages/statistik";


export default function App() {
  useTokenRefresh();
  return (
    <BrowserRouter>
      <Routes>
        {/* Login-Seiten */}
        <Route path="/login1" element={<Login1 />} />
        <Route path="/login2" element={<Login2 />} />

        {/* Dashboard als Startseite */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        {/* Optionaler Alias: /dashboard (führt zur gleichen Seite) */}
        <Route
          path="/dashboard"
          element={<Navigate to="/" replace />}
        />

        {/* Module */}
        <Route
          path="/kindertraining"
          element={
            <RequireAuth>
              <Kindertraining />
            </RequireAuth>
          }
        />
<Route path="/kindertraining/statistik" element={<StatistikPage />} />
        {/* Fallback */}
        <Route path="*" element={<Login1 />} />
      </Routes>
    </BrowserRouter>
  );
}
