import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth, AuthProvider } from "@/store/AuthContext";
import Login1 from "@/pages/Login1";
import Login2 from "@/pages/Login2";
import Dashboard from "@/pages/Dashboard";
import Kindertraining from "@/modules/kindertraining/Kindertraining";
import Statistik from "@/modules/kindertraining/pages/Statistik";

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
          <Route path="/login1" element={<Login1 />} />
          <Route path="/login2" element={<Login2 />} />

          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />

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


          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
