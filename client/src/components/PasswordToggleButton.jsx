import { useI18n } from "../i18n/LanguageProvider";
import Button from "./ui/Button";

function EyeIcon({ isVisible }) {
  if (isVisible) {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
        <path d="M9.4 5.3A11.3 11.3 0 0 1 12 5c5 0 9.3 3 11 7-0.7 1.6-1.8 3-3.2 4.1" />
        <path d="M6.7 6.7C4.8 8 3.5 9.8 3 12c1.7 4 6 7 11 7 1 0 2-.1 2.9-.4" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PasswordToggleButton({ isVisible, onToggle, disabled = false }) {
  const { t } = useI18n();
  const tooltip = isVisible ? t("common.hidePassword") : t("common.showPassword");

  return (
    <Button
      type="button"
      variant="secondary"
      className="hestia-password-toggle hestia-icon-tooltip"
      onClick={onToggle}
      disabled={disabled}
      aria-label={tooltip}
      title={tooltip}
      data-tooltip={tooltip}
    >
      <EyeIcon isVisible={isVisible} />
    </Button>
  );
}
