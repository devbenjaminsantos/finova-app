import { lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import AppShell from "./components/layout/AppShell";
import PublicLayout from "./components/layout/PublicLayout";
import {
  hasValidSession,
  syncSessionFromStorageEvent,
  touchSessionActivity,
} from "./lib/api/auth";

const Analyses = lazy(() => import("./pages/Analyses"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
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
    <RouteErrorBoundary>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/compartilhado/:token" element={<PublicDashboard />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Home />} />

          <Route path="/graficos" element={<Navigate to="/analises" replace />} />

          <Route path="/dashboard" element={<Navigate to="/analises" replace />} />

          <Route path="/transacoes" element={<Transactions />} />

          <Route path="/analises" element={<Analyses />} />
          <Route path="/insights" element={<Navigate to="/analises" replace />} />
          <Route path="/comparativos" element={<Navigate to="/analises" replace />} />
          <Route path="/metas" element={<Navigate to="/analises" replace />} />

          <Route path="/contas" element={<FinancialAccounts />} />

          <Route path="/perfil" element={<Profile />} />

          <Route path="/historico" element={<AuditLogs />} />

          <Route path="/auditoria" element={<Navigate to="/historico" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </RouteErrorBoundary>
  );
}
