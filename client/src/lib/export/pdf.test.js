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
