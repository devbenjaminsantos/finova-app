import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Transactions from "./Transactions";

const mockDownloadCsv = vi.fn();
const mockExportPdf = vi.fn();

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: vi.fn(),
}));

vi.mock("../lib/export/csv", () => ({
  downloadCsv: (...args) => mockDownloadCsv(...args),
}));

vi.mock("../lib/export/pdf", () => ({
  exportTransactionsToPdf: (...args) => mockExportPdf(...args),
}));

vi.mock("../lib/api/financialAccounts", () => ({
  getFinancialAccounts: vi.fn(),
}));

vi.mock("../lib/storage/jsonStorage", () => ({
  loadJSON: vi.fn(() => ({
    q: "",
    accountFilter: "all",
    tagFilter: "all",
    typeFilter: "all",
    categoryFilter: "all",
    month: "",
    sortBy: "date_desc",
  })),
  saveJSON: vi.fn(),
}));

vi.mock("../features/transactions/components/TransactionImportModal", () => ({
  default: ({ isOpen, onImport }) =>
    isOpen ? (
      <button
        type="button"
        onClick={() =>
          onImport({
            transactions: [
              {
                description: "Importada",
                category: "Outros",
                amountCents: 1000,
                date: "2026-04-20",
                type: "expense",
              },
            ],
            importFormat: "csv",
          })
        }
      >
        Confirmar importação mock
      </button>
    ) : null,
}));

import { useTransactions } from "../features/transactions/useTransactions";
import { getFinancialAccounts } from "../lib/api/financialAccounts";

function renderTransactions(initialEntry = "/transacoes") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Transactions />
    </MemoryRouter>
  );
}

const transactionsFixture = [
  {
    id: 1,
    description: "Mercado",
    category: "Alimentacao",
    tagNames: ["casa", "essencial"],
    amountCents: 15000,
    date: "2026-04-11",
    type: "expense",
    source: "manual",
    isRecurring: false,
    financialAccountId: 1,
  },
  {
    id: 2,
    installmentIndex: 1,
    installmentCount: 3,
    installmentGroupId: "installment-plan-1",
    description: "Notebook",
    category: "Tecnologia",
    tagNames: ["trabalho"],
    amountCents: 200000,
    date: "2026-03-05",
    type: "expense",
    source: "import_csv",
    importedAtUtc: "2026-04-16T10:30:00Z",
    isRecurring: false,
    financialAccountId: 2,
  },
  {
    id: 3,
    installmentIndex: 2,
    installmentCount: 3,
    installmentGroupId: "installment-plan-1",
    description: "Notebook",
    category: "Tecnologia",
    tagNames: ["trabalho"],
    amountCents: 200000,
    date: "2026-04-05",
    type: "expense",
    source: "import_csv",
    importedAtUtc: "2026-04-16T10:30:00Z",
    isRecurring: false,
    financialAccountId: 2,
  },
  {
    id: 4,
    installmentIndex: 3,
    installmentCount: 3,
    installmentGroupId: "installment-plan-1",
    description: "Notebook",
    category: "Tecnologia",
    tagNames: ["trabalho"],
    amountCents: 200000,
    date: "2026-05-05",
    type: "expense",
    source: "import_csv",
    importedAtUtc: "2026-04-16T10:30:00Z",
    isRecurring: false,
    financialAccountId: 2,
  },
];

const installmentPlansFixture = [
  {
    id: "installment-plan-1",
    description: "Notebook",
    category: "Tecnologia",
    tagNames: ["trabalho"],
    amountPerInstallmentCents: 200000,
    installmentCount: 3,
    postedInstallments: 2,
    remainingInstallments: 1,
    upcomingInstallments: 1,
    totalAmountCents: 600000,
    paidAmountCents: 400000,
    remainingAmountCents: 200000,
    nextInstallmentDate: "2026-05-05T00:00:00",
    nextInstallmentIndex: 3,
  },
];

const recurringRulesFixture = [
  {
    id: "recurring-rule-1",
    description: "Condominio",
    category: "Moradia",
    amountCents: 180000,
    type: "expense",
    startDate: "2026-04-07T00:00:00",
    endDate: "2026-12-07T00:00:00",
    nextOccurrenceDate: "2026-05-07T00:00:00",
    lastGeneratedDate: "2026-04-07T00:00:00",
    isActive: true,
    tagNames: ["casa"],
  },
];

describe("Transactions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getFinancialAccounts.mockResolvedValue([
      {
        id: 1,
        institutionName: "Nubank",
        accountName: "Conta principal",
        accountMask: "1234",
      },
      {
        id: 2,
        institutionName: "Inter",
        accountName: "Cartao virtual",
        accountMask: "7788",
      },
    ]);

    useTransactions.mockReturnValue({
      transactions: transactionsFixture,
      installmentPlans: installmentPlansFixture,
      recurringRules: recurringRulesFixture,
      addTransaction: vi.fn(),
      importTransactions: vi.fn().mockResolvedValue({ importedCount: 1 }),
      removeTransaction: vi.fn(),
      removeInstallmentGroup: vi.fn(),
      updateTransaction: vi.fn(),
      updateInstallmentGroup: vi.fn(),
      isLoading: false,
    });
  });

  it("opens the create modal from the app shell shortcut", async () => {
    renderTransactions("/transacoes?nova=1");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nova transação" })).toBeInTheDocument();
  });

  it("filters transactions by search text", () => {
    renderTransactions();

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "mercado" },
    });

    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Histórico financeiro" })).queryByText("Notebook")
    ).not.toBeInTheDocument();
  });

  it("filters transactions by tag", () => {
    renderTransactions();

    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "trabalho" },
    });

    expect(screen.getAllByText("Notebook").length).toBeGreaterThan(0);
    expect(
      within(screen.getByRole("list", { name: "Histórico financeiro" })).queryByText("Mercado")
    ).not.toBeInTheDocument();
  });

  it("filters transactions by selected account", async () => {
    renderTransactions();

    fireEvent.change(await screen.findByLabelText("Conta"), {
      target: { value: "1" },
    });

    expect(screen.getByText("Mercado")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Histórico financeiro" })).queryByText("Notebook")
    ).not.toBeInTheDocument();
    expect(screen.getByText("Conta: Conta principal - final 1234")).toBeInTheDocument();
  });

  it("exports the currently filtered rows to CSV", () => {
    renderTransactions();

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, rows] = mockDownloadCsv.mock.calls[0];

    expect(filename).toContain("hestia-transacoes");
    expect(rows).toHaveLength(4);
    expect(rows[1][1]).toBe("Notebook");
    expect(rows[1][3]).toBe("trabalho");
  });

  it("exports monetary values and localized metadata to PDF", () => {
    renderTransactions();

    fireEvent.change(screen.getByPlaceholderText(/buscar/i), {
      target: { value: "mercado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));

    expect(mockExportPdf).toHaveBeenCalledTimes(1);
    const [document] = mockExportPdf.mock.calls[0];

    expect(document.columns).toEqual(["Data", "Descrição", "Categoria", "Tipo", "Valor"]);
    expect(document.rows).toHaveLength(1);
    expect(document.rows[0]).toEqual([
      "11/04/2026",
      "Mercado",
      "Alimentacao",
      "Despesa",
      "R$ 150,00",
    ]);
    expect(document).toMatchObject({
      emptyMessage: "Nenhuma transação encontrada para os filtros selecionados.",
      generatedAtLabel: "Gerado em",
      pageLabel: "Página",
      pageOfLabel: "de",
      locale: "pt-BR",
    });
  });

  it("shows the transaction origin badges, tags and installment progress", () => {
    renderTransactions();

    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getAllByText("Importada via CSV").length).toBeGreaterThan(0);
    expect(screen.getAllByText("#casa").length).toBeGreaterThan(0);
    expect(screen.getByText("Regras recorrentes")).toBeInTheDocument();
    expect(screen.getByText("Regras ativas")).toBeInTheDocument();
    expect(screen.getByText("Próximo ciclo previsto")).toBeInTheDocument();
    expect(screen.getByText("Condominio")).toBeInTheDocument();
    expect(screen.getByText("Próxima geração")).toBeInTheDocument();
    expect(screen.getAllByText("Parcela 2/3").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 parcela\(s\) restantes/i)).toBeInTheDocument();
    expect(screen.getByText("Compras parceladas")).toBeInTheDocument();
    expect(screen.getByText("Dívida em aberto")).toBeInTheDocument();
    expect(screen.getByText("Compras em andamento")).toBeInTheDocument();
    expect(screen.getByText("Próximas parcelas")).toBeInTheDocument();
    expect(screen.getByText("Valor total")).toBeInTheDocument();
    expect(screen.getByText("Já lançado")).toBeInTheDocument();
    expect(screen.getByText("Saldo restante")).toBeInTheDocument();
    expect(screen.getByText("Parcelas futuras")).toBeInTheDocument();
    expect(screen.getByText("Próxima parcela")).toBeInTheDocument();
    expect(screen.getByText("Progresso da quitação")).toBeInTheDocument();
    expect(screen.getByText(/Parcela 3 em/i)).toBeInTheDocument();
  });

  it("shows import feedback after confirming an import", async () => {
    renderTransactions();

    fireEvent.click(screen.getByRole("button", { name: "Importar arquivo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar importação mock" }));

    expect(
      await screen.findByText("1 transação importada com sucesso via CSV.")
    ).toBeInTheDocument();
  });

  it("removes an installment purchase from the grouped card", () => {
    const removeInstallmentGroup = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    useTransactions.mockReturnValue({
      transactions: transactionsFixture,
      installmentPlans: installmentPlansFixture,
      recurringRules: recurringRulesFixture,
      addTransaction: vi.fn(),
      importTransactions: vi.fn().mockResolvedValue({ importedCount: 1 }),
      removeTransaction: vi.fn(),
      removeInstallmentGroup,
      updateTransaction: vi.fn(),
      updateInstallmentGroup: vi.fn(),
      isLoading: false,
    });

    renderTransactions();

    fireEvent.click(screen.getByRole("button", { name: "Remover compra" }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(removeInstallmentGroup).toHaveBeenCalledWith("installment-plan-1");
  });

  it("edits an installment purchase from the grouped card", async () => {
    const updateInstallmentGroup = vi.fn().mockResolvedValue(undefined);

    useTransactions.mockReturnValue({
      transactions: transactionsFixture,
      installmentPlans: installmentPlansFixture,
      recurringRules: recurringRulesFixture,
      addTransaction: vi.fn(),
      importTransactions: vi.fn().mockResolvedValue({ importedCount: 1 }),
      removeTransaction: vi.fn(),
      removeInstallmentGroup: vi.fn(),
      updateTransaction: vi.fn(),
      updateInstallmentGroup,
      isLoading: false,
    });

    renderTransactions();

    fireEvent.click(screen.getByRole("button", { name: "Editar compra" }));
    fireEvent.change(screen.getByLabelText(/descri/i), {
      target: { value: "Notebook" },
    });
    fireEvent.change(screen.getByLabelText("Tags", { selector: "input" }), {
      target: { value: "trabalho, tecnologia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar compra" }));

    expect(updateInstallmentGroup).toHaveBeenCalledWith("installment-plan-1", {
      description: "Notebook",
      category: "Tecnologia",
      tagNames: ["trabalho", "tecnologia"],
    });
  });
});
