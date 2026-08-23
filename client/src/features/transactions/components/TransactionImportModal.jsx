import { useEffect, useMemo, useRef, useState } from "react";
import { getTransactionCategories } from "../../../lib/constants/transactionCategories";
import { formatBRLFromCents } from "../../../lib/format/currency";
import {
  buildDefaultImportSelection,
  detectImportDuplicates,
} from "../../../lib/import/transactionDuplicates";
import { parseTransactionsImport } from "../../../lib/import/transactionsImport";
import { useI18n } from "../../../i18n/LanguageProvider";

const MAX_IMPORT_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const IMPORT_ERROR_KEYS = {
  CSV_EMPTY: "transactions.importErrorCsvEmpty",
  CSV_WITHOUT_DATA: "transactions.importErrorCsvWithoutData",
  CSV_REQUIRED_COLUMNS: "transactions.importErrorCsvRequiredColumns",
  CSV_AMOUNT_COLUMN: "transactions.importErrorCsvAmountColumn",
  CSV_INVALID_ROW: "transactions.importErrorCsvInvalidRow",
  OFX_EMPTY: "transactions.importErrorOfxEmpty",
  OFX_WITHOUT_TRANSACTIONS: "transactions.importErrorOfxWithoutTransactions",
  OFX_INVALID_TRANSACTION: "transactions.importErrorOfxInvalidTransaction",
};

function resolveImportReadError(error, t) {
  const translationKey = IMPORT_ERROR_KEYS[error?.code];
  return translationKey
    ? t(translationKey, error.details)
    : t("transactions.importReadError");
}

export default function TransactionImportModal({
  isOpen,
  onClose,
  onImport,
  existingTransactions = [],
  accounts = [],
}) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [importFormat, setImportFormat] = useState("");
  const [preview, setPreview] = useState([]);
  const [selectedIndexes, setSelectedIndexes] = useState(new Set());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewFilter, setPreviewFilter] = useState("all");
  const [previewSearch, setPreviewSearch] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkDescriptionPrefix, setBulkDescriptionPrefix] = useState("");
  const [bulkDescriptionReplace, setBulkDescriptionReplace] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("all");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFileName("");
    setImportFormat("");
    setPreview([]);
    setSelectedIndexes(new Set());
    setError("");
    setFeedback("");
    setIsSubmitting(false);
    setPreviewFilter("all");
    setPreviewSearch("");
    setBulkType("");
    setBulkCategory("");
    setBulkDescriptionPrefix("");
    setBulkDescriptionReplace("");
    setFinancialAccountId("all");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSubmitting, onClose]);

  const reconciledPreview = useMemo(
    () => detectImportDuplicates(preview, existingTransactions),
    [preview, existingTransactions]
  );

  const previewFilters = useMemo(
    () => [
      { key: "all", label: t("transactions.importPreviewAll") },
      { key: "new", label: t("transactions.importPreviewNew") },
      { key: "duplicates", label: t("transactions.importPreviewDuplicates") },
      { key: "selected", label: t("transactions.importPreviewSelected") },
    ],
    [t]
  );

  const filteredPreview = useMemo(() => {
    const normalizedSearch = previewSearch.trim().toLowerCase();

    return reconciledPreview.filter((transaction, index) => {
      if (previewFilter === "new" && transaction.isPossibleDuplicate) {
        return false;
      }

      if (previewFilter === "duplicates" && !transaction.isPossibleDuplicate) {
        return false;
      }

      if (previewFilter === "selected" && !selectedIndexes.has(index)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [transaction.description, transaction.category, transaction.date]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [previewFilter, previewSearch, reconciledPreview, selectedIndexes]);

  const previewRows = useMemo(
    () =>
      filteredPreview.map((transaction, index) => ({
        transaction,
        originalIndex: reconciledPreview.indexOf(transaction, index > 0 ? 0 : 0),
      })),
    [filteredPreview, reconciledPreview]
  );

  const selectedTransactions = useMemo(
    () => reconciledPreview.filter((_, index) => selectedIndexes.has(index)),
    [reconciledPreview, selectedIndexes]
  );

  const selectedAccountLabel = useMemo(() => {
    if (financialAccountId === "all") {
      return t("transactions.unlinkedAccount");
    }

    return (
      accounts.find((account) => String(account.id) === financialAccountId)?.label ||
      t("transactions.selectedAccountFallback")
    );
  }, [accounts, financialAccountId, t]);

  const summary = useMemo(
    () =>
      reconciledPreview.reduce(
        (accumulator, transaction, index) => {
          if (transaction.type === "income") {
            accumulator.incomeCount += 1;
          } else {
            accumulator.expenseCount += 1;
          }

          if (transaction.isPossibleDuplicate) {
            accumulator.duplicateCount += 1;
          }

          if (transaction.categoryConfidence === "low") {
            accumulator.lowConfidenceCount += 1;
          }

          if (transaction.duplicateSource === "existing") {
            accumulator.existingDuplicateCount += 1;
          }

          if (transaction.duplicateSource === "import") {
            accumulator.importDuplicateCount += 1;
          }

          if (transaction.duplicateSource === "existing_and_import") {
            accumulator.existingDuplicateCount += 1;
            accumulator.importDuplicateCount += 1;
          }

          if (selectedIndexes.has(index)) {
            accumulator.selectedCount += 1;
            accumulator.selectedAmount += Number(transaction.amountCents) || 0;
            accumulator.selectedTypes.add(transaction.type);

            if (transaction.categoryConfidence === "low") {
              accumulator.lowConfidenceSelectedCount += 1;
            }
          }

          return accumulator;
        },
        {
          incomeCount: 0,
          expenseCount: 0,
          duplicateCount: 0,
          existingDuplicateCount: 0,
          importDuplicateCount: 0,
          selectedCount: 0,
          selectedAmount: 0,
          selectedTypes: new Set(),
          lowConfidenceCount: 0,
          lowConfidenceSelectedCount: 0,
        }
      ),
    [reconciledPreview, selectedIndexes]
  );

  const selectedType = useMemo(() => {
    if (summary.selectedTypes.size !== 1) {
      return "";
    }

    return Array.from(summary.selectedTypes)[0] || "";
  }, [summary.selectedTypes]);

  const bulkCategoryOptions = useMemo(
    () => (selectedType ? getTransactionCategories(selectedType) : []),
    [selectedType]
  );

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setFeedback("");

    try {
      if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
        setFileName(file.name);
        setImportFormat("");
        setPreview([]);
        setSelectedIndexes(new Set());
        setError(t("transactions.importFileTooLarge"));
        return;
      }

      const content = await file.text();
      const { format, transactions } = parseTransactionsImport(content, file.name);
      const reconciled = detectImportDuplicates(transactions, existingTransactions);

      setFileName(file.name);
      setImportFormat(format);
      setPreview(transactions);
      setSelectedIndexes(buildDefaultImportSelection(reconciled));
      setFeedback(t("transactions.importReadSuccess", { count: transactions.length }));
    } catch (requestError) {
      setFileName(file.name);
      setImportFormat("");
      setPreview([]);
      setSelectedIndexes(new Set());
      setError(resolveImportReadError(requestError, t));
    }
  }

  async function handleImportAction() {
    if (selectedTransactions.length === 0) {
      setError(t("transactions.importSelectAtLeastOne"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onImport({
        transactions: selectedTransactions.map((transaction) => ({
          ...transaction,
          financialAccountId: financialAccountId === "all" ? null : Number(financialAccountId),
        })),
        importFormat,
      });
      onClose();
    } catch (requestError) {
      setError(requestError.message || t("transactions.importCompleteError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderDuplicateStatus(transaction) {
    if (!transaction.isPossibleDuplicate) {
      return <span className="finova-badge-primary">{t("transactions.importStatusNew")}</span>;
    }

    if (transaction.duplicateSource === "existing") {
      return (
        <span className="finova-badge-neutral">{t("transactions.importStatusExisting")}</span>
      );
    }

    if (transaction.duplicateSource === "import") {
      return <span className="finova-badge-neutral">{t("transactions.importStatusInFile")}</span>;
    }

    if (transaction.duplicateSource === "existing_and_import") {
      return (
        <span className="finova-badge-neutral">
          {t("transactions.importStatusExistingAndFile")}
        </span>
      );
    }

    return (
      <span className="finova-badge-neutral">
        {t("transactions.importStatusPossibleDuplicate")}
      </span>
    );
  }

  function toggleSelection(index) {
    setSelectedIndexes((current) => {
      const next = new Set(current);

      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }

      return next;
    });
  }

  function deselectSuggestedDuplicates() {
    setSelectedIndexes((current) => {
      const next = new Set(current);

      reconciledPreview.forEach((transaction, index) => {
        if (transaction.isPossibleDuplicate) {
          next.delete(index);
        }
      });

      return next;
    });
  }

  function selectAllRows() {
    setSelectedIndexes(new Set(reconciledPreview.map((_, index) => index)));
  }

  function selectOnlyNewRows() {
    setSelectedIndexes(
      new Set(
        reconciledPreview
          .map((transaction, index) => ({ transaction, index }))
          .filter(({ transaction }) => !transaction.isPossibleDuplicate)
          .map(({ index }) => index)
      )
    );
  }

  function removePreviewRow(indexToRemove) {
    setPreview((current) => current.filter((_, index) => index !== indexToRemove));
    setSelectedIndexes((current) => {
      const next = new Set();

      for (const index of current) {
        if (index === indexToRemove) {
          continue;
        }

        next.add(index > indexToRemove ? index - 1 : index);
      }

      return next;
    });
  }

  function updatePreviewRow(indexToUpdate, updater) {
    setPreview((current) =>
      current.map((transaction, index) => {
        if (index !== indexToUpdate) {
          return transaction;
        }

        return typeof updater === "function"
          ? updater(transaction)
          : { ...transaction, ...updater };
      })
    );
  }

  function updateTransactionType(indexToUpdate, nextType) {
    updatePreviewRow(indexToUpdate, (transaction) => {
      const availableCategories = getTransactionCategories(nextType);

      return {
        ...transaction,
        type: nextType,
        category: availableCategories.includes(transaction.category)
          ? transaction.category
          : availableCategories[availableCategories.length - 1],
      };
    });
  }

  function updateTransactionCategory(indexToUpdate, nextCategory) {
    updatePreviewRow(indexToUpdate, {
      category: nextCategory,
      categoryConfidence: "high",
      categorySource: "manual_review",
    });
  }

  function applyBulkType() {
    if (!bulkType || summary.selectedCount === 0) {
      return;
    }

    setPreview((current) =>
      current.map((transaction, index) => {
        if (!selectedIndexes.has(index)) {
          return transaction;
        }

        const availableCategories = getTransactionCategories(bulkType);

        return {
          ...transaction,
          type: bulkType,
          category: availableCategories.includes(transaction.category)
            ? transaction.category
            : availableCategories[availableCategories.length - 1],
        };
      })
    );

    setBulkCategory("");
  }

  function applyBulkCategory() {
    if (!bulkCategory || summary.selectedCount === 0 || !selectedType) {
      return;
    }

    setPreview((current) =>
      current.map((transaction, index) =>
        selectedIndexes.has(index)
          ? {
              ...transaction,
              category: bulkCategory,
              categoryConfidence: "high",
              categorySource: "manual_review",
            }
          : transaction
      )
    );
  }

  function applyBulkDescriptionPrefix() {
    const normalizedPrefix = bulkDescriptionPrefix.trim();

    if (!normalizedPrefix || summary.selectedCount === 0) {
      return;
    }

    setPreview((current) =>
      current.map((transaction, index) => {
        if (!selectedIndexes.has(index)) {
          return transaction;
        }

        if (
          transaction.description.toLowerCase().startsWith(`${normalizedPrefix.toLowerCase()} `)
        ) {
          return transaction;
        }

        return {
          ...transaction,
          description: `${normalizedPrefix} ${transaction.description}`.trim(),
        };
      })
    );
  }

  function applyBulkDescriptionReplace() {
    const normalizedDescription = bulkDescriptionReplace.trim();

    if (!normalizedDescription || summary.selectedCount === 0) {
      return;
    }

    setPreview((current) =>
      current.map((transaction, index) =>
        selectedIndexes.has(index)
          ? {
              ...transaction,
              description: normalizedDescription,
            }
          : transaction
      )
    );
  }

  function removeSelectedRows() {
    if (summary.selectedCount === 0) {
      return;
    }

    setPreview((current) => current.filter((_, index) => !selectedIndexes.has(index)));
    setSelectedIndexes(new Set());
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal d-block finova-modal-backdrop"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content border-0 finova-modal-surface">
          <div className="modal-header border-0 pb-0 px-4 pt-4 finova-modal-header">
            <div>
              <h2 className="finova-title h4 mb-1">{t("transactions.importTitle")}</h2>
              <p className="finova-subtitle small mb-0">{t("transactions.importSubtitle")}</p>
            </div>

            <button
              type="button"
              className="btn-close finova-modal-close finova-icon-tooltip"
              aria-label={t("transactions.close")}
              title={t("transactions.close")}
              data-tooltip={t("transactions.close")}
              onClick={onClose}
            />
          </div>

          <div className="modal-body px-4 pb-4 pt-3">
            <div className="finova-card-soft p-3 mb-4">
              <div className="row g-3 align-items-end">
                <div className="col-12 col-lg-8">
                  <label
                    className="form-label text-dark fw-medium"
                    htmlFor="transaction-import-account"
                  >
                    {t("transactions.importDestinationAccount")}
                  </label>
                  <select
                    id="transaction-import-account"
                    className="form-select finova-select"
                    value={financialAccountId}
                    onChange={(event) => setFinancialAccountId(event.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="all">{t("transactions.unlinkedAccount")}</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={String(account.id)}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-12 col-lg-4">
                  <p className="form-text mb-0">{t("transactions.importDestinationHelp")}</p>
                </div>

                <div className="col-12">
                  <div className="small text-muted">
                    <strong>{t("transactions.importCurrentDestination")}:</strong>{" "}
                    {selectedAccountLabel}
                  </div>
                </div>
              </div>
            </div>

            <div className="finova-card-soft p-3 mb-4">
              <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                <div>
                  <div className="finova-title h6 mb-1">{t("transactions.importFileTitle")}</div>
                  <p className="finova-subtitle mb-0">{t("transactions.importFileSubtitle")}</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.ofx,text/csv,application/x-ofx"
                  className="form-control finova-input"
                  onChange={handleFileSelection}
                />
              </div>
            </div>

            {fileName ? (
              <div className="mb-3 d-flex flex-wrap gap-2">
                <span className="finova-badge-neutral">{fileName}</span>
                {importFormat ? (
                  <span className="finova-badge-primary text-uppercase">{importFormat}</span>
                ) : null}
              </div>
            ) : null}

            {error ? <div className="alert alert-danger py-2 finova-status-banner">{error}</div> : null}
            {feedback ? <div className="alert alert-success py-2 finova-status-banner">{feedback}</div> : null}

            {reconciledPreview.length > 0 ? (
              <>
                <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
                  <div>
                    <h3 className="finova-title h5 mb-1">{t("transactions.importPreviewTitle")}</h3>
                    <p className="finova-subtitle mb-0">{t("transactions.importPreviewSubtitle")}</p>
                    {summary.lowConfidenceCount > 0 ? (
                      <div className="small text-muted mt-2">
                        {t("transactions.importLowConfidenceSummary", {
                          count: summary.lowConfidenceCount,
                        })}
                      </div>
                    ) : null}
                  </div>

                  <div className="d-flex flex-column align-items-end gap-2">
                    <span className="finova-badge-primary">
                      {t("transactions.importSelectedCount", { count: summary.selectedCount })}
                    </span>
                    <span className="finova-badge-neutral">
                      {t("transactions.importSelectedTotal", {
                        amount: formatBRLFromCents(summary.selectedAmount),
                      })}
                    </span>
                  </div>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-3">
                    <div className="finova-card-soft p-3 h-100">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.importIncomeCount")}
                      </div>
                      <div className="finova-title h5 mb-0">{summary.incomeCount}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="finova-card-soft p-3 h-100">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.importExpenseCount")}
                      </div>
                      <div className="finova-title h5 mb-0">{summary.expenseCount}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="finova-card-soft p-3 h-100">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.importExistingDuplicates")}
                      </div>
                      <div className="finova-title h5 mb-0">{summary.existingDuplicateCount}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-3">
                    <div className="finova-card-soft p-3 h-100">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.importFileDuplicates")}
                      </div>
                      <div className="finova-title h5 mb-0">{summary.importDuplicateCount}</div>
                    </div>
                  </div>
                </div>

                <div className="finova-actions-row mb-3">
                  <button
                    type="button"
                    className="btn finova-btn-light"
                    onClick={selectOnlyNewRows}
                    disabled={isSubmitting || reconciledPreview.length === 0}
                  >
                    {t("transactions.importSelectOnlyNew")}
                  </button>
                  <button
                    type="button"
                    className="btn finova-btn-light"
                    onClick={deselectSuggestedDuplicates}
                    disabled={isSubmitting || summary.duplicateCount === 0}
                  >
                    {t("transactions.importDeselectSuggestedDuplicates")}
                  </button>
                  <button
                    type="button"
                    className="btn finova-btn-light"
                    onClick={selectAllRows}
                    disabled={isSubmitting || reconciledPreview.length === 0}
                  >
                    {t("transactions.importSelectAll")}
                  </button>
                  <button
                    type="button"
                    className="btn finova-btn-light"
                    onClick={removeSelectedRows}
                    disabled={isSubmitting || summary.selectedCount === 0}
                  >
                    {t("transactions.importRemoveSelected")}
                  </button>
                </div>

                <div className="finova-card-soft p-3 mb-3">
                  <div className="row g-3 align-items-end">
                    <div className="col-12 col-xl-4">
                      <label
                        className="form-label text-dark fw-medium"
                        htmlFor="import-preview-search"
                      >
                        {t("transactions.importSearchLabel")}
                      </label>
                      <input
                        id="import-preview-search"
                        type="text"
                        className="form-control finova-input"
                        placeholder={t("transactions.importSearchPlaceholder")}
                        value={previewSearch}
                        onChange={(event) => setPreviewSearch(event.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="col-12 col-xl-8">
                      <label className="form-label text-dark fw-medium">
                        {t("transactions.importFilterRows")}
                      </label>
                      <div className="finova-segmented-actions">
                        {previewFilters.map((filter) => (
                          <button
                            key={filter.key}
                            type="button"
                            className={
                              previewFilter === filter.key
                                ? "btn finova-btn-primary"
                                : "btn finova-btn-light"
                            }
                            onClick={() => setPreviewFilter(filter.key)}
                            disabled={isSubmitting}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="finova-card-soft p-3 mb-3">
                  <div className="d-flex flex-column gap-3">
                    <div>
                      <div className="finova-title h6 mb-1">{t("transactions.importBulkTitle")}</div>
                      <p className="finova-subtitle mb-0">{t("transactions.importBulkSubtitle")}</p>
                      {summary.lowConfidenceSelectedCount > 0 ? (
                        <div className="small text-muted mt-2">
                          {t("transactions.importBulkLowConfidence", {
                            count: summary.lowConfidenceSelectedCount,
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div className="row g-3 align-items-end">
                      <div className="col-12 col-lg-6">
                        <label
                          className="form-label text-dark fw-medium"
                          htmlFor="bulk-import-description-prefix"
                        >
                          {t("transactions.importBulkPrefixLabel")}
                        </label>
                        <input
                          id="bulk-import-description-prefix"
                          type="text"
                          className="form-control finova-input"
                          placeholder={t("transactions.importBulkPrefixPlaceholder")}
                          value={bulkDescriptionPrefix}
                          onChange={(event) => setBulkDescriptionPrefix(event.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="col-12 col-lg-2">
                        <button
                          type="button"
                          className="btn finova-btn-light w-100"
                          onClick={applyBulkDescriptionPrefix}
                          disabled={
                            isSubmitting ||
                            !bulkDescriptionPrefix.trim() ||
                            summary.selectedCount === 0
                          }
                        >
                          {t("transactions.importBulkApplyText")}
                        </button>
                      </div>

                      <div className="col-12 col-lg-6">
                        <label
                          className="form-label text-dark fw-medium"
                          htmlFor="bulk-import-description-replace"
                        >
                          {t("transactions.importBulkReplaceLabel")}
                        </label>
                        <input
                          id="bulk-import-description-replace"
                          type="text"
                          className="form-control finova-input"
                          placeholder={t("transactions.importBulkReplacePlaceholder")}
                          value={bulkDescriptionReplace}
                          onChange={(event) => setBulkDescriptionReplace(event.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="col-12 col-lg-2">
                        <button
                          type="button"
                          className="btn finova-btn-light w-100"
                          onClick={applyBulkDescriptionReplace}
                          disabled={
                            isSubmitting ||
                            !bulkDescriptionReplace.trim() ||
                            summary.selectedCount === 0
                          }
                        >
                          {t("transactions.importBulkReplace")}
                        </button>
                      </div>

                      <div className="col-12 col-lg-4">
                        <label className="form-label text-dark fw-medium" htmlFor="bulk-import-type">
                          {t("transactions.importBulkTypeLabel")}
                        </label>
                        <select
                          id="bulk-import-type"
                          className="form-select finova-select"
                          value={bulkType}
                          onChange={(event) => setBulkType(event.target.value)}
                          disabled={isSubmitting}
                        >
                          <option value="">{t("transactions.importBulkSelect")}</option>
                          <option value="expense">{t("transactions.expense")}</option>
                          <option value="income">{t("transactions.income")}</option>
                        </select>
                      </div>

                      <div className="col-12 col-lg-2">
                        <button
                          type="button"
                          className="btn finova-btn-light w-100"
                          onClick={applyBulkType}
                          disabled={isSubmitting || !bulkType || summary.selectedCount === 0}
                        >
                          {t("transactions.importBulkApplyType")}
                        </button>
                      </div>

                      <div className="col-12 col-lg-4">
                        <label
                          className="form-label text-dark fw-medium"
                          htmlFor="bulk-import-category"
                        >
                          {t("transactions.importBulkCategoryLabel")}
                        </label>
                        <select
                          id="bulk-import-category"
                          className="form-select finova-select"
                          value={bulkCategory}
                          onChange={(event) => setBulkCategory(event.target.value)}
                          disabled={isSubmitting || summary.selectedCount === 0 || !selectedType}
                        >
                          <option value="">
                            {selectedType
                              ? t("transactions.importBulkSelect")
                              : t("transactions.importBulkSelectSameType")}
                          </option>
                          {bulkCategoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-12 col-lg-2">
                        <button
                          type="button"
                          className="btn finova-btn-light w-100"
                          onClick={applyBulkCategory}
                          disabled={
                            isSubmitting ||
                            !bulkCategory ||
                            summary.selectedCount === 0 ||
                            !selectedType
                          }
                        >
                          {t("transactions.importBulkApplyCategory")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="table-responsive finova-table-shell-responsive">
                  <table className="table finova-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: "72px" }}>{t("transactions.importTableImport")}</th>
                        <th>{t("common.date")}</th>
                        <th>{t("common.description")}</th>
                        <th>{t("common.category")}</th>
                        <th>{t("common.type")}</th>
                        <th>{t("transactions.importTableStatus")}</th>
                        <th className="text-end">{t("common.value")}</th>
                        <th className="text-end">{t("transactions.importTableAction")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map(({ transaction, originalIndex }) => {
                        const isSelected = selectedIndexes.has(originalIndex);

                        return (
                          <tr key={`${transaction.date}-${transaction.description}-${originalIndex}`}>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input finova-check-input"
                                checked={isSelected}
                                onChange={() => toggleSelection(originalIndex)}
                                aria-label={t("transactions.importSelectRow", {
                                  description: transaction.description,
                                })}
                              />
                            </td>
                            <td>{transaction.date}</td>
                            <td>
                              <div>{transaction.description}</div>
                              <div className="mt-1 d-flex flex-wrap gap-2">
                                {transaction.categoryConfidence === "low" ? (
                                  <span className="finova-badge-warning">
                                    {t("transactions.importReviewCategory")}
                                  </span>
                                ) : null}
                              </div>
                              {transaction.duplicateReason ? (
                                <div className="small text-muted">{transaction.duplicateReason}</div>
                              ) : null}
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm finova-select"
                                value={transaction.category}
                                onChange={(event) =>
                                  updateTransactionCategory(originalIndex, event.target.value)
                                }
                                disabled={isSubmitting}
                              >
                                {getTransactionCategories(transaction.type).map((category) => (
                                  <option key={category} value={category}>
                                    {category}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm finova-select"
                                value={transaction.type}
                                onChange={(event) =>
                                  updateTransactionType(originalIndex, event.target.value)
                                }
                                disabled={isSubmitting}
                              >
                                <option value="expense">{t("transactions.expense")}</option>
                                <option value="income">{t("transactions.income")}</option>
                              </select>
                            </td>
                            <td>{renderDuplicateStatus(transaction)}</td>
                            <td className="text-end fw-semibold">
                              {formatBRLFromCents(transaction.amountCents)}
                            </td>
                            <td className="text-end">
                              <button
                                type="button"
                                className="btn btn-sm finova-btn-light"
                                onClick={() => removePreviewRow(originalIndex)}
                                disabled={isSubmitting}
                              >
                                {t("transactions.remove")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {previewRows.length === 0 ? (
                  <div className="finova-page-note mt-3">{t("transactions.importNoRowsForFilter")}</div>
                ) : null}
              </>
            ) : (
              <div className="finova-card-soft p-4">
                <h3 className="finova-title h6 mb-2">{t("transactions.importNoRowsTitle")}</h3>
                <p className="finova-subtitle mb-0">{t("transactions.importNoRowsSubtitle")}</p>
              </div>
            )}

            <div className="finova-actions-row finova-actions-row-end finova-modal-actions pt-4">
              <button
                type="button"
                className="btn finova-btn-light px-4"
                onClick={onClose}
                disabled={isSubmitting}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn finova-btn-primary px-4"
                onClick={handleImportAction}
                disabled={isSubmitting || selectedTransactions.length === 0}
              >
                {isSubmitting
                  ? t("transactions.importing")
                  : t("transactions.confirmImport", {
                      count: selectedTransactions.length,
                    })}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
