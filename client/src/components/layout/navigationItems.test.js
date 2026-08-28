import { describe, expect, it } from "vitest";
import { MOBILE_MORE_ITEMS, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "./navigationItems";

describe("navigation items", () => {
  it("keeps operational flows primary and moves history to secondary navigation", () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.to)).toEqual([
      "/",
      "/transacoes",
      "/analises",
      "/contas",
    ]);
    expect(SECONDARY_NAV_ITEMS.map((item) => item.to)).toEqual(["/historico"]);
    expect(MOBILE_MORE_ITEMS).toBe(SECONDARY_NAV_ITEMS);
  });
});
