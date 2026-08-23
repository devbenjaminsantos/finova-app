import { describe, expect, it } from "vitest";
import { translations } from "./translations";

function flattenTranslations(source, prefix = "", target = {}) {
  Object.entries(source).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenTranslations(value, path, target);
      return;
    }

    target[path] = String(value);
  });

  return target;
}

function interpolationKeys(value) {
  return Array.from(value.matchAll(/{{\s*([^},\s]+)[^}]*}}/g))
    .map((match) => match[1])
    .sort();
}

describe("translations", () => {
  it("keeps pt-BR and en-US keys in exact parity", () => {
    const pt = flattenTranslations(translations["pt-BR"]);
    const en = flattenTranslations(translations["en-US"]);

    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  });

  it("keeps interpolation placeholders aligned between languages", () => {
    const pt = flattenTranslations(translations["pt-BR"]);
    const en = flattenTranslations(translations["en-US"]);

    Object.keys(pt).forEach((key) => {
      expect(interpolationKeys(pt[key]), key).toEqual(interpolationKeys(en[key]));
    });
  });
});
