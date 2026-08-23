import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TransactionImportModal from "./TransactionImportModal";

describe("TransactionImportModal", () => {
  it("starts with history duplicates unselected", async () => {
    const file = new File(
      [
        `Data;Descricao;Valor
14/04/2026;Mercado;-120,00
15/04/2026;Pix recebido;350,00`,
      ],
      "extrato.csv",
      { type: "text/csv" }
    );

    render(
      <TransactionImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        existingTransactions={[
          {
            id: 1,
            date: "2026-04-14",
            description: "Mercado",
            type: "expense",
            amountCents: 12000,
          },
        ]}
      />
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Já existe no histórico")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it("lets the user remove a row from the preview", async () => {
    const file = new File(
      [
        `Data;Descricao;Valor
14/04/2026;Mercado;-120,00
15/04/2026;Pix recebido;350,00`,
      ],
      "extrato.csv",
      { type: "text/csv" }
    );

    render(
      <TransactionImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        existingTransactions={[]}
      />
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Mercado")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);

    await waitFor(() => {
      expect(screen.queryByText("Mercado")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Pix recebido")).toBeInTheDocument();
  });

  it("deselects all suggested duplicates at once", async () => {
    const file = new File(
      [
        `Data;Descricao;Valor
14/04/2026;Padaria;-120,00
14/04/2026;Padaria;-120,00
15/04/2026;Pix recebido;350,00`,
      ],
      "extrato.csv",
      { type: "text/csv" }
    );

    render(
      <TransactionImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        existingTransactions={[]}
      />
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Repetida no arquivo/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Desmarcar duplicatas sugeridas/i }));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(checkboxes[2]).toBeChecked();
  });

  it("applies a category in bulk to selected rows of the same type", async () => {
    const file = new File(
      [
        `Data;Descricao;Valor
14/04/2026;Mercado;-120,00
15/04/2026;Farmacia;-80,00`,
      ],
      "extrato.csv",
      { type: "text/csv" }
    );

    render(
      <TransactionImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        existingTransactions={[]}
      />
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Mercado")).toBeInTheDocument();
    });

    const healthOption = screen
      .getAllByRole("option")
      .find((option) => option.textContent?.toLowerCase().includes("sa"));
    expect(healthOption).toBeDefined();

    fireEvent.change(screen.getByLabelText("Aplicar categoria"), {
      target: { value: healthOption?.getAttribute("value") ?? "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar categoria" }));

    const categorySelects = screen.getAllByDisplayValue(healthOption?.textContent ?? "");
    expect(categorySelects.length).toBeGreaterThanOrEqual(2);
  });

  it("removes all selected rows at once", async () => {
    const file = new File(
      [
        `Data;Descricao;Valor
14/04/2026;Mercado;-120,00
15/04/2026;Farmacia;-80,00`,
      ],
      "extrato.csv",
      { type: "text/csv" }
    );

    render(
      <TransactionImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        existingTransactions={[]}
      />
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Mercado")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remover selecionadas" }));

    await waitFor(() => {
      expect(screen.queryByText("Mercado")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Farmacia")).not.toBeInTheDocument();
  });

  it("highlights low confidence categories for review", async () => {
    const file = new File(
      [
        `Data;Descricao;Valor
14/04/2026;Compra generica sem pistas;-120,00`,
      ],
      "extrato.csv",
      { type: "text/csv" }
    );

    render(
      <TransactionImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        existingTransactions={[]}
      />
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("Revisar categoria")).toBeInTheDocument();
    expect(
      await screen.findByText((content) => content.includes("ainda pedem revisão manual"))
    ).toBeInTheDocument();
  });

  it("replaces the description in bulk for selected rows", async () => {
    const file = new File(
      [
        `Data;Descricao;Valor
14/04/2026;Mercado;-120,00
15/04/2026;Farmacia;-80,00`,
      ],
      "extrato.csv",
      { type: "text/csv" }
    );

    render(
      <TransactionImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={vi.fn()}
        existingTransactions={[]}
      />
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Mercado")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Substituir descrição"), {
      target: { value: "Compra cartao final 1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Substituir" }));

    const replaced = screen.getAllByText("Compra cartao final 1234");
    expect(replaced.length).toBeGreaterThanOrEqual(2);
  });

  it("sends the selected financial account for imported rows", async () => {
    const file = new File(
      [
        `Data;Descricao;Valor
14/04/2026;Mercado;-120,00`,
      ],
      "extrato.csv",
      { type: "text/csv" }
    );

    const onImport = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionImportModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={onImport}
        existingTransactions={[]}
        accounts={[
          {
            id: 7,
            label: "Conta principal - final 1234",
          },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText("Conta de destino"), {
      target: { value: "7" },
    });

    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    await fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Mercado")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Confirmar importação/i }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledWith(
        expect.objectContaining({
          importFormat: "csv",
          transactions: [
            expect.objectContaining({
              description: "Mercado",
              financialAccountId: 7,
            }),
          ],
        })
      );
    });
  });
});
