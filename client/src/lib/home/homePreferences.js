import { loadJSON, saveJSON } from "../storage/jsonStorage";

export const HOME_WIDGET_OPTIONS = [
  { key: "context", labelKey: "profile.homeWidgetContext" },
  { key: "summary", labelKey: "profile.homeWidgetSummary" },
  { key: "shortcuts", labelKey: "profile.homeWidgetShortcuts" },
  { key: "insights", labelKey: "profile.homeWidgetInsights" },
  { key: "comparisons", labelKey: "profile.homeWidgetComparisons" },
  { key: "goals", labelKey: "profile.homeWidgetGoals" },
  { key: "history", labelKey: "profile.homeWidgetHistory" },
];

export const DEFAULT_HOME_WIDGETS = HOME_WIDGET_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.key] = true;
  return accumulator;
}, {});

function getStorageKey(user) {
  const userScope = user?.id || user?.email || "anonymous";
  return `hestia:home-widgets:${userScope}`;
}

function getLegacyStorageKey(user) {
  const userScope = user?.id || user?.email || "anonymous";
  return `finova:home-widgets:${userScope}`;
}

export function loadHomeWidgets(user) {
  const storageKey = getStorageKey(user);
  const legacyStorageKey = getLegacyStorageKey(user);
  const legacyStored = loadJSON(legacyStorageKey, null);
  const stored = loadJSON(storageKey, legacyStored ?? DEFAULT_HOME_WIDGETS);

  if (localStorage.getItem(storageKey) === null && legacyStored !== null) {
    saveJSON(storageKey, legacyStored);
  }
  localStorage.removeItem(legacyStorageKey);

  return HOME_WIDGET_OPTIONS.reduce((accumulator, option) => {
    accumulator[option.key] =
      typeof stored?.[option.key] === "boolean"
        ? stored[option.key]
        : DEFAULT_HOME_WIDGETS[option.key];
    return accumulator;
  }, {});
}

export function saveHomeWidgets(user, widgets) {
  const normalized = HOME_WIDGET_OPTIONS.reduce((accumulator, option) => {
    accumulator[option.key] = Boolean(widgets?.[option.key]);
    return accumulator;
  }, {});

  saveJSON(getStorageKey(user), normalized);
  return normalized;
}
