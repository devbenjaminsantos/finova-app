import Button from "./Button";

function getTransactionOriginMeta(transaction, t) {
  switch (transaction.source) {
    case "import_ofx":
      return { label: t("transactions.importedOfx"), className: "finova-badge-primary" };
    case "import_csv":
      return { label: t("transactions.importedCsv"), className: "finova-badge-primary" };
    case "bank_sync":
      return { label: t("transactions.synced"), className: "finova-badge-income" };
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
    <li className={`finova-transaction-list-item${isRecentlyImported ? " finova-row-highlight" : ""}`}>
      <div className="finova-transaction-list-main">
        <div className="finova-transaction-list-copy">
          <time className="finova-transaction-list-date" dateTime={transaction.date}>
            {formatDate(transaction.date)}
          </time>
          <strong className="finova-transaction-list-description">{transaction.description}</strong>
          <div className="finova-transaction-list-badges">
            <span className={originMeta.className}>{originMeta.label}</span>
            {transaction.isRecurring ? (
              <span className="finova-badge-neutral">{t("transactions.recurringMonthly")}</span>
            ) : null}
            {installmentMeta ? (
              <span className="finova-badge-warning">
                {t("transactions.installmentBadge", { index: installmentMeta.label })}
              </span>
            ) : null}
            {(transaction.tagNames || []).map((tagName) => (
              <span key={`${transaction.id}-${tagName}`} className="finova-badge-primary">#{tagName}</span>
            ))}
          </div>
        </div>

        <div className="finova-transaction-list-value">
          <span className={isIncome ? "finova-badge-income" : "finova-badge-expense"}>
            {isIncome ? t("transactions.income") : t("transactions.expense")}
          </span>
          <strong className={isIncome ? "finova-transaction-amount-income" : "finova-transaction-amount-expense"}>
            {formatCurrencyFromCents(transaction.amountCents)}
          </strong>
        </div>
      </div>

      <div className="finova-transaction-list-meta">
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
        {isRecentlyImported ? <span className="finova-badge-warning">{t("transactions.newInImport")}</span> : null}
      </div>

      <div className="finova-actions-row finova-transaction-list-actions">
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
