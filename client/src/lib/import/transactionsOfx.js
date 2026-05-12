import {
  normalizeImportDate,
  normalizeImportType,
  parseImportMoneyToCents,
  resolveImportCategory,
} from "./transactionImportUtils";

const OFX_TYPE_ALIASES = {
  credit: "income",
  dep: "income",
  directdep: "income",
  int: "income",
  div: "income",
  debit: "expense",
  check: "expense",
  payment: "expense",
  fee: "expense",
  servicecharge: "expense",
  atm: "expense",
  pos: "expense",
  cash: "expense",
  xfer: "",
  transfer: "",
};

function getTransactionBlocks(text) {
  return Array.from(String(text ?? "").matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)).map(
    (match) => match[1]
  );
}

function extractTagValue(block, tagName) {
  const regex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, "i");
  const match = String(block ?? "").match(regex);
  return match ? match[1].trim() : "";
}

function inferType(trnType, amountCents) {
  const normalizedType = normalizeImportType(trnType);
  if (normalizedType) {
    return normalizedType;
  }

  const aliasType = OFX_TYPE_ALIASES[String(trnType ?? "").trim().toLowerCase()];
  if (aliasType) {
    return aliasType;
  }

  if (amountCents > 0) {
    return "income";
  }

  if (amountCents < 0) {
    return "expense";
  }

  return "";
}

export function parseTransactionsOfx(text) {
  const normalizedText = String(text ?? "").trim();

  if (!normalizedText) {
    throw new Error("O arquivo OFX esta vazio.");
  }

  const blocks = getTransactionBlocks(normalizedText);

  if (blocks.length === 0) {
    throw new Error("Não foi encontrada nenhuma transação válida no OFX.");
  }

  return blocks.map((block, index) => {
    const trnType = extractTagValue(block, "TRNTYPE");
    const amountRaw = extractTagValue(block, "TRNAMT");
    const amountCentsSigned = parseImportMoneyToCents(amountRaw);
    const date = normalizeImportDate(extractTagValue(block, "DTPOSTED"));
    const fitId = extractTagValue(block, "FITID");
    const name = extractTagValue(block, "NAME");
    const memo = extractTagValue(block, "MEMO");
    const description = memo || name || trnType || `Transacao OFX ${index + 1}`;
    const type = inferType(trnType, amountCentsSigned);
    const categoryResolution = resolveImportCategory(type, memo || name, description);

    if (
      !type ||
      !date ||
      !description ||
      !Number.isFinite(amountCentsSigned) ||
      amountCentsSigned === 0
    ) {
      throw new Error(`A transacao ${index + 1} do OFX esta invalida e precisa ser revisada.`);
    }

    return {
      date,
      description,
      type,
      category: categoryResolution.category,
      categoryConfidence: categoryResolution.confidence,
      categorySource: categoryResolution.source,
      amountCents: Math.abs(amountCentsSigned),
      sourceReference: fitId || null,
      isRecurring: false,
      recurrenceEndDate: null,
    };
  });
}
