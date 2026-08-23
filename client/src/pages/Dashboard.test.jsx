import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: vi.fn(),
}));

vi.mock("../features/dashboard/DashboardCharts", () => ({
  default: () => <div>Graficos mockados</div>,
}));

vi.mock("../lib/api/financialAccounts", () => ({
  getFinancialAccounts: vi.fn(),
}));

import { useTransactions } from "../features/transactions/useTransactions";
import { getFinancialAccounts } from "../lib/api/financialAccounts";

describe("Graficos page", () => {
  function renderDashboard() {
    return render(
      <MemoryRouter>
        <Dashboard />
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

  it("shows a financial summary and charts when there are transactions", async () => {
    useTransactions.mockReturnValue({
      isLoading: false,
      transactions: [
        {
          id: 1,
          description: "Salario",
          category: "Salario",
          amountCents: 500000,
          date: "2026-04-05",
          type: "income",
          isRecurring: true,
          financialAccountId: 1,
        },
        {
          id: 2,
          description: "Mercado",
          category: "Alimentacao",
          amountCents: 120000,
          date: "2026-04-10",
          type: "expense",
          isRecurring: false,
          financialAccountId: 1,
        },
      ],
    });

    renderDashboard();

    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "all" } });

    expect(screen.getByText("Gráficos")).toBeInTheDocument();
    expect(await screen.findByText("Gráficos do período")).toBeInTheDocument();
    expect(screen.getByText("Graficos mockados")).toBeInTheDocument();
    expect(screen.getByText("Saldo global em todas as contas")).toBeInTheDocument();
  });

  it("shows an empty state when the selected period has no transactions", () => {
    useTransactions.mockReturnValue({
      isLoading: false,
      transactions: [],
    });

    renderDashboard();

    expect(screen.getByText("Nenhum dado para o período selecionado")).toBeInTheDocument();
  });
});
