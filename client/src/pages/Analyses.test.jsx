import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Analyses from "./Analyses";

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: vi.fn(),
}));

vi.mock("../lib/api/financialAccounts", () => ({
  getFinancialAccounts: vi.fn(),
}));

vi.mock("../features/dashboard/BudgetGoalsSection", () => ({
  default: () => <div>Metas mockadas</div>,
}));

import { useTransactions } from "../features/transactions/useTransactions";
import { getFinancialAccounts } from "../lib/api/financialAccounts";

describe("Analyses page", () => {
  function renderAnalyses() {
    return render(
      <MemoryRouter>
        <Analyses />
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();

    getFinancialAccounts.mockResolvedValue([
      {
        id: 1,
        institutionName: "Nubank",
        accountName: "Conta principal",
        accountMask: "1234",
      },
    ]);
  });

  it("shows merged insights, comparisons, and goals sections", () => {
    useTransactions.mockReturnValue({
      isLoading: false,
      transactions: [
        {
          id: 1,
          description: "Salario",
          category: "Salario",
          amountCents: 300000,
          date: "2026-01-05",
          type: "income",
          financialAccountId: 1,
          isRecurring: true,
        },
        {
          id: 2,
          description: "Mercado",
          category: "Alimentacao",
          amountCents: 120000,
          date: "2026-01-10",
          type: "expense",
          financialAccountId: 1,
          isRecurring: false,
        },
        {
          id: 3,
          description: "Salario",
          category: "Salario",
          amountCents: 320000,
          date: "2026-02-05",
          type: "income",
          financialAccountId: 1,
          isRecurring: true,
        },
        {
          id: 4,
          description: "Mercado",
          category: "Alimentacao",
          amountCents: 140000,
          date: "2026-02-10",
          type: "expense",
          financialAccountId: 1,
          isRecurring: false,
        },
        {
          id: 5,
          description: "Salario",
          category: "Salario",
          amountCents: 340000,
          date: "2026-03-05",
          type: "income",
          financialAccountId: 1,
          isRecurring: true,
        },
        {
          id: 6,
          description: "Mercado",
          category: "Alimentacao",
          amountCents: 150000,
          date: "2026-03-10",
          type: "expense",
          financialAccountId: 1,
          isRecurring: false,
        },
        {
          id: 7,
          description: "Salario",
          category: "Salario",
          amountCents: 360000,
          date: "2026-04-05",
          type: "income",
          financialAccountId: 1,
          isRecurring: true,
        },
        {
          id: 8,
          description: "Mercado",
          category: "Alimentacao",
          amountCents: 160000,
          date: "2026-04-10",
          type: "expense",
          financialAccountId: 1,
          isRecurring: false,
        },
      ],
    });

    renderAnalyses();

    expect(screen.getByText("Análises")).toBeInTheDocument();
    expect(screen.getByText("Insights do período")).toBeInTheDocument();
    expect(screen.getByText("Comparativos")).toBeInTheDocument();
    expect(screen.getByText("Metas do mês")).toBeInTheDocument();
    expect(screen.getByText("Previsão dos próximos meses")).toBeInTheDocument();
    expect(screen.getByText("Metas mockadas")).toBeInTheDocument();
  });
});
