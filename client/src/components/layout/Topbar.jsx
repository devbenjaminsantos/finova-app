import { Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../../i18n/LanguageProvider";
import BrandMark from "../BrandMark";

const PAGE_TITLE_KEYS = {
  "/": "pages.homeTitle",
  "/transacoes": "pages.transactionsTitle",
  "/analises": "pages.analysesTitle",
  "/contas": "pages.accountsTitle",
  "/historico": "pages.historyTitle",
  "/perfil": "profile.title",
};

export default function Topbar() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const titleKey = PAGE_TITLE_KEYS[pathname] || "common.brandName";

  return (
    <header className="app-topbar">
      <Link className="app-topbar-brand" to="/" aria-label={t("common.brandName")}>
        <BrandMark size="navbar" />
      </Link>

      <div className="app-topbar-context">
        <span>{t("navbar.currentSection")}</span>
        <strong>{t(titleKey)}</strong>
      </div>

      <Link className="btn hestia-btn-primary app-topbar-action" to="/transacoes?nova=1">
        <Plus size={18} aria-hidden="true" />
        <span>{t("pages.newTransaction")}</span>
      </Link>
    </header>
  );
}
