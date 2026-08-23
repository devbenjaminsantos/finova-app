import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import RouteLoading from "./components/RouteLoading";
import { TransactionsProvider } from "./features/transactions/TransactionsProvider";
import {
  hasValidSession,
  syncSessionFromStorageEvent,
  touchSessionActivity,
} from "./lib/api/auth";

const Analyses = lazy(() => import("./pages/Analyses"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const FinancialAccounts = lazy(() => import("./pages/FinancialAccounts"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicDashboard = lazy(() => import("./pages/PublicDashboard"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Transactions = lazy(() => import("./pages/Transactions"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));

export default function App() {
  useEffect(() => {
    function handleStorage(event) {
      syncSessionFromStorageEvent(event);
    }

    function handleActivity() {
      if (hasValidSession()) {
        touchSessionActivity();
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("focus", handleActivity);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("focus", handleActivity);
    };
  }, []);

  return (
    <div className="finova-page">
      <Navbar />

      <main className="container py-4">
        <TransactionsProvider>
          <RouteErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/compartilhado/:token" element={<PublicDashboard />} />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/graficos"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route path="/dashboard" element={<Navigate to="/graficos" replace />} />

              <Route
                path="/transacoes"
                element={
                  <ProtectedRoute>
                    <Transactions />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/analises"
                element={
                  <ProtectedRoute>
                    <Analyses />
                  </ProtectedRoute>
                }
              />
              <Route path="/insights" element={<Navigate to="/analises" replace />} />
              <Route path="/comparativos" element={<Navigate to="/analises" replace />} />
              <Route path="/metas" element={<Navigate to="/analises" replace />} />

              <Route
                path="/contas"
                element={
                  <ProtectedRoute>
                    <FinancialAccounts />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/historico"
                element={
                  <ProtectedRoute>
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />

              <Route path="/auditoria" element={<Navigate to="/historico" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </TransactionsProvider>
      </main>
    </div>
  );
}
