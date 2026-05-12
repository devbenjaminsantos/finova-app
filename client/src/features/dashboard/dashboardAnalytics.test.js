import { describe, expect, it } from "vitest";
import { getAutomaticInsights, getForecastSnapshot } from "./dashboardAnalytics";

describe("dashboardAnalytics forecast", () => {
  it("builds a three-month forecast from recent history", () => {
    const transactions = [
      {
        id: 1,
        type: "income",
        amountCents: 300000,
        date: "2026-01-05",
      },
      {
        id: 2,
        type: "expense",
        amountCents: 150000,
        date: "2026-01-10",
      },
      {
        id: 3,
        type: "income",
        amountCents: 320000,
        date: "2026-02-05",
      },
      {
        id: 4,
        type: "expense",
        amountCents: 160000,
        date: "2026-02-10",
      },
      {
        id: 5,
        type: "income",
        amountCents: 340000,
        date: "2026-03-05",
      },
      {
        id: 6,
        type: "expense",
        amountCents: 170000,
        date: "2026-03-10",
      },
    ];

    const snapshot = getForecastSnapshot(transactions, {
      historyMonths: 3,
      horizon: 3,
    });

    expect(snapshot.hasEnoughData).toBe(true);
    expect(snapshot.forecast).toHaveLength(3);
    expect(snapshot.forecast[0].month).toBe("2026-04");
    expect(snapshot.forecast[0].income).toBeGreaterThan(0);
    expect(snapshot.forecast[0].expense).toBeGreaterThan(0);
    expect(snapshot.averageBalance).toBeGreaterThan(0);
  });

  it("returns an empty forecast when there is not enough history", () => {
    const transactions = [
      {
        id: 1,
        type: "income",
        amountCents: 300000,
        date: "2026-03-05",
      },
      {
        id: 2,
        type: "expense",
        amountCents: 100000,
        date: "2026-03-10",
      },
    ];

    const snapshot = getForecastSnapshot(transactions, {
      historyMonths: 3,
      horizon: 3,
    });

    expect(snapshot.hasEnoughData).toBe(false);
    expect(snapshot.forecast).toEqual([]);
    expect(snapshot.confidence.label).toBe("Baixa");
  });
});

describe("dashboardAnalytics insights", () => {
  it("builds a savings-rate insight from income without throwing", () => {
    const insights = getAutomaticInsights([
      {
        id: 1,
        type: "income",
        amountCents: 300000,
        date: "2026-05-05",
      },
    ]);

    expect(insights.some((insight) => insight.key === "savings-rate")).toBe(true);
  });
});
