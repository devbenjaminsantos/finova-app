import { useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/layout/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import BudgetGoalsSection from "../features/dashboard/BudgetGoalsSection";
import TransactionCommitments from "../features/transactions/components/TransactionCommitments";
import {
  getInstallmentOverview,
  getRecurringOverview,
  sortInstallmentPlans,
  sortRecurringRules,
} from "../features/transactions/commitmentOverview";
import { useTransactions } from "../features/transactions/useTransactions";
import { useI18n } from "../i18n/LanguageProvider";

export default function Planning() {
  const { formatCurrencyFromCents, formatDate, t } = useI18n();
  const {
    installmentPlans = [],
    isLoading,
    recurringRules = [],
    transactions = [],
  } = useTransactions();
  const installmentGroups = useMemo(() => sortInstallmentPlans(installmentPlans), [installmentPlans]);
  const visibleRecurringRules = useMemo(() => sortRecurringRules(recurringRules), [recurringRules]);
  const installmentOverview = useMemo(
    () => getInstallmentOverview(installmentGroups),
    [installmentGroups]
  );
  const recurringOverview = useMemo(
    () => getRecurringOverview(visibleRecurringRules),
    [visibleRecurringRules]
  );
  const hasCommitments = installmentGroups.length > 0 || visibleRecurringRules.length > 0;

  return (
    <section className="finova-page-container">
      <PageHeader
        title={t("pages.planningTitle")}
        subtitle={t("pages.planningSubtitle")}
        meta={t("pages.planningPageNote")}
      />

      <div className="finova-card p-4 mb-4">
        <BudgetGoalsSection transactions={transactions} />
      </div>

      <section className="finova-card p-4" aria-labelledby="planning-commitments-title">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3 mb-4">
          <div>
            <h2 id="planning-commitments-title" className="finova-title h4 mb-1">
              {t("pages.planningCommitmentsTitle")}
            </h2>
            <p className="finova-subtitle mb-0">{t("pages.planningCommitmentsSubtitle")}</p>
          </div>
          <Link className="btn finova-btn-light" to="/transacoes">
            {t("pages.planningManageCommitments")}
          </Link>
        </div>

        {isLoading ? (
          <p className="finova-subtitle mb-0" role="status">
            {t("common.loading")}
          </p>
        ) : hasCommitments ? (
          <TransactionCommitments
            recurringRules={visibleRecurringRules}
            recurringOverview={recurringOverview}
            installmentGroups={installmentGroups}
            installmentOverview={installmentOverview}
            showInstallmentActions={false}
            isMutating={false}
            t={t}
            formatDate={formatDate}
            formatCurrencyFromCents={formatCurrencyFromCents}
          />
        ) : (
          <EmptyState
            className="finova-card-soft p-4"
            titleAs="h3"
            title={t("pages.planningCommitmentsEmptyTitle")}
            description={t("pages.planningCommitmentsEmptySubtitle")}
          />
        )}
      </section>
    </section>
  );
}
