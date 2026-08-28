import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Planning from "./Planning";

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: vi.fn(),
}));

vi.mock("../features/dashboard/BudgetGoalsSection", () => ({
  default: () => <div>Metas e orçamento</div>,
}));

vi.mock("../features/transactions/components/TransactionCommitments", () => ({
  default: ({ installmentGroups, recurringRules, showInstallmentActions }) => (
    <div>
      Compromissos: {recurringRules.length + installmentGroups.length}
      {showInstallmentActions ? " editáveis" : " somente leitura"}
    </div>
  ),
}));

import { useTransactions } from "../features/transactions/useTransactions";

describe("Planning page", () => {
  function renderPlanning() {
    return render(
      <MemoryRouter>
        <Planning />
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("groups budget goals with read-only financial commitments", () => {
    useTransactions.mockReturnValue({
      isLoading: false,
      transactions: [],
      recurringRules: [
        {
          id: 1,
          description: "Aluguel",
          isActive: true,
          nextOccurrenceDate: "2026-09-05",
        },
      ],
      installmentPlans: [
        {
          id: "notebook",
          description: "Notebook",
          nextInstallmentDate: "2026-09-10",
          nextInstallmentIndex: 2,
          amountPerInstallmentCents: 100000,
        },
      ],
    });

    renderPlanning();

    expect(screen.getByRole("heading", { name: "Planejamento" })).toBeInTheDocument();
    expect(screen.getByText("Metas e orçamento")).toBeInTheDocument();
    expect(screen.getByText("Compromissos: 2 somente leitura")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gerenciar em transações" })).toHaveAttribute(
      "href",
      "/transacoes"
    );
  });

  it("explains when there are no recurring or installment commitments", () => {
    useTransactions.mockReturnValue({
      isLoading: false,
      transactions: [],
      recurringRules: [],
      installmentPlans: [],
    });

    renderPlanning();

    expect(screen.getByText("Nenhum compromisso cadastrado")).toBeInTheDocument();
  });
});
