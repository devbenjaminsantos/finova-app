import {
  normalizeImportDate,
  normalizeImportKey,
  normalizeImportType,
  parseImportMoneyToCents,
  resolveImportCategory,
} from "./transactionImportUtils";
import { TransactionImportError } from "./TransactionImportError";

const HEADER_ALIASES = {
  data: "date",
  date: "date",
  historico: "description",
  descricao: "description",
  description: "description",
  lancamento: "description",
  detalhes: "description",
  memo: "description",
  categoria: "category",
  category: "category",
  tipo: "type",
  type: "type",
  valor: "amount",
  amount: "amount",
  credito: "creditAmount",
  credit: "creditAmount",
  debito: "debitAmount",
  debit: "debitAmount",
  valorcentavos: "amountCents",
  amountcents: "amountCents",
};

function detectDelimiter(text) {
  const firstLine = String(text ?? "").split(/\r?\n/).find((line) => line.trim());

  if (!firstLine) {
    return ";";
  }

  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  return semicolonCount >= commaCount ? ";" : ",";
}

function splitCsvLine(line, delimiter) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function mapHeaders(headerRow) {
  return headerRow.map((header) => HEADER_ALIASES[normalizeImportKey(header)] || "");
}

function getValue(row, headers, key) {
  const index = headers.indexOf(key);
  return index >= 0 ? row[index] ?? "" : "";
}

function parseRawCents(value) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseAmountData(row, headers) {
  const centsValue = parseRawCents(getValue(row, headers, "amountCents"));
  if (Number.isFinite(centsValue) && centsValue !== 0) {
    return {
      amountCents: Math.abs(centsValue),
      inferredType: centsValue >= 0 ? "income" : "expense",
    };
  }

  const creditValue = parseImportMoneyToCents(getValue(row, headers, "creditAmount"));
  if (Number.isFinite(creditValue) && creditValue > 0) {
    return {
      amountCents: creditValue,
      inferredType: "income",
    };
  }

  const debitValue = parseImportMoneyToCents(getValue(row, headers, "debitAmount"));
  if (Number.isFinite(debitValue) && debitValue > 0) {
    return {
      amountCents: debitValue,
      inferredType: "expense",
    };
  }

  const amountValue = parseImportMoneyToCents(getValue(row, headers, "amount"));
  if (Number.isFinite(amountValue) && amountValue !== 0) {
    return {
      amountCents: Math.abs(amountValue),
      inferredType: amountValue >= 0 ? "income" : "expense",
    };
  }

  return {
    amountCents: NaN,
    inferredType: "",
  };
}

export function parseTransactionsCsv(text) {
  const normalizedText = String(text ?? "").trim();

  if (!normalizedText) {
    throw new TransactionImportError("CSV_EMPTY");
  }

  const delimiter = detectDelimiter(normalizedText);
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new TransactionImportError("CSV_WITHOUT_DATA");
  }

  const headers = mapHeaders(splitCsvLine(lines[0], delimiter));

  if (!headers.includes("date") || !headers.includes("description")) {
    throw new TransactionImportError("CSV_REQUIRED_COLUMNS");
  }

  if (
    !headers.includes("amount") &&
    !headers.includes("amountCents") &&
    !headers.includes("creditAmount") &&
    !headers.includes("debitAmount")
  ) {
    throw new TransactionImportError("CSV_AMOUNT_COLUMN");
  }

  return lines.slice(1).map((line, lineIndex) => {
    const row = splitCsvLine(line, delimiter);
    const explicitType = normalizeImportType(getValue(row, headers, "type"));
    const date = normalizeImportDate(getValue(row, headers, "date"));
    const description = String(getValue(row, headers, "description")).trim();
    const { amountCents, inferredType } = parseAmountData(row, headers);
    const type = explicitType || inferredType;
    const categoryResolution = resolveImportCategory(
      type,
      getValue(row, headers, "category"),
      description
    );

    if (!type || !date || !description || !Number.isFinite(amountCents) || amountCents <= 0) {
      throw new TransactionImportError("CSV_INVALID_ROW", { row: lineIndex + 2 });
    }

    return {
      date,
      description,
      type,
      category: categoryResolution.category,
      categoryConfidence: categoryResolution.confidence,
      categorySource: categoryResolution.source,
      amountCents,
      isRecurring: false,
      recurrenceEndDate: null,
    };
  });
}
