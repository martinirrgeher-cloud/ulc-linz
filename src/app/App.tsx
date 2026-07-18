import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { DashboardPage } from "@/pages/DashboardPage";
import { AthleteManagementPage } from "@/pages/AthleteManagementPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { LoginPage } from "@/pages/LoginPage";
import { KindertrainingDraftPage } from "@/pages/KindertrainingDraftPage";
import { KindertrainingStatisticsPage } from "@/pages/KindertrainingStatisticsPage";
import { ModulePlaceholderPage } from "@/pages/ModulePlaceholderPage";
import { NoAccessPage } from "@/pages/NoAccessPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { SetupPage } from "@/pages/SetupPage";
import { UserManagementPage } from "@/pages/UserManagementPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registrieren" element={<RegisterPage />} />
          <Route path="/passwort-vergessen" element={<ForgotPasswordPage />} />
          <Route path="/passwort-neu" element={<ResetPasswordPage />} />

          <Route
            path="/einrichtung"
            element={
              <ProtectedRoute allowWithoutMembership>
                <SetupPage />
              </ProtectedRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route
              path="module/kindertraining"
              element={
                <ProtectedRoute moduleKey="kindertraining">
                  <KindertrainingDraftPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="module/kindertraining/statistik"
              element={
                <ProtectedRoute>
                  <KindertrainingStatisticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="module/athletes"
              element={
                <ProtectedRoute moduleKey="athletes">
                  <AthleteManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="module/user_management"
              element={
                <ProtectedRoute moduleKey="user_management">
                  <UserManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="module/:moduleKey"
              element={
                <ProtectedRoute>
                  <ModulePlaceholderPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route
            path="/kein-zugriff"
            element={
              <ProtectedRoute allowWithoutMembership>
                <NoAccessPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
