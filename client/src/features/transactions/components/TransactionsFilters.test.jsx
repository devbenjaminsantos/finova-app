import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import TransactionsFilters from "./TransactionsFilters";

function FiltersHarness({ onReset = vi.fn() }) {
  const [q, setQ] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [month, setMonth] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");

  return (
    <TransactionsFilters
      q={q}
      setQ={setQ}
      accountFilter={accountFilter}
      setAccountFilter={setAccountFilter}
      tagFilter={tagFilter}
      setTagFilter={setTagFilter}
      typeFilter={typeFilter}
      setTypeFilter={setTypeFilter}
      categoryFilter={categoryFilter}
      setCategoryFilter={setCategoryFilter}
      month={month}
      setMonth={setMonth}
      sortBy={sortBy}
      setSortBy={setSortBy}
      categories={["Moradia"]}
      tags={["casa"]}
      accounts={[]}
      onReset={onReset}
    />
  );
}

describe("TransactionsFilters", () => {
  it("opens filters in a dismissible sheet and restores page scrolling when closed", () => {
    render(<FiltersHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));

    expect(screen.getByRole("dialog", { name: "Filtrar transações" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Filtrar transações" })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("shows active filters and keeps clear/reset inside the sheet", () => {
    const onReset = vi.fn();
    render(<FiltersHarness onReset={onReset} />);

    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const sheet = screen.getByRole("dialog", { name: "Filtrar transações" });

    fireEvent.change(within(sheet).getByLabelText("Tipo"), { target: { value: "expense" } });

    expect(within(sheet).getByText("1 filtro(s) ativo(s)")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Limpar filtros" }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
