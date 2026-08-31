import Button from "./Button";

function getTransactionOriginMeta(transaction, t) {
  switch (transaction.source) {
    case "import_ofx":
      return { label: t("transactions.importedOfx"), className: "hestia-badge-primary" };
    case "import_csv":
      return { label: t("transactions.importedCsv"), className: "hestia-badge-primary" };
    case "bank_sync":
      return { label: t("transactions.synced"), className: "hestia-badge-income" };
    default:
      return { label: t("transactions.manual"), className: "hestia-badge-neutral" };
  }
}

function getInstallmentMeta(transaction) {
  const installmentCount = Number(transaction.installmentCount) || 0;
  const installmentIndex = Number(transaction.installmentIndex) || 0;

  if (installmentCount <= 1 || installmentIndex <= 0) {
    return null;
  }

  const remainingInstallments = Math.max(installmentCount - installmentIndex + 1, 0);

  return {
    label: `${installmentIndex}/${installmentCount}`,
    remainingInstallments,
    remainingAmountCents: remainingInstallments * (Number(transaction.amountCents) || 0),
  };
}

export default function TransactionRow({
  formatCurrencyFromCents,
  formatDate,
  formatDateTime,
  highlightImportedSince = "",
  isMutating = false,
  onEdit,
  onRemove,
  t,
  transaction,
}) {
  const isRecentlyImported =
    transaction.importedAtUtc &&
    highlightImportedSince &&
    new Date(transaction.importedAtUtc).getTime() >=
      new Date(highlightImportedSince).getTime() - 10000;
  const originMeta = getTransactionOriginMeta(transaction, t);
  const installmentMeta = getInstallmentMeta(transaction);
  const isIncome = transaction.type === "income";

  return (
    <li className={`hestia-transaction-list-item${isRecentlyImported ? " hestia-row-highlight" : ""}`}>
      <div className="hestia-transaction-list-main">
        <div className="hestia-transaction-list-copy">
          <time className="hestia-transaction-list-date" dateTime={transaction.date}>
            {formatDate(transaction.date)}
          </time>
          <strong className="hestia-transaction-list-description">{transaction.description}</strong>
          <div className="hestia-transaction-list-badges">
            <span className={originMeta.className}>{originMeta.label}</span>
            {transaction.isRecurring ? (
              <span className="hestia-badge-neutral">{t("transactions.recurringMonthly")}</span>
            ) : null}
            {installmentMeta ? (
              <span className="hestia-badge-warning">
                {t("transactions.installmentBadge", { index: installmentMeta.label })}
              </span>
            ) : null}
            {(transaction.tagNames || []).map((tagName) => (
              <span key={`${transaction.id}-${tagName}`} className="hestia-badge-primary">#{tagName}</span>
            ))}
          </div>
        </div>

        <div className="hestia-transaction-list-value">
          <span className={isIncome ? "hestia-badge-income" : "hestia-badge-expense"}>
            {isIncome ? t("transactions.income") : t("transactions.expense")}
          </span>
          <strong className={isIncome ? "hestia-transaction-amount-income" : "hestia-transaction-amount-expense"}>
            {formatCurrencyFromCents(transaction.amountCents)}
          </strong>
        </div>
      </div>

      <div className="hestia-transaction-list-meta">
        <span>{t("common.category")}: {transaction.category || t("transactions.noCategory")}</span>
        <span>{t("transactions.accountLabel")}: {transaction.financialAccountLabel || t("transactions.unlinkedAccount")}</span>
        {transaction.importedAtUtc ? (
          <span>{t("transactions.importedAt", { date: formatDateTime(transaction.importedAtUtc) })}</span>
        ) : null}
        {installmentMeta ? (
          <span>
            {t("transactions.installmentRemaining", {
              count: installmentMeta.remainingInstallments,
              amount: formatCurrencyFromCents(installmentMeta.remainingAmountCents),
            })}
          </span>
        ) : null}
        {isRecentlyImported ? <span className="hestia-badge-warning">{t("transactions.newInImport")}</span> : null}
      </div>

      <div className="hestia-actions-row hestia-transaction-list-actions">
        <Button
          type="button"
          variant="secondary"
          className="btn-sm"
          onClick={() => onEdit(transaction)}
          disabled={isMutating}
        >
          {t("transactions.edit")}
        </Button>
        <Button
          type="button"
          variant="danger"
          className="btn-sm"
          onClick={() => onRemove(transaction.id)}
          disabled={isMutating}
        >
          {t("transactions.remove")}
        </Button>
      </div>
    </li>
  );
}
