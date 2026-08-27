import { LogOut, MoreHorizontal, Plus, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useI18n } from "../../i18n/LanguageProvider";
import ShellPreferences from "./ShellPreferences";
import {
  MOBILE_MORE_ITEMS,
  MOBILE_PRIMARY_ITEMS,
  MOBILE_SECONDARY_ITEMS,
} from "./navigationItems";

function getNavClass({ isActive }) {
  return `app-mobile-nav-link${isActive ? " app-mobile-nav-link-active" : ""}`;
}

function MobileNavLink({ item, onClick }) {
  const { t } = useI18n();
  const Icon = item.icon;

  return (
    <NavLink to={item.to} end={item.end} className={getNavClass} onClick={onClick}>
      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}

export default function MobileNavigation({ user, onLogout }) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const [moreOpenPath, setMoreOpenPath] = useState(null);
  const isMoreOpen = moreOpenPath === pathname;

  useEffect(() => {
    if (!isMoreOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setMoreOpenPath(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMoreOpen]);

  return (
    <>
      {isMoreOpen ? (
        <div className="app-mobile-more" id="mobile-more-menu">
          <div className="app-mobile-more-header">
            <div>
              <strong>{user?.name || t("common.brandName")}</strong>
              <small>{user?.email || t("navbar.account")}</small>
            </div>
            <button
              type="button"
              className="app-icon-button"
              onClick={() => setMoreOpenPath(null)}
              aria-label={t("navbar.closeMenu")}
              title={t("navbar.closeMenu")}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <nav className="app-mobile-more-links" aria-label={t("navbar.moreNavigation")}>
            {MOBILE_MORE_ITEMS.map((item) => (
              <MobileNavLink key={item.to} item={item} onClick={() => setMoreOpenPath(null)} />
            ))}
            <NavLink to="/perfil" className={getNavClass} onClick={() => setMoreOpenPath(null)}>
              <UserRound size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{t("navbar.profile")}</span>
            </NavLink>
          </nav>

          <div className="app-mobile-more-footer">
            <ShellPreferences compact />
            <button type="button" className="app-mobile-logout" onClick={onLogout}>
              <LogOut size={18} aria-hidden="true" />
              <span>{t("navbar.logout")}</span>
            </button>
          </div>
        </div>
      ) : null}

      <nav className="app-mobile-nav" aria-label={t("navbar.mainNavigation")}>
        {MOBILE_PRIMARY_ITEMS.map((item) => (
          <MobileNavLink key={item.to} item={item} onClick={() => setMoreOpenPath(null)} />
        ))}

        <Link
          to="/transacoes?nova=1"
          className="app-mobile-create"
          onClick={() => setMoreOpenPath(null)}
          aria-label={t("pages.newTransaction")}
          title={t("pages.newTransaction")}
        >
          <Plus size={24} strokeWidth={2} aria-hidden="true" />
          <span>{t("navbar.newTransactionShort")}</span>
        </Link>

        {MOBILE_SECONDARY_ITEMS.slice(0, 1).map((item) => (
          <MobileNavLink key={item.to} item={item} onClick={() => setMoreOpenPath(null)} />
        ))}

        <button
          type="button"
          className={`app-mobile-nav-link${isMoreOpen ? " app-mobile-nav-link-active" : ""}`}
          onClick={() => setMoreOpenPath((current) => (current === pathname ? null : pathname))}
          aria-expanded={isMoreOpen}
          aria-controls="mobile-more-menu"
        >
          <MoreHorizontal size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>{t("navbar.more")}</span>
        </button>
      </nav>
    </>
  );
}
