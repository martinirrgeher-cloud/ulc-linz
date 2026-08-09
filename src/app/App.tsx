import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { PublicHelpButton } from "@/features/help/PublicHelpButton";

const DashboardPage = lazy(async () => ({ default: (await import("@/pages/DashboardPage")).DashboardPage }));
const AthleteManagementPage = lazy(async () => ({ default: (await import("@/pages/AthleteManagementPage")).AthleteManagementPage }));
const ForgotPasswordPage = lazy(async () => ({ default: (await import("@/pages/ForgotPasswordPage")).ForgotPasswordPage }));
const LoginPage = lazy(async () => ({ default: (await import("@/pages/LoginPage")).LoginPage }));
const KindertrainingDraftPage = lazy(async () => ({ default: (await import("@/pages/KindertrainingDraftPage")).KindertrainingDraftPage }));
const KindertrainingStatisticsPage = lazy(async () => ({ default: (await import("@/pages/KindertrainingStatisticsPage")).KindertrainingStatisticsPage }));
const U12TrainingPage = lazy(async () => ({ default: (await import("@/pages/U12TrainingPage")).U12TrainingPage }));
const U14TrainingPage = lazy(async () => ({ default: (await import("@/pages/U14TrainingPage")).U14TrainingPage }));
const U12TrainingStatisticsPage = lazy(async () => ({ default: (await import("@/pages/U12TrainingStatisticsPage")).U12TrainingStatisticsPage }));
const U14TrainingStatisticsPage = lazy(async () => ({ default: (await import("@/pages/U14TrainingStatisticsPage")).U14TrainingStatisticsPage }));
const ModulePlaceholderPage = lazy(async () => ({ default: (await import("@/pages/ModulePlaceholderPage")).ModulePlaceholderPage }));
const PerformanceRegistrationPage = lazy(async () => ({ default: (await import("@/pages/PerformanceRegistrationPage")).PerformanceRegistrationPage }));
const ExerciseCatalogPage = lazy(async () => ({ default: (await import("@/pages/ExerciseCatalogPage")).ExerciseCatalogPage }));
const TrainingBlocksPage = lazy(async () => ({ default: (await import("@/pages/TrainingBlocksPage")).TrainingBlocksPage }));
const TrainingPlanningPage = lazy(async () => ({ default: (await import("@/pages/TrainingPlanningPage")).TrainingPlanningPage }));
const TrainingOverviewPage = lazy(async () => ({ default: (await import("@/pages/TrainingOverviewPage")).TrainingOverviewPage }));
const TrainingDocumentationPage = lazy(async () => ({ default: (await import("@/pages/TrainingDocumentationPage")).TrainingDocumentationPage }));
const DropdownSettingsPage = lazy(async () => ({ default: (await import("@/pages/DropdownSettingsPage")).DropdownSettingsPage }));
const DataImportPage = lazy(async () => ({ default: (await import("@/pages/DataImportPage")).DataImportPage }));
const CountdownPage = lazy(async () => ({ default: (await import("@/pages/CountdownPage")).CountdownPage }));
const ConnectionErrorPage = lazy(async () => ({ default: (await import("@/pages/ConnectionErrorPage")).ConnectionErrorPage }));
const NoAccessPage = lazy(async () => ({ default: (await import("@/pages/NoAccessPage")).NoAccessPage }));
const NotFoundPage = lazy(async () => ({ default: (await import("@/pages/NotFoundPage")).NotFoundPage }));
const RegisterPage = lazy(async () => ({ default: (await import("@/pages/RegisterPage")).RegisterPage }));
const ResetPasswordPage = lazy(async () => ({ default: (await import("@/pages/ResetPasswordPage")).ResetPasswordPage }));
const SetupPage = lazy(async () => ({ default: (await import("@/pages/SetupPage")).SetupPage }));
const UserManagementPage = lazy(async () => ({ default: (await import("@/pages/UserManagementPage")).UserManagementPage }));
const HelpPage = lazy(async () => ({ default: (await import("@/pages/HelpPage")).HelpPage }));

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PublicHelpButton />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registrieren" element={<RegisterPage />} />
            <Route path="/passwort-vergessen" element={<ForgotPasswordPage />} />
            <Route path="/passwort-neu" element={<ResetPasswordPage />} />
            <Route path="/hilfe" element={<HelpPage />} />
            <Route path="/hilfe/:topicId" element={<HelpPage />} />

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
                  <ProtectedRoute moduleKey="kindertraining">
                    <KindertrainingStatisticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/u12"
                element={
                  <ProtectedRoute moduleKey="u12">
                    <U12TrainingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/u14"
                element={
                  <ProtectedRoute moduleKey="u14">
                    <U14TrainingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/u12/statistik"
                element={
                  <ProtectedRoute moduleKey="u12">
                    <U12TrainingStatisticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/u14/statistik"
                element={
                  <ProtectedRoute moduleKey="u14">
                    <U14TrainingStatisticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/performance_registration"
                element={
                  <ProtectedRoute moduleKey="performance_registration">
                    <PerformanceRegistrationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/exercise_catalog"
                element={
                  <ProtectedRoute moduleKey="exercise_catalog">
                    <ExerciseCatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/training_planning"
                element={
                  <ProtectedRoute moduleKey="training_planning">
                    <TrainingPlanningPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/training_overview"
                element={
                  <ProtectedRoute moduleKey="training_overview">
                    <TrainingOverviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/training_documentation"
                element={
                  <ProtectedRoute moduleKey="training_documentation">
                    <TrainingDocumentationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/training_blocks"
                element={
                  <ProtectedRoute moduleKey="training_blocks">
                    <TrainingBlocksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/countdown"
                element={
                  <ProtectedRoute moduleKey="countdown">
                    <CountdownPage />
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
                path="module/dropdown_settings"
                element={
                  <ProtectedRoute moduleKey="dropdown_settings">
                    <DropdownSettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="module/data_import"
                element={
                  <ProtectedRoute moduleKey="data_import">
                    <DataImportPage />
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

            <Route path="/verbindungsfehler" element={<ConnectionErrorPage />} />

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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
