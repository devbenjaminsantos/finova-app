import { Languages, Moon, Sun } from "lucide-react";
import { useI18n } from "../../i18n/LanguageProvider";
import { useTheme } from "../../theme/ThemeProvider";

export default function ShellPreferences({ compact = false }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { language, languages, setLanguage, t } = useI18n();
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <div className={`app-preferences${compact ? " app-preferences-compact" : ""}`}>
      <button
        type="button"
        className="app-icon-button"
        onClick={toggleTheme}
        aria-label={isDark ? t("navbar.openLight") : t("navbar.openDark")}
        title={isDark ? t("navbar.openLight") : t("navbar.openDark")}
      >
        <ThemeIcon size={18} aria-hidden="true" />
      </button>

      <label className="app-language-control" title={t("common.languageLabel")}>
        <Languages size={16} aria-hidden="true" />
        <span className="visually-hidden">{t("common.languageLabel")}</span>
        <select
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
      </label>
    </div>
  );
}

