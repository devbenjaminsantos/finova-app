import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: vi.fn(),
}));

vi.mock("../lib/api/auth", () => ({
  getStoredUser: vi.fn(),
  updateOnboardingPreferenceRequest: vi.fn(),
}));

vi.mock("../lib/api/budgetGoals", () => ({
  getBudgetGoals: vi.fn(),
}));

vi.mock("../lib/api/auditLogs", () => ({
  getAuditLogs: vi.fn(),
}));

vi.mock("../lib/api/financialAccounts", () => ({
  getFinancialAccounts: vi.fn(),
}));

import { useTransactions } from "../features/transactions/useTransactions";
import { getStoredUser, updateOnboardingPreferenceRequest } from "../lib/api/auth";
import { getAuditLogs } from "../lib/api/auditLogs";
import { getBudgetGoals } from "../lib/api/budgetGoals";
import { getFinancialAccounts } from "../lib/api/financialAccounts";

describe("Home page", () => {
  function renderHome() {
    return render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

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
        },
        {
          id: 2,
          description: "Mercado",
          category: "Alimentacao",
          amountCents: 120000,
          date: "2026-04-10",
          type: "expense",
          isRecurring: false,
        },
      ],
    });

    getStoredUser.mockReturnValue({
      id: 7,
      name: "Keller",
      email: "keller@example.com",
      isDemo: false,
      onboardingOptIn: null,
    });

    getBudgetGoals.mockResolvedValue([{ id: 1, category: null, amountCents: 200000 }]);
    getFinancialAccounts.mockResolvedValue([
      {
        id: 1,
        institutionName: "Nubank",
        accountName: "Conta principal",
        accountMask: "1234",
      },
    ]);
    getAuditLogs.mockResolvedValue([
      {
        id: 1,
        action: "transaction.created",
        summary: "Transacao adicionada",
        createdAtUtc: "2026-04-14T10:30:00Z",
      },
    ]);
  });

  it("shows default widgets on home", async () => {
    renderHome();

    const historyMatches = await screen.findAllByText("Histórico recente");
    expect(historyMatches.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resumo financeiro").length).toBeGreaterThan(0);
    expect(screen.getByText("Saldo global em todas as contas")).toBeInTheDocument();
  });

  it("persists onboarding preference when the user opts in", async () => {
    updateOnboardingPreferenceRequest.mockResolvedValue({
      id: 7,
      name: "Keller",
      email: "keller@example.com",
      isDemo: false,
      onboardingOptIn: true,
    });

    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Quero ajuda" }));

    await waitFor(() => {
      expect(updateOnboardingPreferenceRequest).toHaveBeenCalledWith(true);
    });
  });
});
