import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BudgetProgress from "./BudgetProgress";
import CategoryRow from "./CategoryRow";
import ChartContainer from "./ChartContainer";
import EmptyState from "./EmptyState";
import Metric from "./Metric";
import Modal from "./Modal";
import MoneyDelta from "./MoneyDelta";
import Toast from "./Toast";

describe("feedback and dashboard primitives", () => {
  it("keeps the modal accessible and dismissible by keyboard", () => {
    const onClose = vi.fn();

    render(
      <Modal isOpen onClose={onClose} title="Excluir meta" closeLabel="Fechar">
        <p>Esta ação não pode ser desfeita.</p>
      </Modal>
    );

    expect(screen.getByRole("dialog", { name: "Excluir meta" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders dismissible feedback with the correct live role", () => {
    const onDismiss = vi.fn();

    render(
      <Toast tone="success" dismissLabel="Fechar" onDismiss={onDismiss}>
        Meta salva.
      </Toast>
    );

    expect(screen.getByRole("status")).toHaveTextContent("Meta salva.");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("exposes semantic values for empty, metric and progress states", () => {
    render(
      <>
        <EmptyState title="Sem lançamentos" description="Adicione o primeiro lançamento." />
        <Metric label="Saldo" value="R$ 250,00" helper="No período" tone="income" />
        <BudgetProgress label="85% do orçamento consumido" progress={85} tone="warning" />
      </>
    );

    expect(screen.getByRole("heading", { name: "Sem lançamentos" })).toBeInTheDocument();
    expect(screen.getByText("R$ 250,00")).toHaveClass("hestia-metric-value");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "85");
  });

  it("renders delta, category and chart containers without extra behavior", () => {
    render(
      <>
        <MoneyDelta delta={-200} label="Abaixo do período anterior" />
        <ol><CategoryRow label="Moradia" value="R$ 800,00" share={64} shareLabel="64% das despesas" /></ol>
        <ChartContainer title="Entradas e saídas" meta="Agosto">Conteúdo do gráfico</ChartContainer>
      </>
    );

    expect(screen.getByText("Abaixo do período anterior")).toHaveClass("hestia-money-delta-negative");
    expect(screen.getByText("64% das despesas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entradas e saídas" })).toBeInTheDocument();
  });
});
