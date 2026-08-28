import { describe, expect, it } from "vitest";
import {
  MOBILE_MORE_ITEMS,
  MOBILE_PRIMARY_ITEMS,
  MOBILE_SECONDARY_ITEMS,
  PRIMARY_NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
} from "./navigationItems";

describe("navigation items", () => {
  it("keeps operational flows primary and moves history to secondary navigation", () => {
    expect(PRIMARY_NAV_ITEMS.map((item) => item.to)).toEqual([
      "/",
      "/transacoes",
      "/planejamento",
      "/analises",
      "/contas",
    ]);
    expect(SECONDARY_NAV_ITEMS.map((item) => item.to)).toEqual(["/historico"]);
    expect(MOBILE_PRIMARY_ITEMS.map((item) => item.to)).toEqual(["/", "/planejamento"]);
    expect(MOBILE_SECONDARY_ITEMS.map((item) => item.to)).toEqual(["/transacoes"]);
    expect(MOBILE_MORE_ITEMS.map((item) => item.to)).toEqual([
      "/analises",
      "/contas",
      "/historico",
    ]);
  });
});
