import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";

describe("form controls", () => {
  it("disables a loading button and exposes its busy state", () => {
    render(
      <Button type="submit" loading>
        Salvar
      </Button>
    );

    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("hestia-button-primary");
  });

  it("supports link and destructive variants without changing button semantics", () => {
    render(
      <>
        <Button variant="link">Reenviar</Button>
        <Button variant="danger">Remover</Button>
      </>
    );

    expect(screen.getByRole("button", { name: "Reenviar" })).toHaveClass("hestia-button-link");
    expect(screen.getByRole("button", { name: "Remover" })).toHaveClass("hestia-button-danger");
  });

  it("connects an input label, help text and error", () => {
    render(
      <Input
        id="account-name"
        label="Nome da conta"
        helpText="Use um nome fácil de reconhecer."
        error="Informe um nome."
      />
    );

    const input = screen.getByLabelText("Nome da conta");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "account-name-help account-name-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um nome.");
  });

  it("renders declared select options and preserves the change handler", () => {
    const onChange = vi.fn();
    render(
      <Select
        id="account-type"
        label="Tipo de conta"
        value="wallet"
        onChange={onChange}
        options={[
          { value: "bank", label: "Conta bancária" },
          { value: "wallet", label: "Carteira" },
        ]}
      />
    );

    const select = screen.getByLabelText("Tipo de conta");
    expect(select).toHaveValue("wallet");
    fireEvent.change(select, { target: { value: "bank" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
