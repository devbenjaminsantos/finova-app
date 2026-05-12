import { useI18n } from "../../../i18n/LanguageProvider";

function getTransactionOriginMeta(transaction, t) {
  switch (transaction.source) {
    case "import_ofx":
      return { label: t("transactions.importedOfx"), className: "finova-badge-primary" };
    case "import_csv":
      return { label: t("transactions.importedCsv"), className: "finova-badge-primary" };
    case "bank_sync":
      return { label: t("transactions.synced"), className: "finova-badge-income" };
    case "manual":
    default:
      return { label: t("transactions.manual"), className: "finova-badge-neutral" };
  }
}

function getInstallmentMeta(transaction) {
  const installmentCount = Number(transaction.installmentCount) || 0;
  const installmentIndex = Number(transaction.installmentIndex) || 0;

  if (installmentCount <= 1 || installmentIndex <= 0) {
    return null;
  }

  const remainingInstallments = Math.max(installmentCount - installmentIndex + 1, 0);
  const remainingAmountCents = remainingInstallments * (Number(transaction.amountCents) || 0);

  return {
    label: `${installmentIndex}/${installmentCount}`,
    remainingInstallments,
    remainingAmountCents,
  };
}

export default function TransactionsTable({
  transactions,
  totalTransactionsCount,
  onEdit,
  onRemove,
  onExportCsv,
  onExportPdf,
  highlightImportedSince = "",
  isLoading = false,
  isMutating = false,
}) {
  const { t, formatCurrencyFromCents, formatDate, formatDateTime } = useI18n();
  const summaryLabel =
    transactions.length === 1
      ? t("transactions.summarySingle")
      : t("transactions.summaryPlural", { count: transactions.length });

  if (isLoading) {
    return (
      <div className="finova-card p-4">
        <div className="finova-loading-state">
          <div className="spinner-border spinner-border-sm text-primary" />
          <p className="finova-subtitle mb-0">{t("transactions.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="finova-card p-4 finova-table-shell">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
        <div>
          <h2 className="finova-title h5 mb-1">{t("transactions.historyTitle")}</h2>
          <p className="finova-subtitle small mb-0">
            {transactions.length !== totalTransactionsCount
              ? t("transactions.summaryWithTotal", {
                  visible: transactions.length,
                  total: totalTransactionsCount,
                })
              : summaryLabel}
          </p>
        </div>

        <div className="finova-actions-row">
          <button
            type="button"
            className="btn finova-btn-light"
            onClick={onExportCsv}
            disabled={transactions.length === 0}
          >
            {t("transactions.exportCsv")}
          </button>

          <button
            type="button"
            className="btn finova-btn-light"
            onClick={onExportPdf}
            disabled={transactions.length === 0}
          >
            {t("transactions.exportPdf")}
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="finova-empty-state">
          <h3 className="finova-title h6 mb-2">{t("transactions.emptyTitle")}</h3>
          <p className="finova-subtitle mb-0">
            {totalTransactionsCount === 0
              ? t("transactions.emptyNoData")
              : t("transactions.emptyFiltered")}
          </p>
        </div>
      ) : (
        <div className="table-responsive finova-table-shell-responsive">
          <table className="table finova-table align-middle mb-0">
            <thead>
              <tr>
                <th>{t("common.date")}</th>
                <th>{t("common.description")}</th>
                <th>{t("common.category")}</th>
                <th>{t("common.type")}</th>
                <th className="text-end">{t("common.value")}</th>
                <th className="text-end">{t("common.actions")}</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction) => {
                const isRecentlyImported =
                  transaction.importedAtUtc &&
                  highlightImportedSince &&
                  new Date(transaction.importedAtUtc).getTime() >=
                    new Date(highlightImportedSince).getTime() - 10000;
                const originMeta = getTransactionOriginMeta(transaction, t);
                const installmentMeta = getInstallmentMeta(transaction);

                return (
                  <tr
                    key={transaction.id}
                    className={isRecentlyImported ? "finova-row-highlight" : undefined}
                  >
                    <td>{formatDate(transaction.date)}</td>

                    <td>
                      <div className="fw-medium text-dark">{transaction.description}</div>
                      <div className="mt-1 d-flex flex-wrap gap-2">
                        <span className={originMeta.className}>{originMeta.label}</span>
                        {transaction.isRecurring ? (
                          <span className="finova-badge-neutral">
                            {t("transactions.recurringMonthly")}
                          </span>
                        ) : null}
                        {installmentMeta ? (
                          <span className="finova-badge-warning">
                            {t("transactions.installmentBadge", {
                              index: installmentMeta.label,
                            })}
                          </span>
                        ) : null}
                        {(transaction.tagNames || []).map((tagName) => (
                          <span key={`${transaction.id}-${tagName}`} className="finova-badge-primary">
                            #{tagName}
                          </span>
                        ))}
                      </div>
                      {transaction.importedAtUtc ? (
                        <div className="small text-muted mt-2 finova-transaction-meta-line">
                          {t("transactions.importedAt", {
                            date: formatDateTime(transaction.importedAtUtc),
                          })}
                        </div>
                      ) : null}
                      {installmentMeta ? (
                        <div className="small text-muted mt-2 finova-transaction-meta-line">
                          {t("transactions.installmentRemaining", {
                            count: installmentMeta.remainingInstallments,
                            amount: formatCurrencyFromCents(installmentMeta.remainingAmountCents),
                          })}
                        </div>
                      ) : null}
                      <div className="small text-muted mt-2 finova-transaction-meta-line">
                        {t("transactions.accountLabel")}:{" "}
                        {transaction.financialAccountLabel || t("transactions.unlinkedAccount")}
                      </div>
                      {isRecentlyImported ? (
                        <div className="small mt-2">
                          <span className="finova-badge-warning">{t("transactions.newInImport")}</span>
                        </div>
                      ) : null}
                    </td>

                    <td>
                      <span className="finova-subtitle">
                        {transaction.category || t("transactions.noCategory")}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          transaction.type === "income"
                            ? "finova-badge-income"
                            : "finova-badge-expense"
                        }
                      >
                        {transaction.type === "income"
                          ? t("transactions.income")
                          : t("transactions.expense")}
                      </span>
                    </td>

                    <td className="text-end fw-semibold">
                      {formatCurrencyFromCents(transaction.amountCents)}
                    </td>

                    <td className="text-end">
                      <div className="finova-actions-row finova-actions-row-end">
                        <button
                          type="button"
                          className="btn finova-btn-light btn-sm"
                          onClick={() => onEdit(transaction)}
                          disabled={isMutating}
                        >
                          {t("transactions.edit")}
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onRemove(transaction.id)}
                          disabled={isMutating}
                        >
                          {t("transactions.remove")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
