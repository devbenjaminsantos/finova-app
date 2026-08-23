import { describe, expect, it } from "vitest";
import { buildCsv } from "./csv";

describe("csv export helpers", () => {
  it("builds rows with semicolon separators", () => {
    const csv = buildCsv([
      ["Data", "Descricao", "Valor"],
      ["2026-04-11", "Mercado", "150,00"],
    ]);

    expect(csv).toBe('Data;Descricao;Valor\n2026-04-11;Mercado;"150,00"');
  });

  it("escapes values that contain quotes, semicolons or line breaks", () => {
    const csv = buildCsv([
      ["Descricao", "Observacao"],
      ['Plano "Premium"', "Linha 1\nLinha 2; final"],
    ]);

    expect(csv).toContain('"Plano ""Premium"""');
    expect(csv).toContain('"Linha 1\nLinha 2; final"');
  });

  it("neutralizes spreadsheet formulas in user-controlled cells", () => {
    const csv = buildCsv([
      ["Descricao", "Categoria"],
      ["=HYPERLINK(\"https://example.com\")", "  @SUM(A1:A2)"],
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"');
    expect(csv).toContain("'  @SUM(A1:A2)");
  });
});
