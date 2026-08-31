import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANGUAGE, translations } from "./translations";

const STORAGE_KEY = "hestia-language";
const LEGACY_STORAGE_KEY = "finova-language";

function resolveInitialLanguage() {
  const savedLanguage =
    localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);

  if (savedLanguage === "pt-BR" || savedLanguage === "en-US") {
    localStorage.setItem(STORAGE_KEY, savedLanguage);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return savedLanguage;
  }

  const browserLanguage = navigator.language;
  if (browserLanguage === "pt-BR" || browserLanguage === "en-US") {
    return browserLanguage;
  }

  return DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: resolveInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      "pt-BR": translations["pt-BR"],
      "en-US": translations["en-US"],
    },
  });
}

export { STORAGE_KEY };
export default i18n;
