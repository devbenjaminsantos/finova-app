import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BudgetGoalsSection from "./BudgetGoalsSection";

vi.mock("../../lib/api/budgetGoals", () => ({
  createBudgetGoal: vi.fn(),
  deleteBudgetGoal: vi.fn(),
  getBudgetGoals: vi.fn(),
  updateBudgetGoal: vi.fn(),
}));

import { deleteBudgetGoal, getBudgetGoals } from "../../lib/api/budgetGoals";

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const transactions = [
  {
    id: 1,
    description: "Mercado",
    category: "Alimentacao",
    amountCents: 90000,
    date: `${currentMonth}-10`,
    type: "expense",
  },
  {
    id: 2,
    description: "Aluguel",
    category: "Moradia",
    amountCents: 180000,
    date: `${currentMonth}-05`,
    type: "expense",
  },
  {
    id: 3,
    description: "Salario",
    category: "Salario",
    amountCents: 500000,
    date: `${currentMonth}-05`,
    type: "income",
  },
];

describe("BudgetGoalsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("highlights uncovered spending categories as suggestions", async () => {
    getBudgetGoals.mockResolvedValue([
      { id: 1, month: currentMonth, category: "", amountCents: 300000 },
      { id: 2, month: currentMonth, category: "Alimentacao", amountCents: 120000 },
    ]);

    render(<BudgetGoalsSection transactions={transactions} />);

    expect(
      await screen.findByText((content) => content.toLowerCase().includes("merecem meta"))
    ).toBeInTheDocument();

    const suggestionButton = screen.getByRole("button", { name: /Moradia/i });
    fireEvent.click(suggestionButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Categoria")).toHaveValue("Moradia");
    });
  });

  it("reloads goals when navigating between months", async () => {
    getBudgetGoals.mockResolvedValue([]);

    render(<BudgetGoalsSection transactions={transactions} />);

    await waitFor(() => {
      expect(getBudgetGoals).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Próximo mês/i }));

    await waitFor(() => {
      expect(getBudgetGoals).toHaveBeenCalledTimes(2);
    });
  });

  it("confirms a goal deletion in the shared modal before calling the API", async () => {
    getBudgetGoals.mockResolvedValue([
      { id: 1, month: currentMonth, category: "", amountCents: 300000 },
    ]);
    deleteBudgetGoal.mockResolvedValue(undefined);

    render(<BudgetGoalsSection transactions={transactions} />);

    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const dialog = screen.getByRole("dialog", { name: "Excluir" });
    expect(dialog).toBeInTheDocument();
    expect(deleteBudgetGoal).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => {
      expect(deleteBudgetGoal).toHaveBeenCalledWith(1);
    });
  });
});
