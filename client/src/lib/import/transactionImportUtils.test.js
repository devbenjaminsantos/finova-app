import { describe, expect, it } from "vitest";
import { normalizeImportCategory, resolveImportCategory } from "./transactionImportUtils";

describe("transaction import category inference", () => {
  it("maps common expense merchants to Héstia categories", () => {
    expect(
      normalizeImportCategory("expense", "", "Compra aprovada em UBER TRIP SAO PAULO")
    ).toBe("Transporte");

    expect(
      normalizeImportCategory("expense", "", "NETFLIX.COM assinatura mensal")
    ).toBe("Assinaturas");

    expect(
      normalizeImportCategory("expense", "", "Pagamento Drogasil unidade centro")
    ).toBe("Saúde");
  });

  it("maps common income descriptions to Héstia categories", () => {
    expect(
      normalizeImportCategory("income", "", "PIX CLIENTE JOAO referente servico prestado")
    ).toBe("Freelancer");

    expect(
      normalizeImportCategory("income", "", "CREDITO EM CONTA FOLHA PG EMPRESA XPTO")
    ).toBe("Salário");

    expect(
      normalizeImportCategory("income", "", "Rendimento CDB banco digital")
    ).toBe("Investimentos");
  });

  it("keeps explicit known categories when the bank already provides them", () => {
    expect(
      normalizeImportCategory("expense", "Moradia", "Conta de energia")
    ).toBe("Moradia");
  });

  it("marks fallback and weak inferences as low confidence", () => {
    expect(resolveImportCategory("expense", "", "Compra generica sem pistas")).toMatchObject({
      category: "Outros",
      confidence: "low",
    });

    expect(resolveImportCategory("expense", "", "pix")).toMatchObject({
      category: "Outros",
      confidence: "low",
    });

    expect(resolveImportCategory("expense", "", "Uber trip centro")).toMatchObject({
      category: "Transporte",
      confidence: "high",
      source: "inferred",
    });
  });
});
