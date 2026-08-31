import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../components/layout/PageHeader";
import { SummaryCard } from "../features/dashboard/DashboardCards";
import DashboardCharts from "../features/dashboard/DashboardCharts";
import {
  getMonthsForPeriod,
  getPeriodOptions,
  lastNMonthsISO,
  summarizeTransactions,
} from "../features/dashboard/dashboardAnalytics";
import { getPublicDashboard } from "../lib/api/publicDashboard";
import { useI18n } from "../i18n/LanguageProvider";

export default function PublicDashboard() {
  const { token } = useParams();
  const { t, formatCurrencyFromCents, formatDate } = useI18n();
  const [period, setPeriod] = useState("current-month");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const periodOptions = useMemo(() => getPeriodOptions(t), [t]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getPublicDashboard(token);

        if (active) {
          setDashboard(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message || t("publicDashboard.loadError"));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [token, t]);

  const transactions = useMemo(() => dashboard?.transactions ?? [], [dashboard]);

  const selectedPeriodLabel = useMemo(
    () => periodOptions.find((option) => option.value === period)?.label ?? t("dashboard.focusMonth"),
    [period, periodOptions, t]
  );

  const chartMonths = useMemo(
    () => (period === "all" ? lastNMonthsISO(6) : getMonthsForPeriod(period)),
    [period]
  );

  const filteredTransactions = useMemo(() => {
    if (period === "all") {
      return transactions;
    }

    const allowedMonths = new Set(getMonthsForPeriod(period));
    return transactions.filter((transaction) =>
      allowedMonths.has((transaction.date || "").slice(0, 7))
    );
  }, [transactions, period]);

  const summary = useMemo(() => summarizeTransactions(filteredTransactions), [filteredTransactions]);

  return (
    <section className="hestia-section-space">
      <PageHeader
        title={t("publicDashboard.title")}
        subtitle={
          dashboard?.displayName
            ? t("publicDashboard.subtitleWithName", { name: dashboard.displayName })
            : t("publicDashboard.subtitle")
        }
        aside={
          <>
          <label className="form-label text-dark fw-medium" htmlFor="public-dashboard-period">
            {t("pages.dashboardPeriod")}
          </label>
          <select
            id="public-dashboard-period"
            className="form-select hestia-select"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            disabled={isLoading || Boolean(error)}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          </>
        }
      />

      <div className="hestia-page-note mb-4">
        {t("publicDashboard.pageNote")}
      </div>

      <div className="hestia-card p-4 mb-4">
        <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
          <div>
            <span className="hestia-badge-primary">{t("publicDashboard.readOnlyBadge")}</span>
            <p className="hestia-subtitle mb-0 mt-2">{t("publicDashboard.readOnlyDescription")}</p>
          </div>

          <div className="hestia-public-dashboard-meta">
            <div className="hestia-subtitle small">{t("publicDashboard.visibilityLabel")}</div>
            <div className="hestia-title h6 mb-0">{t("publicDashboard.visibilityValue")}</div>
            <div className="hestia-subtitle small mt-2">
              {dashboard?.lastTransactionDate
                ? t("publicDashboard.lastUpdated", {
                    date: formatDate(dashboard.lastTransactionDate),
                  })
                : t("publicDashboard.noUpdate")}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="hestia-card p-4">
          <p className="hestia-subtitle mb-0">{t("common.loading")}</p>
        </div>
      ) : error ? (
        <div className="hestia-card p-4">
          <h2 className="hestia-title h5 mb-2">{t("publicDashboard.unavailableTitle")}</h2>
          <p className="hestia-subtitle mb-3">{error}</p>
          <div className="hestia-actions-row">
            <Link to="/login" className="btn hestia-btn-light">
              {t("auth.goToLogin")}
            </Link>
            <Link to="/register" className="btn hestia-btn-primary">
              {t("auth.createAccount")}
            </Link>
          </div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="hestia-card p-4">
          <h2 className="hestia-title h5 mb-2">{t("publicDashboard.emptyTitle")}</h2>
          <p className="hestia-subtitle mb-0">{t("publicDashboard.emptySubtitle")}</p>
        </div>
      ) : (
        <>
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

          <div className="hestia-card p-4">
            <div className="mb-3">
              <h2 className="hestia-title h5 mb-1">{t("pages.dashboardCardTitle")}</h2>
              <p className="hestia-subtitle mb-0">
                {t("pages.dashboardCardSubtitle", {
                  period: selectedPeriodLabel.toLowerCase(),
                })}
              </p>
            </div>

            <DashboardCharts
              transactions={filteredTransactions}
              chartMonths={chartMonths}
              periodLabel={selectedPeriodLabel}
            />
          </div>
        </>
      )}
    </section>
  );
}
