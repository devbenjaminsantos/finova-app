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
    new Date(transaction.importedAtUtc).getTime() >= new Date(highlightImportedSince).getTime() - 10000;
  const originMeta = getTransactionOriginMeta(transaction, t);
  const installmentMeta = getInstallmentMeta(transaction);

  return (
    <tr className={isRecentlyImported ? "finova-row-highlight" : undefined}>
      <td>{formatDate(transaction.date)}</td>
      <td>
        <div className="fw-medium text-dark">{transaction.description}</div>
        <div className="mt-1 d-flex flex-wrap gap-2">
          <span className={originMeta.className}>{originMeta.label}</span>
          {transaction.isRecurring ? <span className="finova-badge-neutral">{t("transactions.recurringMonthly")}</span> : null}
          {installmentMeta ? <span className="finova-badge-warning">{t("transactions.installmentBadge", { index: installmentMeta.label })}</span> : null}
          {(transaction.tagNames || []).map((tagName) => <span key={`${transaction.id}-${tagName}`} className="finova-badge-primary">#{tagName}</span>)}
        </div>
        {transaction.importedAtUtc ? <div className="small text-muted mt-2 finova-transaction-meta-line">{t("transactions.importedAt", { date: formatDateTime(transaction.importedAtUtc) })}</div> : null}
        {installmentMeta ? (
          <div className="small text-muted mt-2 finova-transaction-meta-line">
            {t("transactions.installmentRemaining", { count: installmentMeta.remainingInstallments, amount: formatCurrencyFromCents(installmentMeta.remainingAmountCents) })}
          </div>
        ) : null}
        <div className="small text-muted mt-2 finova-transaction-meta-line">
          {t("transactions.accountLabel")}: {transaction.financialAccountLabel || t("transactions.unlinkedAccount")}
        </div>
        {isRecentlyImported ? <div className="small mt-2"><span className="finova-badge-warning">{t("transactions.newInImport")}</span></div> : null}
      </td>
      <td><span className="finova-subtitle">{transaction.category || t("transactions.noCategory")}</span></td>
      <td>
        <span className={transaction.type === "income" ? "finova-badge-income" : "finova-badge-expense"}>
          {transaction.type === "income" ? t("transactions.income") : t("transactions.expense")}
        </span>
      </td>
      <td className="text-end fw-semibold">{formatCurrencyFromCents(transaction.amountCents)}</td>
      <td className="text-end">
        <div className="finova-actions-row finova-actions-row-end">
          <Button type="button" variant="secondary" className="btn-sm" onClick={() => onEdit(transaction)} disabled={isMutating}>{t("transactions.edit")}</Button>
          <Button type="button" variant="danger" className="btn-sm" onClick={() => onRemove(transaction.id)} disabled={isMutating}>{t("transactions.remove")}</Button>
        </div>
      </td>
    </tr>
  );
}
