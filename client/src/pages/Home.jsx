import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import HomeCustomizationCard from "../components/HomeCustomizationCard";
import PageHeader from "../components/layout/PageHeader";
import {
  CategoryInsightCard,
  ComparisonCard,
  InsightCard,
  SummaryCard,
} from "../features/dashboard/DashboardCards";
import {
  getComparisonRangeOptions,
  currentMonthISO,
  getAutomaticInsights,
  getCategoryLeaders,
  getMonthsForPeriod,
  getPrescriptiveInsights,
  getRelativeMonthsISO,
  getPeriodOptions,
  summarizeTransactions,
} from "../features/dashboard/dashboardAnalytics";
import {
  formatActionLabel,
  formatAuditDate,
  getActionToneClass,
  VISIBLE_AUDIT_ACTIONS,
} from "../features/history/auditLogPresentation";
import { useTransactions } from "../features/transactions/useTransactions";
import {
  getStoredUser,
  updateOnboardingPreferenceRequest,
} from "../lib/api/auth";
import { getAuditLogs } from "../lib/api/auditLogs";
import { getBudgetGoals } from "../lib/api/budgetGoals";
import {
  filterTransactionsByFinancialAccount,
  getFinancialAccountScopeLabel,
} from "../lib/financialAccounts/scope";
import { useFinancialAccountOptions } from "../lib/financialAccounts/useFinancialAccountOptions";
import { formatBRLFromCents } from "../lib/format/currency";
import {
  DEFAULT_HOME_WIDGETS,
  loadHomeWidgets,
  saveHomeWidgets,
} from "../lib/home/homePreferences";
import { useI18n } from "../i18n/LanguageProvider";

function DemoInfoCard() {
  const { t } = useI18n();

  return (
    <div className="finova-card p-4 finova-demo-panel">
      <h2 className="finova-title h5 mb-2">{t("home.demoTitle")}</h2>
      <p className="finova-subtitle mb-0">{t("home.demoDescription")}</p>
    </div>
  );
}

function OnboardingPromptCard({ isSaving, onChoose }) {
  const { t } = useI18n();

  return (
    <div className="finova-card p-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
        <div>
          <h2 className="finova-title h5 mb-2">{t("home.onboardingPromptTitle")}</h2>
          <p className="finova-subtitle mb-0">{t("home.onboardingPromptDescription")}</p>
        </div>

        <div className="finova-actions-row">
          <button
            type="button"
            className="btn finova-btn-primary"
            disabled={isSaving}
            onClick={() => onChoose(true)}
          >
            {isSaving ? t("common.loading") : t("home.onboardingPromptAccept")}
          </button>
          <button
            type="button"
            className="btn finova-btn-light"
            disabled={isSaving}
            onClick={() => onChoose(false)}
          >
            {t("home.onboardingPromptDecline")}
          </button>
        </div>
      </div>
    </div>
  );
}

function OnboardingChecklistCard({
  transactionsCount,
  recurringCount,
  goalsCount,
  isSaving,
  onHide,
  onShowAgain,
  isVisible,
  isCompleted,
}) {
  const { t } = useI18n();
  const items = [
    {
      key: "transactions",
      label: t("home.onboardingTransactionsLabel"),
      description: t("home.onboardingTransactionsDescription"),
      done: transactionsCount > 0,
    },
    {
      key: "goals",
      label: t("home.onboardingGoalsLabel"),
      description: t("home.onboardingGoalsDescription"),
      done: goalsCount > 0,
    },
    {
      key: "recurring",
      label: t("home.onboardingRecurringLabel"),
      description: t("home.onboardingRecurringDescription"),
      done: recurringCount > 0,
    },
  ];

  const completedCount = items.filter((item) => item.done).length;

  if (!isVisible && isCompleted) {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="finova-card p-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <h2 className="finova-title h6 mb-1">{t("home.onboardingHiddenTitle")}</h2>
            <p className="finova-subtitle mb-0">{t("home.onboardingHiddenDescription")}</p>
          </div>

          <button
            type="button"
            className="btn finova-btn-light"
            disabled={isSaving}
            onClick={onShowAgain}
          >
            {isSaving ? t("common.loading") : t("home.onboardingShowAgain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="finova-card p-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
        <div>
          <h2 className="finova-title h5 mb-2">{t("home.onboardingTitle")}</h2>
          <p className="finova-subtitle mb-0">
            {completedCount === items.length
              ? t("home.onboardingCompletedDescription")
              : t("home.onboardingDescription")}
          </p>
        </div>

        <div className="finova-actions-row">
          <span className="finova-badge-primary">
            {t("home.onboardingProgress", {
              current: completedCount,
              total: items.length,
            })}
          </span>
          <button
            type="button"
            className="btn finova-btn-light"
            disabled={isSaving}
            onClick={onHide}
          >
            {t("home.onboardingHide")}
          </button>
        </div>
      </div>

      <div className="row g-3">
        {items.map((item) => (
          <div className="col-12 col-lg-4" key={item.key}>
            <div className="finova-card-soft h-100 p-3">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                <h3 className="finova-title h6 mb-0">{item.label}</h3>
                <span className={item.done ? "finova-badge-income" : "finova-badge-neutral"}>
                  {item.done ? t("home.onboardingDone") : t("home.onboardingPending")}
                </span>
              </div>
              <p className="finova-subtitle small mb-0">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeWidgetCard({ title, description, children }) {
  return (
    <div className="finova-card p-4 h-100">
      <div className="mb-3">
        <h2 className="finova-title h5 mb-1">{title}</h2>
        {description ? <p className="finova-subtitle mb-0">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ShortcutTile({ title, description, to }) {
  return (
    <div className="col-12 col-md-6 col-xl-3">
      <Link to={to} className="finova-home-shortcut text-decoration-none">
        <div className="finova-card-soft h-100 p-3">
          <div className="finova-title h6 mb-2">{title}</div>
          <p className="finova-subtitle mb-0">{description}</p>
        </div>
      </Link>
    </div>
  );
}

function GoalsPreview({ goalsCount, goalsRiskCount }) {
  const { t } = useI18n();

  return (
    <HomeWidgetCard
      title={t("home.goalsTitle")}
      description={t("home.goalsDescription")}
    >
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-6">
          <div className="finova-card-soft p-3 h-100">
            <div className="finova-subtitle small mb-1">{t("home.goalsConfiguredLabel")}</div>
            <div className="finova-title h4 mb-1">{goalsCount}</div>
            <div className="finova-subtitle small mb-0">{t("home.goalsConfiguredHelp")}</div>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div className="finova-card-soft p-3 h-100">
            <div className="finova-subtitle small mb-1">{t("home.goalsRiskLabel")}</div>
            <div className="finova-title h4 mb-1">{goalsRiskCount}</div>
            <div className="finova-subtitle small mb-0">{t("home.goalsRiskHelp")}</div>
          </div>
        </div>
      </div>

      <Link to="/analises" className="btn finova-btn-light">
        {t("home.openAnalyses")}
      </Link>
    </HomeWidgetCard>
  );
}

function HistoryPreview({ logs, isLoading }) {
  const { t, formatDateTime } = useI18n();

  return (
    <HomeWidgetCard
      title={t("home.historyTitle")}
      description={t("home.historyDescription")}
    >
      {isLoading ? (
        <p className="finova-subtitle mb-0">{t("history.loading")}</p>
      ) : logs.length === 0 ? (
        <p className="finova-subtitle mb-0">{t("home.historyEmpty")}</p>
      ) : (
        <div className="d-grid gap-2">
          {logs.map((log) => (
            <div key={log.id} className="finova-card-soft p-3">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                <span className={getActionToneClass(log.action)}>
                  {formatActionLabel(log.action, t)}
                </span>
                <span className="finova-subtitle small">
                  {formatAuditDate(log.createdAtUtc, formatDateTime)}
                </span>
              </div>
              <div className="fw-medium small">{log.summary}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Link to="/historico" className="btn finova-btn-light">
          {t("home.openHistory")}
        </Link>
      </div>
    </HomeWidgetCard>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { isLoading, transactions } = useTransactions();
  const accounts = useFinancialAccountOptions();
  const [user, setUser] = useState(() => getStoredUser());
  const [period, setPeriod] = useState("current-month");
  const [accountFilter, setAccountFilter] = useState("all");
  const [widgets, setWidgets] = useState(() => loadHomeWidgets(getStoredUser()));
  const [isApplyingOnboarding, setIsApplyingOnboarding] = useState(false);
  const [goals, setGoals] = useState([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const periodOptions = useMemo(() => getPeriodOptions(t), [t]);
  const comparisonRangeOptions = useMemo(() => getComparisonRangeOptions(t), [t]);

  useEffect(() => {
    function handleSessionChange() {
      const nextUser = getStoredUser();
      setUser(nextUser);
      setWidgets(loadHomeWidgets(nextUser));
      setIsLoadingGoals(true);
      setIsLoadingHistory(true);
    }

    function handleBudgetGoalsChange() {
      setIsLoadingGoals(true);
    }

    window.addEventListener("finova-session-change", handleSessionChange);
    window.addEventListener("finova-budget-goals-change", handleBudgetGoalsChange);

    return () => {
      window.removeEventListener("finova-session-change", handleSessionChange);
      window.removeEventListener("finova-budget-goals-change", handleBudgetGoalsChange);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadGoals() {
      if (!user || user.isDemo) {
        if (active) {
          setGoals([]);
          setIsLoadingGoals(false);
        }
        return;
      }

      try {
        const data = await getBudgetGoals(currentMonthISO());
        if (active) {
          setGoals(Array.isArray(data) ? data : []);
        }
      } catch {
        if (active) {
          setGoals([]);
        }
      } finally {
        if (active) {
          setIsLoadingGoals(false);
        }
      }
    }

    loadGoals();

    return () => {
      active = false;
    };
  }, [user, isLoadingGoals]);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      if (!user) {
        if (active) {
          setHistoryLogs([]);
          setIsLoadingHistory(false);
        }
        return;
      }

      try {
        const data = await getAuditLogs(10);
        if (active) {
          const visible = (Array.isArray(data) ? data : [])
            .filter((log) => VISIBLE_AUDIT_ACTIONS.has(log.action))
            .slice(0, 4);
          setHistoryLogs(visible);
        }
      } catch {
        if (active) {
          setHistoryLogs([]);
        }
      } finally {
        if (active) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [user]);

  const filteredTransactions = useMemo(() => {
    const scopedTransactions = filterTransactionsByFinancialAccount(transactions, accountFilter);

    if (period === "all") {
      return scopedTransactions;
    }

    const allowedMonths = new Set(getMonthsForPeriod(period));
    return scopedTransactions.filter((transaction) =>
      allowedMonths.has((transaction.date || "").slice(0, 7))
    );
  }, [transactions, period, accountFilter]);

  const scopedTransactions = useMemo(
    () => filterTransactionsByFinancialAccount(transactions, accountFilter),
    [transactions, accountFilter]
  );

  const summary = useMemo(() => summarizeTransactions(filteredTransactions), [filteredTransactions]);

  const recurringTransactionsCount = useMemo(
    () => scopedTransactions.filter((transaction) => transaction.isRecurring).length,
    [scopedTransactions]
  );

  const goalsCount = goals.length;

  const goalsRiskCount = useMemo(() => {
    const currentMonthTransactions = transactions.filter(
      (transaction) =>
        transaction.type === "expense" &&
        (transaction.date || "").slice(0, 7) === currentMonthISO()
    );
    const scopedCurrentMonthTransactions = filterTransactionsByFinancialAccount(
      currentMonthTransactions,
      accountFilter
    );

    return goals.filter((goal) => {
      const spent = scopedCurrentMonthTransactions
        .filter((transaction) =>
          goal.category ? transaction.category === goal.category : true
        )
        .reduce((sum, transaction) => sum + (Number(transaction.amountCents) || 0), 0);

      return spent >= goal.amountCents;
    }).length;
  }, [goals, transactions, accountFilter]);

  const onboardingCompleted = useMemo(
    () => scopedTransactions.length > 0 && recurringTransactionsCount > 0 && goalsCount > 0,
    [scopedTransactions.length, recurringTransactionsCount, goalsCount]
  );

  const selectedAccountLabel = useMemo(
    () => getFinancialAccountScopeLabel(accountFilter, accounts),
    [accountFilter, accounts]
  );

  const comparison = useMemo(() => {
    const range = comparisonRangeOptions[0].value;
    const currentMonths = getRelativeMonthsISO(0, range);
    const previousMonths = getRelativeMonthsISO(range, range);
    const currentSet = new Set(currentMonths);
    const previousSet = new Set(previousMonths);

    const currentTransactions = scopedTransactions.filter((transaction) =>
      currentSet.has((transaction.date || "").slice(0, 7))
    );
    const previousTransactions = scopedTransactions.filter((transaction) =>
      previousSet.has((transaction.date || "").slice(0, 7))
    );

    return {
      current: summarizeTransactions(currentTransactions),
      previous: summarizeTransactions(previousTransactions),
      categoryLeaders: getCategoryLeaders(currentTransactions, previousTransactions, t),
      currentRangeLabel:
        periodOptions.find((option) => option.value === "current-month")?.label ?? t("dashboard.focusMonth"),
      previousRangeLabel: t("dashboard.previousMonth"),
    };
  }, [comparisonRangeOptions, periodOptions, scopedTransactions, t]);

  const selectedPeriodLabel = useMemo(
    () => periodOptions.find((option) => option.value === period)?.label ?? t("dashboard.focusMonth"),
    [period, periodOptions, t]
  );

  const automaticInsights = useMemo(
    () => getAutomaticInsights(filteredTransactions, t).slice(0, 2),
    [filteredTransactions, t]
  );

  const prescriptiveInsights = useMemo(
    () => getPrescriptiveInsights(filteredTransactions, t).slice(0, 1),
    [filteredTransactions, t]
  );

  async function handleOnboardingChoice(onboardingOptIn) {
    setIsApplyingOnboarding(true);

    try {
      const updatedUser = await updateOnboardingPreferenceRequest(onboardingOptIn);
      setUser(updatedUser);
    } finally {
      setIsApplyingOnboarding(false);
    }
  }

  useEffect(() => {
    if (!user || user.isDemo || user.onboardingOptIn !== true || !onboardingCompleted) {
      return;
    }

    let active = true;

    async function autoCompleteOnboarding() {
      setIsApplyingOnboarding(true);

      try {
        const updatedUser = await updateOnboardingPreferenceRequest(false);

        if (active) {
          setUser(updatedUser);
        }
      } finally {
        if (active) {
          setIsApplyingOnboarding(false);
        }
      }
    }

    autoCompleteOnboarding();

    return () => {
      active = false;
    };
  }, [user, onboardingCompleted]);

  function handleResetWidgets() {
    const nextWidgets = saveHomeWidgets(user, DEFAULT_HOME_WIDGETS);
    setWidgets(nextWidgets);
  }

  const visibleWidgetCount = Object.values(widgets).filter(Boolean).length;

  return (
    <section className="finova-section-space">
      <PageHeader
        title={t("pages.homeTitle")}
        subtitle={t("pages.homeSubtitle")}
        meta={selectedAccountLabel}
        aside={
          <div className="d-grid gap-2">
            <div>
              <label className="form-label text-dark fw-medium" htmlFor="home-period">
                {t("pages.homePeriod")}
              </label>
              <select
                id="home-period"
                className="form-select finova-select"
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
              <label className="form-label text-dark fw-medium" htmlFor="home-account">
                {t("pages.displayedAccountLabel")}
              </label>
              <select
                id="home-account"
                className="form-select finova-select"
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

      <div className="d-grid gap-4">
        <div className="finova-page-note">
          {t("pages.homePageNote")}
        </div>

        {visibleWidgetCount === 0 ? (
          <div className="finova-card p-4 text-center">
            <h2 className="finova-title h5 mb-2">{t("home.emptyTitle")}</h2>
            <p className="finova-subtitle mb-3">{t("home.emptyDescription")}</p>
            <button type="button" className="btn finova-btn-primary" onClick={handleResetWidgets}>
              {t("home.restoreWidgets")}
            </button>
          </div>
        ) : null}

        {widgets.context ? (
          user?.isDemo ? (
            <DemoInfoCard />
          ) : user?.onboardingOptIn == null ? (
            <OnboardingPromptCard
              isSaving={isApplyingOnboarding}
              onChoose={handleOnboardingChoice}
            />
          ) : (
            <OnboardingChecklistCard
              transactionsCount={scopedTransactions.length}
              recurringCount={recurringTransactionsCount}
              goalsCount={goalsCount}
              isSaving={isApplyingOnboarding}
              onHide={() => handleOnboardingChoice(false)}
              onShowAgain={() => handleOnboardingChoice(true)}
              isVisible={Boolean(user?.onboardingOptIn)}
              isCompleted={onboardingCompleted}
            />
          )
        ) : null}

        {widgets.summary ? (
          <div className="finova-card p-4">
            <div className="mb-3">
              <h2 className="finova-title h5 mb-1">{t("home.summaryTitle")}</h2>
              <p className="finova-subtitle mb-0">
                {t("home.summaryDescription", {
                  period: selectedPeriodLabel.toLowerCase(),
                })}
              </p>
            </div>

            {isLoading ? (
              <p className="finova-subtitle mb-0">{t("home.summaryLoading")}</p>
            ) : (
              <div className="row g-3">
                <SummaryCard
                  label={t("transactions.incomePlural")}
                  value={formatBRLFromCents(summary.income)}
                  tone="income"
                />
                <SummaryCard
                  label={t("transactions.expensePlural")}
                  value={formatBRLFromCents(summary.expense)}
                  tone="expense"
                />
                <SummaryCard
                  label={t("publicDashboard.balanceLabel")}
                  value={formatBRLFromCents(summary.balance)}
                  tone="default"
                />
              </div>
            )}
          </div>
        ) : null}

        {widgets.shortcuts ? (
          <HomeWidgetCard
            title={t("home.shortcutsTitle")}
            description={t("home.shortcutsDescription")}
          >
            <div className="row g-3">
              <ShortcutTile
                title={t("navbar.charts")}
                description={t("home.shortcutChartsDescription")}
                to="/graficos"
              />
              <ShortcutTile
                title={t("navbar.analyses")}
                description={t("home.shortcutAnalysesDescription")}
                to="/analises"
              />
              <ShortcutTile
                title={t("navbar.transactions")}
                description={t("home.shortcutTransactionsDescription")}
                to="/transacoes"
              />
              <ShortcutTile
                title={t("navbar.accounts")}
                description={t("home.shortcutAccountsDescription")}
                to="/contas"
              />
            </div>
          </HomeWidgetCard>
        ) : null}

        <div className="row g-4">
          {widgets.insights ? (
            <div className="col-12 col-xxl-6">
              <HomeWidgetCard
                title={t("home.insightsTitle")}
                description={t("home.insightsDescription")}
              >
                {isLoading ? (
                  <p className="finova-subtitle mb-0">{t("home.insightsLoading")}</p>
                ) : automaticInsights.length === 0 && prescriptiveInsights.length === 0 ? (
                  <p className="finova-subtitle mb-0">{t("home.insightsEmpty")}</p>
                ) : (
                  <>
                    <div className="row g-3">
                      {[...automaticInsights, ...prescriptiveInsights].map((insight) => (
                        <InsightCard
                          key={insight.key}
                          title={insight.title}
                          description={insight.description}
                          badge={insight.badge}
                          tone={insight.tone}
                        />
                      ))}
                    </div>

                    <div className="mt-3">
                      <Link to="/analises" className="btn finova-btn-light">
                        {t("home.openFullAnalyses")}
                      </Link>
                    </div>
                  </>
                )}
              </HomeWidgetCard>
            </div>
          ) : null}

          {widgets.comparisons ? (
            <div className="col-12 col-xxl-6">
              <HomeWidgetCard
                title={t("home.comparisonTitle")}
                description={t("home.comparisonDescription")}
              >
                {isLoading ? (
                  <p className="finova-subtitle mb-0">{t("home.comparisonLoading")}</p>
                ) : (
                  <>
                    <div className="row g-3 mb-3">
                      <ComparisonCard
                        label={t("transactions.incomePlural")}
                        currentValue={comparison.current.income}
                        previousValue={comparison.previous.income}
                        currentRangeLabel={comparison.currentRangeLabel}
                        previousRangeLabel={comparison.previousRangeLabel}
                      />
                      <ComparisonCard
                        label={t("transactions.expensePlural")}
                        currentValue={comparison.current.expense}
                        previousValue={comparison.previous.expense}
                        currentRangeLabel={comparison.currentRangeLabel}
                        previousRangeLabel={comparison.previousRangeLabel}
                      />
                      <ComparisonCard
                        label={t("publicDashboard.balanceLabel")}
                        currentValue={comparison.current.balance}
                        previousValue={comparison.previous.balance}
                        currentRangeLabel={comparison.currentRangeLabel}
                        previousRangeLabel={comparison.previousRangeLabel}
                      />
                    </div>

                    <div className="row g-3">
                      <CategoryInsightCard
                        title={t("home.comparisonHeaviestCategory")}
                        category={comparison.categoryLeaders.biggestIncrease.category}
                        value={comparison.categoryLeaders.biggestIncrease.value}
                        tone="up"
                      />
                      <CategoryInsightCard
                        title={t("home.comparisonLightestCategory")}
                        category={comparison.categoryLeaders.biggestDrop.category}
                        value={comparison.categoryLeaders.biggestDrop.value}
                        tone="down"
                      />
                    </div>

                    <div className="mt-3">
                      <Link to="/analises" className="btn finova-btn-light">
                        {t("home.openFullAnalyses")}
                      </Link>
                    </div>
                  </>
                )}
              </HomeWidgetCard>
            </div>
          ) : null}
        </div>

        <div className="row g-4">
          {widgets.goals ? (
            <div className="col-12 col-xl-6">
              <GoalsPreview
                goalsCount={isLoadingGoals ? "-" : goalsCount}
                goalsRiskCount={isLoadingGoals ? "-" : goalsRiskCount}
              />
            </div>
          ) : null}

          {widgets.history ? (
            <div className="col-12 col-xl-6">
              <HistoryPreview logs={historyLogs} isLoading={isLoadingHistory} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
