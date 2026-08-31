import logo from "../assets/icone/hestia-mark-optimized.webp";
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
    "hestia-brand-mark",
    size ? `hestia-brand-mark-${size}` : "",
    centered ? "hestia-brand-mark-centered" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role="img" aria-label={t("common.brandLogoAlt")}>
      <span className="hestia-brand-logo" aria-hidden="true">
        <img src={logo} alt="" />
      </span>

      {showWordmark ? (
        <div className="hestia-brand-copy">
          <span className="hestia-brand-wordmark">{t("common.brandName")}</span>
          {subtitle ? <span className="hestia-brand-caption">{subtitle}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
