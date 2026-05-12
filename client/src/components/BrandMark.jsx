import logo from "../assets/icone/logo-transparent.svg";
import { useI18n } from "../i18n/LanguageProvider";

export default function BrandMark({
  subtitle,
  className = "",
  size = "default",
  centered = false,
  showWordmark = true,
}) {
  const { t } = useI18n();
  const classes = [
    "finova-brand-mark",
    size ? `finova-brand-mark-${size}` : "",
    centered ? "finova-brand-mark-centered" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <img src={logo} alt={t("common.brandLogoAlt")} className="finova-brand-logo" />

      {showWordmark ? (
        <div className="finova-brand-copy">
          <span className="finova-brand-wordmark">{t("common.brandName")}</span>
          {subtitle ? <span className="finova-brand-caption">{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
