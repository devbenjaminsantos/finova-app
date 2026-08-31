import { useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import DashboardCharts from "../features/dashboard/DashboardCharts";
import {
  CategoryInsightCard,
  ComparisonCard,
  InsightCard,
  SummaryCard,
} from "../features/dashboard/DashboardCards";
import {
  getComparisonRangeOptions,
  getAutomaticInsights,
  getCategoryLeaders,
  getForecastSnapshot,
  getMonthsForPeriod,
  lastNMonthsISO,
  getPrescriptiveInsights,
  getRelativeMonthsISO,
  getPeriodOptions,
  summarizeTransactions,
} from "../features/dashboard/dashboardAnalytics";
import { useTransactions } from "../features/transactions/useTransactions";
import {
  filterTransactionsByFinancialAccount,
  getFinancialAccountScopeLabel,
} from "../lib/financialAccounts/scope";
import { useFinancialAccountOptions } from "../lib/financialAccounts/useFinancialAccountOptions";
import { useI18n } from "../i18n/LanguageProvider";

function formatMonthLabel(month, locale) {
  const [year, monthNumber] = String(month || "").split("-").map(Number);

  if (!year || !monthNumber) {
    return month;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(new Date(year, monthNumber - 1, 1));
}

function AnalysisOverviewCard({ eyebrow, title, description, badgeClass = "hestia-badge-primary", badge }) {
  return (
    <div className="col-12 col-lg-4">
      <div className="hestia-card-soft p-3 h-100">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
          <div className="hestia-subtitle small">{eyebrow}</div>
          {badge ? <span className={badgeClass}>{badge}</span> : null}
        </div>
        <div className="hestia-title h6 mb-2">{title}</div>
        <p className="hestia-subtitle mb-0">{description}</p>
      </div>
    </div>
  );
}

function AnalysisSectionHeader({ eyebrow, title, description }) {
  return (
    <div className="mb-3">
      <div className="hestia-subtitle small text-uppercase mb-1">{eyebrow}</div>
      <h2 className="hestia-title h5 mb-1">{title}</h2>
      <p className="hestia-subtitle mb-0">{description}</p>
    </div>
  );
}

export default function Analyses() {
  const { locale, t, formatCurrencyFromCents } = useI18n();
  const { isLoading, transactions } = useTransactions();
  const [period, setPeriod] = useState("current-month");
  const [comparisonRange, setComparisonRange] = useState(3);
  const [accountFilter, setAccountFilter] = useState("all");
  const accounts = useFinancialAccountOptions();
  const periodOptions = useMemo(() => getPeriodOptions(t), [t]);
  const comparisonRangeOptions = useMemo(() => getComparisonRangeOptions(t), [t]);

  const scopedTransactions = useMemo(
    () => filterTransactionsByFinancialAccount(transactions, accountFilter),
    [transactions, accountFilter]
  );

  const filteredTransactions = useMemo(() => {
    if (period === "all") {
      return scopedTransactions;
    }

    const allowedMonths = new Set(getMonthsForPeriod(period));
    return scopedTransactions.filter((transaction) =>
      allowedMonths.has((transaction.date || "").slice(0, 7))
    );
  }, [scopedTransactions, period]);

  const selectedAccountLabel = useMemo(
    () => getFinancialAccountScopeLabel(accountFilter, accounts),
    [accountFilter, accounts]
  );

  const selectedComparisonRangeLabel = useMemo(
    () =>
      comparisonRangeOptions.find((option) => option.value === comparisonRange)?.label ??
      t("analyses.defaultComparisonRange"),
    [comparisonRange, comparisonRangeOptions, t]
  );

  const selectedPeriodLabel = useMemo(
    () => periodOptions.find((option) => option.value === period)?.label ?? t("dashboard.focusMonth"),
    [period, periodOptions, t]
  );

  const summary = useMemo(() => summarizeTransactions(filteredTransactions), [filteredTransactions]);

  const chartMonths = useMemo(
    () => (period === "all" ? lastNMonthsISO(6) : getMonthsForPeriod(period)),
    [period]
  );

  const automaticInsights = useMemo(
    () => getAutomaticInsights(filteredTransactions, t),
    [filteredTransactions, t]
  );

  const prescriptiveInsights = useMemo(
    () => getPrescriptiveInsights(filteredTransactions, t),
    [filteredTransactions, t]
  );

  const comparison = useMemo(() => {
    const currentMonths = getRelativeMonthsISO(0, comparisonRange);
    const previousMonths = getRelativeMonthsISO(comparisonRange, comparisonRange);
    const currentSet = new Set(currentMonths);
    const previousSet = new Set(previousMonths);

    const currentTransactions = scopedTransactions.filter((transaction) =>
      currentSet.has((transaction.date || "").slice(0, 7))
    );
    const previousTransactions = scopedTransactions.filter((transaction) =>
      previousSet.has((transaction.date || "").slice(0, 7))
    );

    return {
      currentRangeLabel: selectedComparisonRangeLabel,
      previousRangeLabel: t("analyses.previousRangeLabel", {
        range: selectedComparisonRangeLabel,
      }),
      current: summarizeTransactions(currentTransactions),
      previous: summarizeTransactions(previousTransactions),
      categoryLeaders: getCategoryLeaders(currentTransactions, previousTransactions, t),
    };
  }, [scopedTransactions, comparisonRange, selectedComparisonRangeLabel, t]);

  const forecast = useMemo(
    () =>
      getForecastSnapshot(scopedTransactions, {
        historyMonths: Math.max(3, comparisonRange),
        horizon: 3,
        t,
      }),
    [scopedTransactions, comparisonRange, t]
  );

  const totalInsightCount = automaticInsights.length + prescriptiveInsights.length;
  const highlightBadgeClass =
    summary.balance < 0
      ? "hestia-badge-expense"
      : totalInsightCount > 0
        ? "hestia-badge-primary"
        : "hestia-badge-income";
  const highlightBadgeLabel =
    summary.balance < 0
      ? t("analyses.highlightAlert")
      : totalInsightCount > 0
        ? t("analyses.highlightSignals", { count: totalInsightCount })
        : t("analyses.highlightStable");

  const confidenceBadgeClass =
    forecast.confidence.tone === "income"
      ? "hestia-badge-income"
      : forecast.confidence.tone === "primary"
        ? "hestia-badge-primary"
        : "hestia-badge-neutral";

  return (
    <section className="hestia-section-space">
      <PageHeader
        title={t("pages.analysesTitle")}
        subtitle={t("pages.analysesSubtitle")}
        meta={selectedAccountLabel}
        aside={
          <div className="d-grid gap-2">
            <div>
              <label className="form-label text-dark fw-medium" htmlFor="analyses-period">
                {t("pages.analysesPeriod")}
              </label>
              <select
                id="analyses-period"
                className="form-select hestia-select"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label text-dark fw-medium" htmlFor="analyses-range">
                {t("pages.analysesRange")}
              </label>
              <select
                id="analyses-range"
                className="form-select hestia-select"
                value={comparisonRange}
                onChange={(event) => setComparisonRange(Number(event.target.value))}
              >
                {comparisonRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label text-dark fw-medium" htmlFor="analyses-account">
                {t("pages.displayedAccountLabel")}
              </label>
              <select
                id="analyses-account"
                className="form-select hestia-select"
                value={accountFilter}
                onChange={(event) => setAccountFilter(event.target.value)}
              >
                <option value="all">{t("pages.allAccountsScope")}</option>
                <option value="unassigned">{t("pages.unassignedScope")}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>
                    {account.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      />

      <div className="hestia-page-note mb-4">
        {t("pages.analysesPageNote")}
      </div>

      <div className="hestia-card p-4 mb-4">
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <div className="hestia-card-soft p-3 h-100">
              <div className="hestia-subtitle small mb-1">{t("analyses.overviewCurrentEyebrow")}</div>
              <div className="hestia-title h6 mb-2">{t("analyses.overviewCurrentTitle")}</div>
              <p className="hestia-subtitle mb-0">{t("analyses.overviewCurrentDescription")}</p>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="hestia-card-soft p-3 h-100">
              <div className="hestia-subtitle small mb-1">{t("analyses.overviewSelectedEyebrow")}</div>
              <div className="hestia-title h6 mb-2">{selectedPeriodLabel}</div>
              <p className="hestia-subtitle mb-0">{t("analyses.overviewSelectedDescription")}</p>
            </div>
          </div>
          <div className="col-12 col-lg-4">
            <div className="hestia-card-soft p-3 h-100">
              <div className="hestia-subtitle small mb-1">{t("analyses.overviewWindowEyebrow")}</div>
              <div className="hestia-title h6 mb-2">{selectedComparisonRangeLabel}</div>
              <p className="hestia-subtitle mb-0">{t("analyses.overviewWindowDescription")}</p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="hestia-card p-4">
          <p className="hestia-subtitle mb-0">{t("analyses.loading")}</p>
        </div>
      ) : (
        <>
          <div className="row g-3 mb-4">
            <AnalysisOverviewCard
              eyebrow={t("analyses.summaryNowEyebrow")}
              title={selectedPeriodLabel}
              description={t(
                filteredTransactions.length === 1
                  ? "analyses.summaryNowDescriptionSingle"
                  : "analyses.summaryNowDescriptionPlural",
                {
                  count: filteredTransactions.length,
                }
              )}
              badgeClass={highlightBadgeClass}
              badge={highlightBadgeLabel}
            />
            <AnalysisOverviewCard
              eyebrow={t("analyses.summaryComparisonEyebrow")}
              title={selectedComparisonRangeLabel}
              description={t("analyses.summaryComparisonDescription", {
                range: selectedComparisonRangeLabel.toLowerCase(),
              })}
              badgeClass="hestia-badge-neutral"
              badge={t("analyses.summaryComparisonBadge")}
            />
            <AnalysisOverviewCard
              eyebrow={t("analyses.summaryProjectionEyebrow")}
              title={
                forecast.hasEnoughData
                  ? t("analyses.summaryProjectionTitleReady", {
                      confidence: forecast.confidence.label.toLowerCase(),
                    })
                  : t("analyses.summaryProjectionTitleEmpty")
              }
              description={
                forecast.hasEnoughData
                  ? t("analyses.summaryProjectionDescriptionReady")
                  : t("analyses.summaryProjectionDescriptionEmpty")
              }
              badgeClass={confidenceBadgeClass}
              badge={
                forecast.hasEnoughData
                  ? forecast.confidence.label
                  : t("analyses.summaryProjectionBadgeEmpty")
              }
            />
          </div>

          <div className="hestia-card p-4 mb-4">
            <AnalysisSectionHeader
              eyebrow={t("analyses.insightsEyebrow")}
              title={t("analyses.insightsTitle")}
              description={t("analyses.insightsDescription")}
            />

            <div className="row g-3 mb-4">
              <SummaryCard
                label={t("transactions.incomePlural")}
                value={formatCurrencyFromCents(summary.income)}
                tone="income"
              />
              <SummaryCard
                label={t("transactions.expensePlural")}
                value={formatCurrencyFromCents(summary.expense)}
                tone="expense"
              />
              <SummaryCard
                label={t("publicDashboard.balanceLabel")}
                value={formatCurrencyFromCents(summary.balance)}
                tone="default"
              />
            </div>

            {automaticInsights.length === 0 && prescriptiveInsights.length === 0 ? (
              <div className="text-center py-4">
                <h3 className="hestia-title h6 mb-2">{t("analyses.insightsEmptyTitle")}</h3>
                <p className="hestia-subtitle mb-0">{t("analyses.insightsEmptyDescription")}</p>
              </div>
            ) : (
              <div className="row g-3">
                {automaticInsights.map((insight) => (
                  <InsightCard
                    key={insight.key}
                    title={insight.title}
                    description={insight.description}
                    badge={insight.badge}
                    tone={insight.tone}
                  />
                ))}

                {prescriptiveInsights.map((insight) => (
                  <InsightCard
                    key={insight.key}
                    title={insight.title}
                    description={insight.description}
                    badge={insight.badge}
                    tone={insight.tone}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="hestia-card p-4 mb-4">
            <AnalysisSectionHeader
              eyebrow={t("analyses.chartsEyebrow")}
              title={t("analyses.chartsTitle")}
              description={t("analyses.chartsDescription", {
                period: selectedPeriodLabel.toLowerCase(),
              })}
            />

            <DashboardCharts
              transactions={filteredTransactions}
              chartMonths={chartMonths}
              periodLabel={selectedPeriodLabel}
            />
          </div>

          <div className="hestia-card p-4 mb-4">
            <AnalysisSectionHeader
              eyebrow={t("analyses.comparisonsEyebrow")}
              title={t("analyses.comparisonsTitle")}
              description={t("analyses.comparisonsDescription")}
            />

            <div className="row g-3 mb-3">
              <ComparisonCard
                label={t("analyses.comparisonsIncomeLabel")}
                currentValue={comparison.current.income}
                previousValue={comparison.previous.income}
                currentRangeLabel={comparison.currentRangeLabel}
                previousRangeLabel={comparison.previousRangeLabel}
              />
              <ComparisonCard
                label={t("analyses.comparisonsExpenseLabel")}
                currentValue={comparison.current.expense}
                previousValue={comparison.previous.expense}
                currentRangeLabel={comparison.currentRangeLabel}
                previousRangeLabel={comparison.previousRangeLabel}
              />
              <ComparisonCard
                label={t("analyses.comparisonsBalanceLabel")}
                currentValue={comparison.current.balance}
                previousValue={comparison.previous.balance}
                currentRangeLabel={comparison.currentRangeLabel}
                previousRangeLabel={comparison.previousRangeLabel}
              />
            </div>

            <div className="row g-3 mb-4">
              <CategoryInsightCard
                title={t("analyses.comparisonsHeaviestCategory")}
                category={comparison.categoryLeaders.biggestIncrease.category}
                value={comparison.categoryLeaders.biggestIncrease.value}
                tone="up"
              />
              <CategoryInsightCard
                title={t("analyses.comparisonsLightestCategory")}
                category={comparison.categoryLeaders.biggestDrop.category}
                value={comparison.categoryLeaders.biggestDrop.value}
                tone="down"
              />
            </div>

            <div className="pt-4 border-top">
              <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
                <div>
                  <h3 className="hestia-title h5 mb-1">{t("pages.comparisonsForecastTitle")}</h3>
                  <p className="hestia-subtitle mb-0">
                    {t("pages.comparisonsForecastSubtitle", {
                      months: forecast.historyMonths || Math.max(3, comparisonRange),
                    })}
                  </p>
                </div>
                <div className="d-flex align-items-start">
                  <span className={confidenceBadgeClass}>
                    {t("pages.comparisonsForecastConfidence")} {forecast.confidence.label}
                  </span>
                </div>
              </div>

              {forecast.hasEnoughData ? (
                <>
                  <div className="row g-3 mb-3">
                    {forecast.forecast.map((item) => (
                      <div className="col-12 col-lg-4" key={item.month}>
                        <div className="hestia-card-soft h-100 p-4">
                          <div className="hestia-subtitle small mb-1">
                            {t("pages.comparisonsForecastMonth")}
                          </div>
                          <div className="hestia-title h5 mb-3">
                            {formatMonthLabel(item.month, locale)}
                          </div>

                          <div className="d-grid gap-2 small">
                            <div className="d-flex justify-content-between gap-3">
                              <span className="hestia-subtitle">
                                {t("pages.comparisonsForecastIncome")}
                              </span>
                              <span className="fw-semibold">
                                {formatCurrencyFromCents(item.income)}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between gap-3">
                              <span className="hestia-subtitle">
                                {t("pages.comparisonsForecastExpense")}
                              </span>
                              <span className="fw-semibold">
                                {formatCurrencyFromCents(item.expense)}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between gap-3">
                              <span className="hestia-subtitle">
                                {t("pages.comparisonsForecastBalance")}
                              </span>
                              <span className="fw-semibold">
                                {formatCurrencyFromCents(item.balance)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hestia-card-soft p-3">
                    <div className="row g-3">
                      <div className="col-12 col-lg-4">
                        <div className="hestia-subtitle small mb-1">
                          {t("pages.comparisonsForecastAverageIncome")}
                        </div>
                        <div className="hestia-title h6 mb-0">
                          {formatCurrencyFromCents(forecast.averageIncome)}
                        </div>
                      </div>
                      <div className="col-12 col-lg-4">
                        <div className="hestia-subtitle small mb-1">
                          {t("pages.comparisonsForecastAverageExpense")}
                        </div>
                        <div className="hestia-title h6 mb-0">
                          {formatCurrencyFromCents(forecast.averageExpense)}
                        </div>
                      </div>
                      <div className="col-12 col-lg-4">
                        <div className="hestia-subtitle small mb-1">
                          {t("pages.comparisonsForecastAverageBalance")}
                        </div>
                        <div className="hestia-title h6 mb-0">
                          {formatCurrencyFromCents(forecast.averageBalance)}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="hestia-card-soft p-4">
                  <p className="hestia-subtitle mb-0">
                    {t("pages.comparisonsForecastEmpty")}
                  </p>
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </section>
  );
}
