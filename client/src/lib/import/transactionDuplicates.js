function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildFingerprint(transaction) {
  return [
    transaction.date || "",
    transaction.type || "",
    Number(transaction.amountCents) || 0,
    normalizeText(transaction.description),
  ].join("|");
}

export function detectImportDuplicates(previewTransactions, existingTransactions) {
  const existingFingerprints = new Set(
    (existingTransactions || []).map((transaction) => buildFingerprint(transaction))
  );
  const importFingerprints = new Set();

  return (previewTransactions || []).map((transaction) => {
    const fingerprint = buildFingerprint(transaction);
    const isDuplicateOfExisting = existingFingerprints.has(fingerprint);
    const isDuplicateInsideImport = importFingerprints.has(fingerprint);

    if (!isDuplicateInsideImport) {
      importFingerprints.add(fingerprint);
    }

    let duplicateReason = "";
    let duplicateSource = "";

    if (isDuplicateOfExisting && isDuplicateInsideImport) {
      duplicateReason =
        "Essa linha já existe no seu histórico e também aparece repetida dentro do arquivo.";
      duplicateSource = "existing_and_import";
    } else if (isDuplicateOfExisting) {
      duplicateReason = "Já existe uma transação muito parecida no seu histórico.";
      duplicateSource = "existing";
    } else if (isDuplicateInsideImport) {
      duplicateReason = "Essa linha parece repetida dentro do próprio arquivo importado.";
      duplicateSource = "import";
    }

    return {
      ...transaction,
      isPossibleDuplicate: isDuplicateOfExisting || isDuplicateInsideImport,
      duplicateSource,
      duplicateReason,
    };
  });
}

export function buildDefaultImportSelection(reconciledTransactions) {
  return new Set(
    (reconciledTransactions || [])
      .map((transaction, index) => ({ transaction, index }))
      .filter(({ transaction }) => !transaction.isPossibleDuplicate)
      .map(({ index }) => index)
  );
}
