import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import TransactionRow from "../../../components/ui/TransactionRow";
import { useI18n } from "../../../i18n/LanguageProvider";

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
              ? t("transactions.summaryWithTotal", { visible: transactions.length, total: totalTransactionsCount })
              : summaryLabel}
          </p>
        </div>
        <div className="finova-actions-row">
          <Button type="button" variant="secondary" onClick={onExportCsv} disabled={transactions.length === 0}>{t("transactions.exportCsv")}</Button>
          <Button type="button" variant="secondary" onClick={onExportPdf} disabled={transactions.length === 0}>{t("transactions.exportPdf")}</Button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          titleAs="h3"
          title={t("transactions.emptyTitle")}
          description={totalTransactionsCount === 0 ? t("transactions.emptyNoData") : t("transactions.emptyFiltered")}
        />
      ) : (
        <ul className="finova-transaction-list list-unstyled mb-0" aria-label={t("transactions.historyTitle")}>
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              highlightImportedSince={highlightImportedSince}
              isMutating={isMutating}
              onEdit={onEdit}
              onRemove={onRemove}
              t={t}
              formatCurrencyFromCents={formatCurrencyFromCents}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
