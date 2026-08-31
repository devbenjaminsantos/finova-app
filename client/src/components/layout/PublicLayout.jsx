import { Suspense } from "react";
import { Link, Outlet } from "react-router-dom";
import { useI18n } from "../../i18n/LanguageProvider";
import BrandMark from "../BrandMark";
import RouteLoading from "../RouteLoading";
import ShellPreferences from "./ShellPreferences";

export default function PublicLayout() {
  const { t } = useI18n();

  return (
    <div className="hestia-page app-public-layout">
      <header className="app-public-header">
        <Link className="app-public-brand" to="/login" aria-label={t("common.brandName")}>
          <BrandMark size="navbar" />
        </Link>
        <ShellPreferences compact />
      </header>

      <main className="container py-4 app-public-main">
        <Suspense fallback={<RouteLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
