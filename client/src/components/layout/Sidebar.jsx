import { LogOut, UserRound } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useI18n } from "../../i18n/LanguageProvider";
import BrandMark from "../BrandMark";
import ShellPreferences from "./ShellPreferences";
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "./navigationItems";

function getNavClass({ isActive }) {
  return `app-nav-link${isActive ? " app-nav-link-active" : ""}`;
}

function SidebarNavItem({ item }) {
  const { t } = useI18n();
  const Icon = item.icon;

  return (
    <NavLink to={item.to} end={item.end} className={getNavClass}>
      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}

export default function Sidebar({ user, onLogout }) {
  const { t } = useI18n();

  return (
    <aside className="app-sidebar" aria-label={t("navbar.mainNavigation")}>
      <Link className="app-sidebar-brand" to="/" aria-label={t("common.brandName")}>
        <BrandMark size="navbar" />
      </Link>

      <nav className="app-sidebar-nav" aria-label={t("navbar.mainNavigation")}>
        {PRIMARY_NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.to} item={item} />
        ))}
      </nav>

      <div className="app-sidebar-footer">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.to} item={item} />
        ))}

        <NavLink to="/perfil" className={getNavClass}>
          <UserRound size={19} strokeWidth={1.8} aria-hidden="true" />
          <span>{t("navbar.profile")}</span>
        </NavLink>

        <div className="app-sidebar-preferences" aria-label={t("navbar.preferences")}>
          <ShellPreferences />
        </div>

        <div className="app-sidebar-account">
          <div className="app-sidebar-user">
            <span className="app-sidebar-avatar" aria-hidden="true">
              {(user?.name || t("common.brandName")).slice(0, 1).toUpperCase()}
            </span>
            <span className="app-sidebar-user-copy">
              <strong title={user?.name || t("common.brandName")}>
                {user?.name || t("common.brandName")}
              </strong>
              <small>{user?.email || t("navbar.account")}</small>
            </span>
          </div>

          <button
            type="button"
            className="app-icon-button"
            onClick={onLogout}
            aria-label={t("navbar.logout")}
            title={t("navbar.logout")}
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
