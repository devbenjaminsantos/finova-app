import { useI18n } from "../i18n/LanguageProvider";

export default function RouteLoading() {
  const { t } = useI18n();

  return (
    <div className="py-5" role="status" aria-live="polite">
      <div className="hestia-loading-state">
        <div className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
        <p className="hestia-subtitle mb-0">{t("common.loading")}</p>
      </div>
    </div>
  );
}
