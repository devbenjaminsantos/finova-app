import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TransactionsTable from "./TransactionsTable";

const transaction = {
  id: 17,
  amountCents: 8900,
  category: "Food",
  date: "2026-08-27",
  description: "Market",
  financialAccountLabel: "Main account",
  source: "manual",
  type: "expense",
};

describe("TransactionsTable", () => {
  it("uses the shared variants while preserving export, edit and remove actions", () => {
    const onEdit = vi.fn();
    const onExportCsv = vi.fn();
    const onExportPdf = vi.fn();
    const onRemove = vi.fn();

    render(
      <TransactionsTable
        transactions={[transaction]}
        totalTransactionsCount={1}
        onEdit={onEdit}
        onExportCsv={onExportCsv}
        onExportPdf={onExportPdf}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));

    expect(screen.getByRole("list", { name: "Histórico financeiro" })).toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent("Market");
    expect(onExportCsv).toHaveBeenCalledOnce();
    expect(onExportPdf).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(transaction);
    expect(onRemove).toHaveBeenCalledWith(17);
    expect(screen.getByRole("button", { name: "Remover" })).toHaveClass("hestia-button-danger");
  });
});
