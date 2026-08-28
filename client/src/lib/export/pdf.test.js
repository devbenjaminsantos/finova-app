import { describe, expect, it, vi } from "vitest";
import { buildTransactionsPdf, downloadPdf } from "./pdf";

describe("pdf export helpers", () => {
  it("builds a pdf document header and trailer", () => {
    const pdf = buildTransactionsPdf({
      title: "Relatorio de transacoes",
      subtitle: "Periodo filtrado",
      columns: ["Data", "Descricao", "Categoria", "Tipo", "Valor"],
      rows: [["14/04/2026", "Mercado", "Alimentacao", "Despesa", "R$ 120,00"]],
      emptyMessage: "Nenhuma transacao encontrada.",
      generatedAtLabel: "Gerado em",
      pageLabel: "Pagina",
      pageOfLabel: "de",
      locale: "pt-BR",
    });

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("xref");
    expect(pdf).toContain("%%EOF");
  });

  it("keeps accented text and all table columns in the page width", () => {
    const pdf = buildTransactionsPdf({
      title: "Transações",
      subtitle: "Todos os períodos | 1 registro(s)",
      columns: ["Data", "Descrição", "Categoria", "Tipo", "Valor"],
      rows: [["14/08/2026", "Mercado São Bento", "Alimentação", "Despesa", "R$ 153,45"]],
      emptyMessage: "Nenhuma transação encontrada.",
      generatedAtLabel: "Gerado em",
      pageLabel: "Página",
      pageOfLabel: "de",
      locale: "pt-BR",
    });

    expect(pdf).toContain("/Encoding /WinAnsiEncoding");
    expect(pdf).toContain("/F1 9 Tf");
    expect(pdf).not.toContain("FEFF");
    expect(pdf).toContain("5472616E7361E7F56573");
    expect(pdf).toContain("446573637269E7E36F");
    expect(pdf).toContain("4D65726361646F2053E36F2042656E746F");
    expect(pdf).toContain("416C696D656E7461E7E36F");
    expect(pdf).toContain("5224203135332C3435");
  });

  it("downloads the generated pdf using a blob url", () => {
    const originalCreateElement = document.createElement.bind(document);
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:finova");
    const revokeObjectURLSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const anchor = originalCreateElement("a");
        anchor.click = clickSpy;
        return anchor;
      }

      return originalCreateElement(tag);
    });

    downloadPdf("finova.pdf", "%PDF-1.4\n...");

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:finova");

    createElementSpy.mockRestore();
  });
});
