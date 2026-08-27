import { Suspense, useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { TransactionsProvider } from "../../features/transactions/TransactionsProvider";
import { getStoredUser, logout } from "../../lib/api/auth";
import RouteLoading from "../RouteLoading";
import MobileNavigation from "./MobileNavigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    function syncUser() {
      setUser(getStoredUser());
    }

    window.addEventListener("finova-session-change", syncUser);
    return () => window.removeEventListener("finova-session-change", syncUser);
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  }

  return (
    <div className="app-shell">
      <Sidebar user={user} onLogout={handleLogout} />

      <div className="app-shell-content">
        <Topbar />
        <main className="app-main">
          <TransactionsProvider>
            <Suspense fallback={<RouteLoading />}>
              <Outlet />
            </Suspense>
          </TransactionsProvider>
        </main>
      </div>

      <MobileNavigation user={user} onLogout={handleLogout} />
    </div>
  );
}
