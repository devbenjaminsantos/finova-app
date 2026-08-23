import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinancialAccounts from "./FinancialAccounts";

vi.mock("../lib/api/financialAccounts", () => ({
  getFinancialAccounts: vi.fn(),
  createFinancialAccount: vi.fn(),
  deleteFinancialAccount: vi.fn(),
  updateFinancialAccount: vi.fn(),
}));

vi.mock("../features/transactions/useTransactions", () => ({
  useTransactions: vi.fn(),
}));

import {
  createFinancialAccount,
  deleteFinancialAccount,
  getFinancialAccounts,
  updateFinancialAccount,
} from "../lib/api/financialAccounts";
import { useTransactions } from "../features/transactions/useTransactions";

describe("FinancialAccounts page", () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <FinancialAccounts />
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();

    useTransactions.mockReturnValue({
      loadAll: vi.fn().mockResolvedValue(undefined),
    });

    getFinancialAccounts.mockResolvedValue([
      {
        id: 1,
        accountType: "bank_account",
        provider: "manual",
        institutionName: "Nubank",
        institutionCode: null,
        accountName: "Conta principal",
        accountMask: "1234",
        externalAccountId: null,
        status: "pending",
        lastSyncedAtUtc: null,
        linkedTransactionsCount: 2,
      },
    ]);
  });

  it("loads and displays registered manual accounts", async () => {
    renderPage();

    expect(await screen.findByText("Nubank")).toBeInTheDocument();
    expect(screen.getByText("Conta principal")).toBeInTheDocument();
    expect(screen.getAllByText("Conta bancária").length).toBeGreaterThan(0);
    expect(screen.getByText("Pendente")).toBeInTheDocument();
    expect(screen.getByText("Controle manual")).toBeInTheDocument();
    expect(screen.getByText(/Conta principal - final 1234/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Remover uma conta não apaga suas transações\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Esta conta tem 2 transação\(ões\) vinculada\(s\)\./i)
    ).toBeInTheDocument();
  });

  it("creates a new manual financial account", async () => {
    createFinancialAccount.mockResolvedValue({
      id: 2,
      accountType: "wallet",
      provider: "manual",
      institutionName: "Banco Inter",
      institutionCode: null,
      accountName: "Reserva",
      accountMask: "4321",
      externalAccountId: null,
      status: "pending",
      lastSyncedAtUtc: null,
      linkedTransactionsCount: 0,
    });

    renderPage();
    await screen.findByText("Nubank");

    fireEvent.change(screen.getByLabelText("Instituição"), {
      target: { value: "Banco Inter" },
    });
    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "Reserva" },
    });
    fireEvent.change(screen.getByLabelText("Final"), {
      target: { value: "4321" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar conta" }));

    await waitFor(() => {
      expect(createFinancialAccount).toHaveBeenCalledWith({
        accountType: "bank_account",
        provider: "manual",
        institutionName: "Banco Inter",
        institutionCode: null,
        accountName: "Reserva",
        accountMask: "4321",
        externalAccountId: null,
      });
    });

    expect(await screen.findByText("Banco Inter")).toBeInTheDocument();
    expect(
      screen.getByText("Conta adicionada com sucesso.")
    ).toBeInTheDocument();
  });

  it("edits a registered financial account", async () => {
    updateFinancialAccount.mockResolvedValue({
      id: 1,
      accountType: "wallet",
      provider: "manual",
      institutionName: "Nubank",
      institutionCode: null,
      accountName: "Reserva imediata",
      accountMask: "7777",
      externalAccountId: null,
      status: "pending",
      lastSyncedAtUtc: null,
      linkedTransactionsCount: 2,
    });

    renderPage();
    await screen.findByText("Nubank");

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome da conta"), {
      target: { value: "Reserva imediata" },
    });
    fireEvent.change(screen.getByLabelText("Final"), {
      target: { value: "7777" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(updateFinancialAccount).toHaveBeenCalledWith(1, {
        accountType: "bank_account",
        provider: "manual",
        institutionName: "Nubank",
        institutionCode: null,
        accountName: "Reserva imediata",
        accountMask: "7777",
        externalAccountId: null,
      });
    });

    expect(await screen.findByText("Conta financeira atualizada com sucesso.")).toBeInTheDocument();
    expect(screen.getByText("Reserva imediata")).toBeInTheDocument();
  });

  it("removes an account and preserves transactions", async () => {
    const reloadTransactions = vi.fn().mockResolvedValue(undefined);
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    useTransactions.mockReturnValue({
      loadAll: reloadTransactions,
    });

    deleteFinancialAccount.mockResolvedValue(undefined);

    renderPage();
    await screen.findByText("Nubank");

    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    await waitFor(() => {
      expect(deleteFinancialAccount).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      expect(reloadTransactions).toHaveBeenCalled();
    });

    expect(
      await screen.findByText("Conta removida. As transações foram preservadas e seguiram sem vinculação.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Nubank")).not.toBeInTheDocument();

    window.confirm = originalConfirm;
  });
});
