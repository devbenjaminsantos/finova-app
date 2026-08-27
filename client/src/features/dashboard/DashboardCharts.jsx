import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartContainer from "../../components/ui/ChartContainer";
import { useI18n } from "../../i18n/LanguageProvider";

function monthLabel(yyyyMM) {
  const [y, m] = yyyyMM.split("-");
  return `${m}/${y}`;
}

function cents(n) {
  return Number(n) || 0;
}

function buildExpenseByCategory(transactions, fallbackCategory) {
  const map = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== "expense") {
      continue;
    }

    const category = transaction.category || fallbackCategory;
    map.set(category, (map.get(category) || 0) + cents(transaction.amountCents));
  }

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function buildIncomeVsExpenseByMonth(transactions, months) {
  const base = new Map(months.map((month) => [month, { month, income: 0, expense: 0 }]));

  for (const transaction of transactions) {
    const month = (transaction.date || "").slice(0, 7);

    if (!base.has(month)) {
      continue;
    }

    if (transaction.type === "income") {
      base.get(month).income += cents(transaction.amountCents);
    } else {
      base.get(month).expense += cents(transaction.amountCents);
    }
  }

  return months.map((month) => base.get(month));
}

export default function DashboardCharts({ transactions, chartMonths, periodLabel }) {
  const { t, formatCurrencyFromCents } = useI18n();

  function formatAxisValue(value) {
    const amount = Number(value) || 0;
    const brl = amount / 100;

    if (Math.abs(brl) >= 1000) {
      return `R$ ${(brl / 1000).toFixed(1)}k`;
    }

    return `R$ ${brl.toFixed(0)}`;
  }

  const expenseByCategory = useMemo(
    () => buildExpenseByCategory(transactions, t("dashboard.goalOtherCategory")),
    [transactions, t]
  );

  const incomeVsExpense = useMemo(
    () => buildIncomeVsExpenseByMonth(transactions, chartMonths),
    [transactions, chartMonths]
  );

  const hasIncomeVsExpenseData = useMemo(
    () => incomeVsExpense.some((item) => item.income > 0 || item.expense > 0),
    [incomeVsExpense]
  );

  const pieColors = ["#0d6efd", "#198754", "#dc3545", "#ffc107", "#6f42c1", "#20c997", "#fd7e14", "#6c757d"];

  const pieLegend = useMemo(
    () =>
      expenseByCategory.map((item) => ({
        ...item,
        label: `${item.name} - ${formatCurrencyFromCents(item.value)}`,
      })),
    [expenseByCategory, formatCurrencyFromCents]
  );

  const categoryCaption =
    periodLabel === t("dashboard.allPeriodsLabel")
      ? t("dashboard.allExpensesRecorded")
      : periodLabel;

  return (
    <div className="row g-3">
      <div className="col-12 col-lg-5" style={{ minWidth: 0 }}>
        <ChartContainer
          className="finova-card h-100 p-4"
          title={t("dashboard.expensesByCategory")}
          meta={categoryCaption}
        >
          {expenseByCategory.length === 0 ? (
            <div className="finova-subtitle">{t("dashboard.noExpensesInPeriod")}</div>
          ) : (
            <div className="finova-chart-shell">
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <PieChart>
                  <Tooltip formatter={(value) => formatCurrencyFromCents(value)} />
                  <Pie data={pieLegend} dataKey="value" nameKey="label" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {expenseByCategory.map((item, idx) => (
                      <Cell key={item.name} fill={pieColors[idx % pieColors.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartContainer>
      </div>

      <div className="col-12 col-lg-7" style={{ minWidth: 0 }}>
        <ChartContainer
          className="finova-card h-100 p-4"
          title={t("dashboard.incomeVsExpense")}
          meta={periodLabel}
          footer={hasIncomeVsExpenseData ? t("dashboard.chartFootnote") : null}
        >
          {hasIncomeVsExpenseData ? (
            <div className="finova-chart-shell">
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <BarChart data={incomeVsExpense} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} />
                  <YAxis tickFormatter={formatAxisValue} width={70} />
                  <Tooltip formatter={(value) => formatCurrencyFromCents(value)} labelFormatter={monthLabel} />
                  <Legend />
                  <Bar dataKey="income" name={t("transactions.incomePlural")} fill="#198754" />
                  <Bar dataKey="expense" name={t("transactions.expensePlural")} fill="#dc3545" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="finova-subtitle">{t("dashboard.noMovementComparison")}</div>
          )}
        </ChartContainer>
      </div>
    </div>
  );
}
