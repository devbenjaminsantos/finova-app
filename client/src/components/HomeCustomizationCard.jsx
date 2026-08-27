import {
  DEFAULT_HOME_WIDGETS,
  HOME_WIDGET_OPTIONS,
} from "../lib/home/homePreferences";
import { useI18n } from "../i18n/LanguageProvider";
import Button from "./ui/Button";

export default function HomeCustomizationCard({
  widgets,
  onToggle,
  onReset,
  title,
  description,
  resetLabel,
}) {
  const { t } = useI18n();

  return (
    <div className="finova-card p-4 p-md-5">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
        <div>
          <h2 className="finova-title h5 mb-1">
            {title ?? t("profile.homeCustomizationTitle")}
          </h2>
          <p className="finova-subtitle mb-0">
            {description ?? t("profile.homeCustomizationSubtitle")}
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={onReset}>
          {resetLabel ?? t("profile.homeCustomizationReset")}
        </Button>
      </div>

      <div className="row g-2">
        {HOME_WIDGET_OPTIONS.map((option) => (
          <div className="col-12 col-md-6 col-xl-4" key={option.key}>
            <label className="finova-widget-toggle">
              <input
                type="checkbox"
                checked={widgets[option.key]}
                onChange={() => onToggle(option.key)}
              />
              <span>{t(option.labelKey)}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
