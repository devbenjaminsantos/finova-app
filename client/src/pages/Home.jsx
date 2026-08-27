import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import CategoryRow from "../components/ui/CategoryRow";
import {
  CategoryInsightCard,
  ComparisonCard,
} from "../features/dashboard/DashboardCards";
import {
  buildExpenseTotalsByCategory,
  buildMonthlySeries,
  getComparisonRangeOptions,
  currentMonthISO,
  getAutomaticInsights,
  getCategoryLeaders,
  getLatestTransactionMonthISO,
  getMonthsForPeriod,
  getPrescriptiveInsights,
  getRelativeMonthsISO,
  getTrailingMonthsFromAnchor,
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
          <Button
            type="button"
            loading={isSaving}
            onClick={() => onChoose(true)}
          >
            {isSaving ? t("common.loading") : t("home.onboardingPromptAccept")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => onChoose(false)}
          >
            {t("home.onboardingPromptDecline")}
          </Button>
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

          <Button
            type="button"
            variant="secondary"
            loading={isSaving}
            onClick={onShowAgain}
          >
            {isSaving ? t("common.loading") : t("home.onboardingShowAgain")}
          </Button>
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
          <Button
            type="button"
            variant="secondary"
            loading={isSaving}
            onClick={onHide}
          >
            {t("home.onboardingHide")}
          </Button>
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

function GoalsPreview({ error, goalsCount, goalsRiskCount, isLoading }) {
  const { t } = useI18n();

  return (
    <section className="finova-home-summary-panel" aria-labelledby="home-planning-title">
      <span className="finova-home-eyebrow">{t("home.planningEyebrow")}</span>
      <h3 id="home-planning-title" className="finova-title h5 mb-2">
        {t("home.goalsTitle")}
      </h3>
      <p className="finova-subtitle mb-4">{t("home.goalsDescription")}</p>

      {isLoading ? (
        <p className="finova-subtitle mb-0">{t("home.goalsLoading")}</p>
      ) : error ? (
        <p className="finova-home-status finova-home-status-error" role="alert">
          {t("home.goalsError")}
        </p>
      ) : (
        <>
          <dl className="finova-home-stat-list">
            <div>
              <dt>{t("home.goalsConfiguredLabel")}</dt>
              <dd>{goalsCount}</dd>
              <p>{goalsCount === 0 ? t("home.goalsEmpty") : t("home.goalsConfiguredHelp")}</p>
            </div>
            <div>
              <dt>{t("home.goalsRiskLabel")}</dt>
              <dd>{goalsRiskCount}</dd>
              <p>{t("home.goalsRiskHelp")}</p>
            </div>
          </dl>

          <Link to="/analises" className="btn finova-btn-light">
            {t("home.openAnalyses")}
          </Link>
        </>
      )}
    </section>
  );
}

function HistoryPreview({ error, logs, isLoading }) {
  const { t, formatDateTime } = useI18n();

  return (
    <section className="finova-home-summary-panel" aria-labelledby="home-activity-title">
      <span className="finova-home-eyebrow">{t("home.activityEyebrow")}</span>
      <h3 id="home-activity-title" className="finova-title h5 mb-2">
        {t("home.historyTitle")}
      </h3>
      <p className="finova-subtitle mb-4">{t("home.historyDescription")}</p>

      {isLoading ? (
        <p className="finova-subtitle mb-0">{t("history.loading")}</p>
      ) : error ? (
        <p className="finova-home-status finova-home-status-error" role="alert">
          {t("home.historyError")}
        </p>
      ) : logs.length === 0 ? (
        <p className="finova-subtitle mb-0">{t("home.historyEmpty")}</p>
      ) : (
        <ol className="finova-home-activity-list">
          {logs.map((log) => (
            <li key={log.id}>
              <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                <span className={getActionToneClass(log.action)}>
                  {formatActionLabel(log.action, t)}
                </span>
                <span className="finova-subtitle small">
                  {formatAuditDate(log.createdAtUtc, formatDateTime)}
                </span>
              </div>
              <div className="fw-medium small">{log.summary}</div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3">
        <Link to="/historico" className="btn finova-btn-light">
          {t("home.openHistory")}
        </Link>
      </div>
    </section>
  );
}

function getTrendPath(series) {
  const width = 620;
  const height = 176;
  const padding = { top: 18, right: 12, bottom: 24, left: 12 };
  const values = series.map((item) => Number(item.balance) || 0);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const availableWidth = width - padding.left - padding.right;
  const availableHeight = height - padding.top - padding.bottom;

  const points = series.map((item, index) => {
    const x = padding.left + (availableWidth * index) / Math.max(series.length - 1, 1);
    const y = padding.top + ((maxValue - (Number(item.balance) || 0)) / range) * availableHeight;

    return {
      ...item,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  });

  return {
    baseline: padding.top + (maxValue / range) * availableHeight,
    points,
    polyline: points.map((point) => `${point.x},${point.y}`).join(" "),
  };
}

function HomeTrend({ isLoading, series }) {
  const { t, formatCurrencyFromCents } = useI18n();
  const hasData = series.some((item) => item.income > 0 || item.expense > 0);
  const trend = useMemo(() => getTrendPath(series), [series]);

  return (
    <div className="finova-home-trend">
      <div className="finova-home-trend-heading">
        <div>
          <span className="finova-home-eyebrow">{t("home.heroTrendEyebrow")}</span>
          <h2 className="finova-title h5 mb-0">{t("home.heroTrendTitle")}</h2>
        </div>
        <span className="finova-subtitle small">{t("home.heroTrendRange")}</span>
      </div>

      {isLoading ? (
        <p className="finova-subtitle mb-0">{t("home.summaryLoading")}</p>
      ) : hasData ? (
        <>
          <svg
            className="finova-home-trend-chart"
            viewBox="0 0 620 176"
            role="img"
            aria-label={t("home.heroTrendAriaLabel")}
          >
            <line
              x1="12"
              x2="608"
              y1={trend.baseline}
              y2={trend.baseline}
              className="finova-home-trend-baseline"
            />
            <polyline points={trend.polyline} className="finova-home-trend-line" />
            {trend.points.map((point) => (
              <circle
                key={point.month}
                cx={point.x}
                cy={point.y}
                r="3.5"
                className="finova-home-trend-point"
              >
                <title>{`${point.month}: ${formatCurrencyFromCents(point.balance)}`}</title>
              </circle>
            ))}
          </svg>
          <div className="finova-home-trend-labels" aria-hidden="true">
            {trend.points.map((point) => (
              <span key={point.month}>{point.month.slice(5)}</span>
            ))}
          </div>
        </>
      ) : (
        <p className="finova-subtitle mb-0">{t("home.heroTrendEmpty")}</p>
      )}
    </div>
  );
}

function HomeFinancialHero({
  accountFilter,
  accounts,
  isLoading,
  onAccountChange,
  onPeriodChange,
  period,
  periodOptions,
  registeredBalance,
  selectedAccountLabel,
  selectedPeriodLabel,
  summary,
  trendSeries,
}) {
  const { formatCurrencyFromCents, t } = useI18n();
  const metrics = [
    { key: "balance", label: t("home.heroBalanceLabel"), value: registeredBalance },
    { key: "income", label: t("home.heroIncomeLabel"), value: summary.income, tone: "income" },
    { key: "expense", label: t("home.heroExpenseLabel"), value: summary.expense, tone: "expense" },
    { key: "result", label: t("home.heroResultLabel"), value: summary.balance, tone: "result" },
  ];

  return (
    <section className="finova-home-hero" aria-labelledby="home-financial-title">
      <div className="finova-home-hero-main">
        <div className="finova-home-hero-copy">
          <span className="finova-home-eyebrow">{t("home.heroEyebrow")}</span>
          <h1 id="home-financial-title" className="finova-title">
            {t("home.heroTitle")}
          </h1>
          <p className="finova-subtitle mb-0">
            {t("home.heroDescription", { period: selectedPeriodLabel.toLowerCase() })}
          </p>
          <p className="finova-home-hero-scope mb-0">{selectedAccountLabel}</p>
        </div>

        <div className="finova-home-hero-controls">
          <div>
            <label className="form-label" htmlFor="home-period">
              {t("pages.homePeriod")}
            </label>
            <select
              id="home-period"
              className="form-select finova-select"
              value={period}
              onChange={(event) => onPeriodChange(event.target.value)}
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" htmlFor="home-account">
              {t("pages.displayedAccountLabel")}
            </label>
            <select
              id="home-account"
              className="form-select finova-select"
              value={accountFilter}
              onChange={(event) => onAccountChange(event.target.value)}
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
      </div>

      <div className="finova-home-metrics" aria-label={t("home.heroMetricsLabel")}>
        {metrics.map((metric) => (
          <div key={metric.key} className={`finova-home-metric finova-home-metric-${metric.tone || "default"}`}>
            <span>{metric.label}</span>
            <strong>{isLoading ? "—" : formatCurrencyFromCents(metric.value)}</strong>
          </div>
        ))}
      </div>

      <HomeTrend isLoading={isLoading} series={trendSeries} />
    </section>
  );
}

function getPerceptionBadgeClass(tone) {
  if (tone === "income") {
    return "finova-badge-income";
  }

  if (tone === "expense") {
    return "finova-badge-expense";
  }

  if (tone === "neutral") {
    return "finova-badge-neutral";
  }

  return "finova-badge-primary";
}

function HomePerception({ insight, isLoading }) {
  const { t } = useI18n();

  return (
    <section className="finova-home-reading-panel" aria-labelledby="home-perception-title">
      <span className="finova-home-eyebrow">{t("home.perceptionEyebrow")}</span>
      <h2 id="home-perception-title" className="finova-title h4 mb-2">
        {insight?.title || t("home.perceptionTitle")}
      </h2>

      {isLoading ? (
        <p className="finova-subtitle mb-0">{t("home.insightsLoading")}</p>
      ) : insight ? (
        <>
          <div className="d-flex align-items-center gap-2 mb-3">
            <span className={getPerceptionBadgeClass(insight.tone)}>{insight.badge}</span>
            <span className="finova-subtitle small">{t("home.perceptionRuleBased")}</span>
          </div>
          <p className="finova-subtitle mb-0">{insight.description}</p>
          <div className="mt-4">
            <Link to="/analises" className="btn finova-btn-light">
              {t("home.openFullAnalyses")}
            </Link>
          </div>
        </>
      ) : (
        <p className="finova-subtitle mb-0">{t("home.perceptionEmpty")}</p>
      )}
    </section>
  );
}

function HomeSpendingCategories({ categories, isLoading }) {
  const { formatCurrencyFromCents, t } = useI18n();

  return (
    <section className="finova-home-reading-panel" aria-labelledby="home-spending-title">
      <span className="finova-home-eyebrow">{t("home.spendingEyebrow")}</span>
      <h2 id="home-spending-title" className="finova-title h4 mb-2">
        {t("home.spendingTitle")}
      </h2>
      <p className="finova-subtitle mb-4">{t("home.spendingDescription")}</p>

      {isLoading ? (
        <p className="finova-subtitle mb-0">{t("home.insightsLoading")}</p>
      ) : categories.length === 0 ? (
        <p className="finova-subtitle mb-0">{t("home.spendingEmpty")}</p>
      ) : (
        <ol className="finova-home-spending-list">
          {categories.map((category) => (
            <CategoryRow
              key={category.name}
              label={category.name}
              value={formatCurrencyFromCents(category.value)}
              share={category.share}
              shareLabel={t("home.spendingShare", { share: category.share })}
            />
          ))}
        </ol>
      )}
    </section>
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
  const [goalsError, setGoalsError] = useState(false);
  const [goalsRefresh, setGoalsRefresh] = useState(0);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const periodOptions = useMemo(() => getPeriodOptions(t), [t]);
  const comparisonRangeOptions = useMemo(() => getComparisonRangeOptions(t), [t]);

  useEffect(() => {
    function handleSessionChange() {
      const nextUser = getStoredUser();
      setUser(nextUser);
      setWidgets(loadHomeWidgets(nextUser));
      setGoalsRefresh((current) => current + 1);
    }

    function handleBudgetGoalsChange() {
      setGoalsRefresh((current) => current + 1);
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
          setGoalsError(false);
          setIsLoadingGoals(false);
        }
        return;
      }

      setIsLoadingGoals(true);
      setGoalsError(false);

      try {
        const data = await getBudgetGoals(currentMonthISO());
        if (active) {
          setGoals(Array.isArray(data) ? data : []);
        }
      } catch {
        if (active) {
          setGoals([]);
          setGoalsError(true);
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
  }, [user, goalsRefresh]);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      if (!user) {
        if (active) {
          setHistoryLogs([]);
          setHistoryError(false);
          setIsLoadingHistory(false);
        }
        return;
      }

      setIsLoadingHistory(true);
      setHistoryError(false);

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
          setHistoryError(true);
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

  const registeredBalance = useMemo(
    () => summarizeTransactions(scopedTransactions).balance,
    [scopedTransactions]
  );

  const trendSeries = useMemo(() => {
    const latestMonth = getLatestTransactionMonthISO(scopedTransactions) || currentMonthISO();
    const months = getTrailingMonthsFromAnchor(latestMonth, 6);

    return buildMonthlySeries(scopedTransactions, months);
  }, [scopedTransactions]);

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

  const perceptionInsight = prescriptiveInsights[0] ?? automaticInsights[0] ?? null;

  const spendingCategories = useMemo(() => {
    const totals = buildExpenseTotalsByCategory(filteredTransactions, t);
    const totalExpense = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(totals.entries())
      .sort(([, leftValue], [, rightValue]) => rightValue - leftValue)
      .slice(0, 4)
      .map(([name, value]) => ({
        name,
        value,
        share: totalExpense > 0 ? Math.round((value / totalExpense) * 100) : 0,
      }));
  }, [filteredTransactions, t]);

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
      {widgets.summary ? (
        <HomeFinancialHero
          accountFilter={accountFilter}
          accounts={accounts}
          isLoading={isLoading}
          onAccountChange={setAccountFilter}
          onPeriodChange={setPeriod}
          period={period}
          periodOptions={periodOptions}
          registeredBalance={registeredBalance}
          selectedAccountLabel={selectedAccountLabel}
          selectedPeriodLabel={selectedPeriodLabel}
          summary={summary}
          trendSeries={trendSeries}
        />
      ) : null}

      <div className="d-grid gap-4">
        {visibleWidgetCount === 0 ? (
          <div className="finova-card p-4 text-center">
            <h2 className="finova-title h5 mb-2">{t("home.emptyTitle")}</h2>
            <p className="finova-subtitle mb-3">{t("home.emptyDescription")}</p>
            <Button type="button" onClick={handleResetWidgets}>
              {t("home.restoreWidgets")}
            </Button>
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
            <div className="col-12 col-xl-5">
              <HomePerception insight={perceptionInsight} isLoading={isLoading} />
            </div>
          ) : null}

          {widgets.insights ? (
            <div className="col-12 col-xl-7">
              <HomeSpendingCategories categories={spendingCategories} isLoading={isLoading} />
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

        {widgets.goals || widgets.history ? (
          <section className="finova-home-planning-activity" aria-labelledby="home-planning-activity-title">
            <div className="finova-home-planning-activity-heading">
              <div>
                <span className="finova-home-eyebrow">{t("home.planningActivityEyebrow")}</span>
                <h2 id="home-planning-activity-title" className="finova-title h4 mb-1">
                  {t("home.planningActivityTitle")}
                </h2>
                <p className="finova-subtitle mb-0">{t("home.planningActivityDescription")}</p>
              </div>
            </div>

            <div className="row g-4">
              {widgets.goals ? (
                <div className="col-12 col-xl-6">
                  <GoalsPreview
                    error={goalsError}
                    goalsCount={goalsCount}
                    goalsRiskCount={goalsRiskCount}
                    isLoading={isLoadingGoals}
                  />
                </div>
              ) : null}

              {widgets.history ? (
                <div className="col-12 col-xl-6">
                  <HistoryPreview
                    error={historyError}
                    logs={historyLogs}
                    isLoading={isLoadingHistory}
                  />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
