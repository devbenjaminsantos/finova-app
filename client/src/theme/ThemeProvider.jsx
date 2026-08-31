import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "hestia-theme";
const LEGACY_STORAGE_KEY = "finova-theme";
const ThemeContext = createContext(null);

function getInitialTheme() {
  const savedTheme =
    localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);

  if (savedTheme === "light" || savedTheme === "dark") {
    localStorage.setItem(STORAGE_KEY, savedTheme);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      toggleTheme() {
        setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
      },
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// The context hook intentionally lives beside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within <ThemeProvider />");
  }

  return context;
}
