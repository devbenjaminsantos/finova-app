import { describe, expect, it } from "vitest";
import { parseTransactionsOfx } from "./transactionsOfx";

describe("transactionsOfx import parser", () => {
  it("parses debit and credit transactions from OFX", () => {
    const result = parseTransactionsOfx(`
OFXHEADER:100
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20260414000000[-3:BRT]
            <TRNAMT>-180.35
            <FITID>1
            <NAME>POSTO SHELL
            <MEMO>Combustivel
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20260415000000[-3:BRT]
            <TRNAMT>5000.00
            <FITID>2
            <NAME>EMPRESA XPTO
            <MEMO>Credito em conta
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      date: "2026-04-14",
      type: "expense",
      amountCents: 18035,
      category: "Transporte",
    });
    expect(result[1]).toMatchObject({
      date: "2026-04-15",
      type: "income",
      amountCents: 500000,
      category: "Salário",
    });
  });

  it("prefers memo as description when available", () => {
    const result = parseTransactionsOfx(`
<OFX>
  <STMTTRN>
    <TRNTYPE>DEBIT
    <DTPOSTED>20260416000000
    <TRNAMT>-45.00
    <NAME>IFOOD
    <MEMO>Pedido iFood bairro
  </STMTTRN>
</OFX>`);

    expect(result[0].description).toBe("Pedido iFood bairro");
    expect(result[0].category).toBe("Alimentação");
  });

  it("throws when no statement transactions are found", () => {
    expect(() => parseTransactionsOfx("<OFX></OFX>")).toThrow("OFX_WITHOUT_TRANSACTIONS");
  });
});
