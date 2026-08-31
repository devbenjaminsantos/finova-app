import Button from "../../../components/ui/Button";
import BudgetProgress from "../../../components/ui/BudgetProgress";
import Metric from "../../../components/ui/Metric";

function CommitmentDetail({ label, value }) {
  return (
    <div className="hestia-commitment-detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getInstallmentProgress(group) {
  const total = Math.max(Number(group.totalAmountCents) || 1, 1);
  return Math.round(((Number(group.paidAmountCents) || 0) / total) * 100);
}

function RecurringRulesSection({ formatCurrencyFromCents, formatDate, overview, rules, t }) {
  if (rules.length === 0) {
    return null;
  }

  return (
    <section className="hestia-commitment-section" aria-labelledby="recurring-rules-title">
      <div className="hestia-commitment-heading">
        <div>
          <h2 id="recurring-rules-title" className="hestia-title h5 mb-1">
            {t("transactions.recurringRulesTitle")}
          </h2>
          <p className="hestia-subtitle small mb-0">{t("transactions.recurringRulesSubtitle")}</p>
        </div>
      </div>

      <div className="hestia-commitment-metrics">
        <Metric
          label={t("transactions.recurringRulesActiveLabel")}
          value={overview.activeRules}
          helper={t("transactions.recurringRulesActiveHelp")}
        />
        <Metric
          label={t("transactions.recurringRulesNextAmountLabel")}
          value={formatCurrencyFromCents(overview.nextMonthAmountCents)}
          helper={t("transactions.recurringRulesNextAmountHelp")}
        />
      </div>

      <ul className="hestia-commitment-list list-unstyled mb-0" aria-label={t("transactions.recurringRulesTitle")}>
        {rules.map((rule) => (
          <li key={rule.id} className="hestia-commitment-item">
            <div className="hestia-commitment-item-main">
              <div className="hestia-commitment-item-copy">
                <strong className="hestia-transaction-list-description">{rule.description}</strong>
                <div className="hestia-transaction-list-badges">
                  <span className={rule.isActive ? "hestia-badge-income" : "hestia-badge-neutral"}>
                    {rule.isActive
                      ? t("transactions.recurringRuleActive")
                      : t("transactions.recurringRuleFinished")}
                  </span>
                  {(rule.tagNames || []).map((tagName) => (
                    <span key={`${rule.id}-${tagName}`} className="hestia-badge-primary">#{tagName}</span>
                  ))}
                </div>
              </div>
              <strong className={rule.type === "income" ? "hestia-transaction-amount-income" : "hestia-transaction-amount-expense"}>
                {formatCurrencyFromCents(rule.amountCents)}
              </strong>
            </div>

            <div className="hestia-commitment-details">
              <CommitmentDetail label={t("common.category")} value={rule.category} />
              <CommitmentDetail
                label={t("transactions.recurringRuleType")}
                value={rule.type === "income" ? t("transactions.income") : t("transactions.expense")}
              />
              <CommitmentDetail
                label={t("transactions.recurringRuleNext")}
                value={rule.nextOccurrenceDate ? formatDate(rule.nextOccurrenceDate) : t("transactions.recurringRuleNoNext")}
              />
              <CommitmentDetail label={t("transactions.recurringRuleEnd")} value={formatDate(rule.endDate)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InstallmentPlansSection({
  formatCurrencyFromCents,
  formatDate,
  groups,
  isMutating,
  onEdit,
  onRemove,
  overview,
  showActions,
  t,
}) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="hestia-commitment-section" aria-labelledby="installment-plans-title">
      <div className="hestia-commitment-heading">
        <div>
          <h2 id="installment-plans-title" className="hestia-title h5 mb-1">
            {t("transactions.installmentPlansTitle")}
          </h2>
          <p className="hestia-subtitle small mb-0">{t("transactions.installmentPlansSubtitle")}</p>
        </div>
      </div>

      <div className="hestia-commitment-metrics hestia-commitment-metrics-three">
        <Metric
          label={t("transactions.installmentOpenDebtLabel")}
          value={formatCurrencyFromCents(overview.remainingAmountCents)}
          helper={t("transactions.installmentOpenDebtHelp")}
          tone="warning"
        />
        <Metric
          label={t("transactions.installmentOpenPlansLabel")}
          value={overview.openPlans}
          helper={t("transactions.installmentOpenPlansHelp")}
        />
        <Metric
          label={t("transactions.installmentNextBillsLabel")}
          value={formatCurrencyFromCents(overview.nextInstallmentsAmountCents)}
          helper={t("transactions.installmentNextBillsHelp", { count: overview.upcomingInstallments })}
        />
      </div>

      <ul className="hestia-commitment-list list-unstyled mb-0" aria-label={t("transactions.installmentPlansTitle")}>
        {groups.map((group) => {
          const progress = getInstallmentProgress(group);

          return (
            <li key={group.id} className="hestia-commitment-item">
              <div className="hestia-commitment-item-main">
                <div className="hestia-commitment-item-copy">
                  <strong className="hestia-transaction-list-description">{group.description}</strong>
                  <div className="hestia-transaction-list-badges">
                    <span className="hestia-badge-warning">
                      {t("transactions.installmentBadge", {
                        index: `${group.postedInstallments}/${group.installmentCount}`,
                      })}
                    </span>
                    {(group.tagNames || []).map((tagName) => (
                      <span key={`${group.id}-${tagName}`} className="hestia-badge-primary">#{tagName}</span>
                    ))}
                  </div>
                </div>
                <strong className="hestia-transaction-amount-expense">
                  {formatCurrencyFromCents(group.remainingAmountCents)}
                </strong>
              </div>

              <div className="hestia-commitment-progress">
                <div className="d-flex align-items-center justify-content-between gap-3 small">
                  <span className="hestia-subtitle">{t("transactions.installmentProgress")}</span>
                  <strong>{progress}%</strong>
                </div>
                <BudgetProgress label={t("transactions.installmentProgress")} progress={progress} />
              </div>

              <div className="hestia-commitment-details">
                <CommitmentDetail label={t("common.category")} value={group.category} />
                <CommitmentDetail
                  label={t("transactions.installmentTotal")}
                  value={formatCurrencyFromCents(group.totalAmountCents)}
                />
                <CommitmentDetail
                  label={t("transactions.installmentPaid")}
                  value={formatCurrencyFromCents(group.paidAmountCents)}
                />
                <CommitmentDetail
                  label={t("transactions.installmentRemainingLabel")}
                  value={formatCurrencyFromCents(group.remainingAmountCents)}
                />
                <CommitmentDetail
                  label={t("transactions.installmentRemainingCount")}
                  value={t("transactions.installmentRemainingCountValue", { count: group.remainingInstallments })}
                />
                <CommitmentDetail
                  label={t("transactions.installmentUpcomingCount")}
                  value={t("transactions.installmentRemainingCountValue", { count: group.upcomingInstallments })}
                />
                <CommitmentDetail
                  label={t("transactions.installmentNextDue")}
                  value={
                    group.nextInstallmentDate
                      ? t("transactions.installmentNextDueValue", {
                          index: group.nextInstallmentIndex,
                          date: formatDate(group.nextInstallmentDate),
                        })
                      : t("transactions.installmentFullyPosted")
                  }
                />
              </div>

              {showActions ? (
                <div className="hestia-actions-row hestia-transaction-list-actions">
                  <Button variant="secondary" className="btn-sm" onClick={() => onEdit(group)} disabled={isMutating}>
                    {t("transactions.editInstallmentPlan")}
                  </Button>
                  <Button variant="danger" className="btn-sm" onClick={() => onRemove(group.id)} disabled={isMutating}>
                    {t("transactions.removeInstallmentPlan")}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function TransactionCommitments({
  formatCurrencyFromCents,
  formatDate,
  installmentGroups,
  installmentOverview,
  isMutating,
  onEditInstallment,
  onRemoveInstallment,
  recurringOverview,
  recurringRules,
  showInstallmentActions = true,
  t,
}) {
  if (recurringRules.length === 0 && installmentGroups.length === 0) {
    return null;
  }

  return (
    <div className="hestia-commitments mb-4">
      <RecurringRulesSection
        rules={recurringRules}
        overview={recurringOverview}
        t={t}
        formatDate={formatDate}
        formatCurrencyFromCents={formatCurrencyFromCents}
      />
      <InstallmentPlansSection
        groups={installmentGroups}
        overview={installmentOverview}
        isMutating={isMutating}
        onEdit={onEditInstallment}
        onRemove={onRemoveInstallment}
        t={t}
        formatDate={formatDate}
        formatCurrencyFromCents={formatCurrencyFromCents}
        showActions={showInstallmentActions}
      />
    </div>
  );
}
