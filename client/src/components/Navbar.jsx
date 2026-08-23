import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import BrandMark from "./BrandMark";
import { useI18n } from "../i18n/LanguageProvider";
import { getStoredUser, hasValidSession, logout } from "../lib/api/auth";
import { useTheme } from "../theme/ThemeProvider";

export default function Navbar() {
  const navigate = useNavigate();
  const { theme, isDark, toggleTheme } = useTheme();
  const { language, languages, setLanguage, t } = useI18n();
  const [hasSession, setHasSession] = useState(() => hasValidSession());
  const [user, setUser] = useState(() => getStoredUser());

  const linkClass = ({ isActive }) =>
    "nav-link px-2 finova-navbar-link" +
    (isActive ? " fw-semibold text-white finova-navbar-link-active" : " text-white-50");

  useEffect(() => {
    function syncSession() {
      setHasSession(hasValidSession());
      setUser(getStoredUser());
    }

    syncSession();
    window.addEventListener("finova-session-change", syncSession);

    return () => {
      window.removeEventListener("finova-session-change", syncSession);
    };
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate("/login");
    }
  }

  return (
    <nav
      className="navbar navbar-expand-xl border-bottom finova-navbar"
      style={{ background: "var(--nav-surface)", borderColor: "var(--nav-border)" }}
    >
      <div className="container">
        <NavLink className="navbar-brand text-white finova-brand-link" to="/">
          <BrandMark size="navbar" />
        </NavLink>

        <div className="d-flex align-items-center order-lg-2 ms-auto finova-navbar-actions">
          <button
            type="button"
            className="btn finova-theme-toggle finova-icon-tooltip"
            onClick={toggleTheme}
            aria-label={isDark ? t("navbar.openLight") : t("navbar.openDark")}
            title={isDark ? t("navbar.openLight") : t("navbar.openDark")}
            data-tooltip={isDark ? t("navbar.openLight") : t("navbar.openDark")}
          >
            <span className="finova-theme-toggle-icon" aria-hidden="true">
              {theme === "dark" ? "\u2600" : "\u263E"}
            </span>
          </button>

          <select
            className="form-select finova-select finova-language-select"
            aria-label={t("common.languageLabel")}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {languages.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            className="navbar-toggler finova-navbar-toggler finova-icon-tooltip"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#nav"
            aria-controls="nav"
            aria-expanded="false"
            aria-label={t("navbar.toggleNav")}
            title={t("navbar.toggleNav")}
            data-tooltip={t("navbar.toggleNav")}
          >
            <span className="navbar-toggler-icon" />
          </button>
        </div>

        <div className="collapse navbar-collapse order-lg-1" id="nav">
          <div className="navbar-nav ms-auto align-items-xl-center finova-navbar-links">
            {hasSession ? (
              <>
                <NavLink className={linkClass} to="/">
                  {t("navbar.home")}
                </NavLink>
                <NavLink className={linkClass} to="/graficos">
                  {t("navbar.charts")}
                </NavLink>
                <NavLink className={linkClass} to="/transacoes">
                  {t("navbar.transactions")}
                </NavLink>
                <NavLink className={linkClass} to="/analises">
                  {t("navbar.analyses")}
                </NavLink>
                <NavLink className={linkClass} to="/contas">
                  {t("navbar.accounts")}
                </NavLink>
                <NavLink className={linkClass} to="/historico">
                  {t("navbar.history")}
                </NavLink>
                <NavLink className={linkClass} to="/perfil">
                  {t("navbar.profile")}
                </NavLink>

                <div className="finova-navbar-account-area">
                  <span
                    className="text-white-50 small finova-navbar-user"
                    title={user?.name || t("common.brandName")}
                  >
                    {user?.name || t("common.brandName")}
                  </span>

                  <button className="btn finova-btn-light btn-sm finova-navbar-logout" onClick={handleLogout}>
                    {t("navbar.logout")}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
