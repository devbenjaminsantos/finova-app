import { describe, expect, it } from "vitest";
import { parseTransactionsCsv } from "./transactionsCsv";

describe("transactionsCsv import parser", () => {
  it("parses semicolon csv with pt-BR headers", () => {
    const result = parseTransactionsCsv(`Data;Descricao;Categoria;Tipo;Valor
14/04/2026;Mercado;Alimentacao;Despesa;120,50
15/04/2026;Salario;Salario;Receita;5000,00`);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: "2026-04-14",
      description: "Mercado",
      type: "expense",
      amountCents: 12050,
      category: "Alimentação",
    });
    expect(result[1]).toMatchObject({
      type: "income",
      amountCents: 500000,
      category: "Salário",
    });
  });

  it("parses amount cents when provided directly", () => {
    const result = parseTransactionsCsv(`date,description,type,amountCents,category
2026-04-14,Pix recebido,income,18990,Reembolso`);

    expect(result[0].amountCents).toBe(18990);
  });

  it("infers Finova categories from bank-like labels and descriptions", () => {
    const result = parseTransactionsCsv(`Data;Descricao;Categoria;Tipo;Valor
14/04/2026;Supermercado Central;Supermercado;Despesa;220,00
15/04/2026;Posto Shell;Combustivel;Despesa;180,00
16/04/2026;Pagamento empresa XPTO;Credito em conta;Receita;3500,00`);

    expect(result[0].category).toBe("Alimentação");
    expect(result[1].category).toBe("Transporte");
    expect(result[2].category).toBe("Salário");
  });

  it("infers type from signed amount when the csv has no type column", () => {
    const result = parseTransactionsCsv(`Data;Historico;Valor
14/04/2026;Compra mercado;-120,00
15/04/2026;Pix recebido;350,00`);

    expect(result[0]).toMatchObject({
      type: "expense",
      amountCents: 12000,
      category: "Alimentação",
    });
    expect(result[1]).toMatchObject({
      type: "income",
      amountCents: 35000,
      category: "Outros",
    });
  });

  it("parses bank exports with separate credit and debit columns", () => {
    const result = parseTransactionsCsv(`Data;Descricao;Credito;Debito;Categoria
2026-04-14;Transferencia recebida;900,00;;Credito em conta
2026-04-15;Posto Shell;;180,00;Combustivel`);

    expect(result[0]).toMatchObject({
      type: "income",
      amountCents: 90000,
      category: "Salário",
    });
    expect(result[1]).toMatchObject({
      type: "expense",
      amountCents: 18000,
      category: "Transporte",
    });
  });

  it("throws when a required column is missing", () => {
    expect(() =>
      parseTransactionsCsv(`Descricao;Valor
Mercado;120,00`)
    ).toThrow("CSV_REQUIRED_COLUMNS");
  });
});
