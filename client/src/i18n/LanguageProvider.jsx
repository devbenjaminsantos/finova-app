import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, { STORAGE_KEY } from "./i18n";
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, translations } from "./translations";

function getPathValue(target, path) {
  return path.split(".").reduce((current, part) => current?.[part], target);
}

function interpolate(template, params) {
  if (typeof template !== "string" || !params) {
    return template;
  }

  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

function getNamespaceResources(language, namespace) {
  return i18n.getResourceBundle(language, namespace);
}

function translateWithFallback(language, path, params) {
  const [namespace, ...keyParts] = path.split(".");
  const key = keyParts.join(".");
  const namespaceResources = namespace ? getNamespaceResources(language, namespace) : null;

  if (namespace && key && getPathValue(namespaceResources, key) !== undefined) {
    return i18n.t(`${namespace}:${key}`, {
      lng: language,
      returnObjects: true,
      ...params,
    });
  }

  const dictionary = translations[language] || translations[DEFAULT_LANGUAGE];
  const fallbackValue =
    getPathValue(dictionary, path) ??
    getPathValue(translations[DEFAULT_LANGUAGE], path) ??
    path;

  if (Array.isArray(fallbackValue)) {
    return fallbackValue;
  }

  return interpolate(fallbackValue, params);
}

function createI18nValue(language) {
  return {
    language,
    locale: language,
    languages: LANGUAGE_OPTIONS,
    setLanguage() {},
    t(path, params) {
      return translateWithFallback(language, path, params);
    },
    formatCurrencyFromCents(cents, currency = "BRL") {
      const value = (Number(cents) || 0) / 100;
      return new Intl.NumberFormat(language, {
        style: "currency",
        currency,
      }).format(value);
    },
    formatDate(isoDate) {
      if (!isoDate) {
        return "";
      }

      const normalized = String(isoDate).trim().slice(0, 10);
      const [year, month, day] = normalized.split("-");
      if (!year || !month || !day) {
        return "";
      }

      const date = new Date(`${year}-${month}-${day}T00:00:00`);
      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return new Intl.DateTimeFormat(language, {
        dateStyle: "short",
      }).format(date);
    },
    formatDateTime(isoDateTime) {
      if (!isoDateTime) {
        return "";
      }

      const date = new Date(isoDateTime);
      if (Number.isNaN(date.getTime())) {
        return "";
      }

      return new Intl.DateTimeFormat(language, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
    },
  };
}

const defaultValue = createI18nValue(DEFAULT_LANGUAGE);
const LanguageContext = createContext(defaultValue);

export function LanguageProvider({ children }) {
  const { i18n: i18nInstance } = useTranslation();
  const [language, setLanguageState] = useState(i18n.language || DEFAULT_LANGUAGE);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    function handleLanguageChanged(nextLanguage) {
      setLanguageState(nextLanguage || DEFAULT_LANGUAGE);
    }

    i18nInstance.on("languageChanged", handleLanguageChanged);

    return () => {
      i18nInstance.off("languageChanged", handleLanguageChanged);
    };
  }, [i18nInstance]);

  const setLanguage = useCallback((nextLanguage) => {
    i18nInstance.changeLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  }, [i18nInstance]);

  const value = useMemo(() => {
    const baseValue = createI18nValue(language);
    return {
      ...baseValue,
      setLanguage,
    };
  }, [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// The context hook intentionally lives beside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  return useContext(LanguageContext);
}
