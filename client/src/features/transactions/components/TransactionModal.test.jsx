import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TransactionModal from "./TransactionModal";

function openMoreOptions() {
  fireEvent.click(screen.getByText("Mais opções"));
}

describe("TransactionModal", () => {
  it("keeps rare fields collapsed until more options is opened", () => {
    render(
      <TransactionModal
        mode="create"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        initial={null}
      />
    );

    const details = screen.getByText("Mais opções").closest("details");
    expect(details).not.toHaveAttribute("open");

    openMoreOptions();
    expect(details).toHaveAttribute("open");
    fireEvent.click(screen.getByLabelText(/Recorr/i));

    expect(screen.getByLabelText(/Repetir/i)).toBeInTheDocument();
  });

  it("sends recurrence data and tags on submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionModal
        mode="create"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initial={null}
        accounts={[
          {
            id: 7,
            label: "Nubank - Conta principal - final 1234",
          },
        ]}
      />
    );

    fireEvent.change(screen.getByLabelText(/Descri/i), {
      target: { value: "Condominio" },
    });
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "450,00" },
    });
    openMoreOptions();
    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "casa, fixa, casa" },
    });
    fireEvent.change(screen.getByLabelText("Conta"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByLabelText(/Recorr/i));
    fireEvent.change(screen.getByLabelText(/Repetir/i), {
      target: { value: "2026-12-05" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Adicionar transa/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Condominio",
          amountCents: 45000,
          financialAccountId: 7,
          tagNames: ["casa", "fixa"],
          isRecurring: true,
          installmentCount: 1,
          recurrenceEndDate: "2026-12-05",
        })
      );
    });
  });

  it("sends installment data on submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionModal
        mode="create"
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        initial={null}
      />
    );

    fireEvent.change(screen.getByLabelText(/Descri/i), {
      target: { value: "Notebook" },
    });
    fireEvent.change(screen.getByLabelText("Valor"), {
      target: { value: "299,90" },
    });
    openMoreOptions();
    fireEvent.click(screen.getByLabelText("Compra parcelada"));
    fireEvent.change(screen.getByLabelText("Quantidade de parcelas"), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Adicionar transa/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Notebook",
          amountCents: 29990,
          isRecurring: false,
          installmentCount: 10,
        })
      );
    });
  });
});
