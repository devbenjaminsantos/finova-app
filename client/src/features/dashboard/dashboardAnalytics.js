import { formatBRLFromCents } from "../../lib/format/currency";

const FALLBACK_TRANSLATIONS = {
  "dashboardAnalytics.period.currentMonth": "Mês atual",
  "dashboardAnalytics.period.last3Months": "Últimos 3 meses",
  "dashboardAnalytics.period.last6Months": "Últimos 6 meses",
  "dashboardAnalytics.period.allHistory": "Todo o histórico",
  "dashboardAnalytics.comparisonRange.singleMonth": "1 mês",
  "dashboardAnalytics.comparisonRange.months": "{{count}} meses",
  "dashboardAnalytics.defaultCategory": "Outros",
  "dashboardAnalytics.biggestExpenseBadge": "Despesa",
  "dashboardAnalytics.insights.topCategoryTitle": "Categoria mais representativa",
  "dashboardAnalytics.insights.topCategoryDescription":
    "{{category}} concentra {{share}}% das despesas do período e merece atenção extra.",
  "dashboardAnalytics.insights.savingsRateTitle": "Ritmo de sobra no período",
  "dashboardAnalytics.insights.savingsRateHealthy":
    "Seu saldo está preservando uma parcela saudável das receitas neste recorte.",
  "dashboardAnalytics.insights.savingsRatePositive":
    "O saldo ainda está positivo, mas há espaço para aumentar a folga financeira.",
  "dashboardAnalytics.insights.savingsRateNegative":
    "As despesas superaram as receitas neste período e pedem correção rápida.",
  "dashboardAnalytics.insights.recurringTitle": "Compromissos recorrentes",
  "dashboardAnalytics.insights.recurringItems": "{{count}} itens",
  "dashboardAnalytics.insights.recurringPositive":
    "Os lançamentos recorrentes deixam {{amount}} de margem entre entradas e saídas fixas.",
  "dashboardAnalytics.insights.recurringNegative":
    "Os lançamentos recorrentes já comprometem {{amount}} além das entradas fixas.",
  "dashboardAnalytics.insights.biggestExpenseTitle": "Maior despesa avulsa",
  "dashboardAnalytics.insights.biggestExpenseDescription":
    "{{description}} foi o maior lançamento de saída do período, totalizando {{amount}}.",
  "dashboardAnalytics.prescriptive.priorityTitle": "Ação prioritária",
  "dashboardAnalytics.prescriptive.priorityBadge": "Ajuste imediato",
  "dashboardAnalytics.prescriptive.priorityDescription":
    "As despesas passaram das receitas neste período. Vale revisar as saídas variáveis primeiro e congelar gastos menos essenciais até o saldo voltar a respirar.",
  "dashboardAnalytics.prescriptive.nextStepTitle": "Próximo movimento sugerido",
  "dashboardAnalytics.prescriptive.nextStepBadge": "Baixa folga",
  "dashboardAnalytics.prescriptive.nextStepDescription":
    "Sua folga está curta. Um bom próximo passo é transformar pelo menos uma despesa previsível em lançamento recorrente e definir uma meta mensal para a categoria mais pesada.",
  "dashboardAnalytics.prescriptive.opportunityTitle": "Oportunidade clara",
  "dashboardAnalytics.prescriptive.opportunityBadge": "Saldo saudável",
  "dashboardAnalytics.prescriptive.opportunityDescription":
    "O período está com boa sobra. Este é um momento favorável para reforçar metas, antecipar despesas previsíveis ou criar uma reserva para os próximos meses.",
  "dashboardAnalytics.prescriptive.topCategoryTitle": "Categoria que pede atenção",
  "dashboardAnalytics.prescriptive.topCategoryDescription":
    "{{category}} já representa {{share}}% das despesas deste recorte. Vale criar ou revisar uma meta específica para essa categoria antes que ela dite o resultado do mês sozinha.",
  "dashboardAnalytics.prescriptive.recurringTitle": "Estrutura fixa pressionada",
  "dashboardAnalytics.prescriptive.recurringBadge": "Recorrência",
  "dashboardAnalytics.prescriptive.recurringDescription":
    "As saídas recorrentes já superam as entradas recorrentes. A melhor alavanca aqui é renegociar compromissos fixos ou aumentar uma entrada previsível antes de ampliar novos gastos.",
  "dashboardAnalytics.prescriptive.defaultTitle": "Próximo passo sugerido",
  "dashboardAnalytics.prescriptive.defaultBadge": "Organização",
  "dashboardAnalytics.prescriptive.defaultDescription":
    "Seu cenário está relativamente equilibrado. O próximo ganho prático costuma vir de manter recorrências em dia e revisar o comparativo entre meses para identificar mudanças cedo.",
  "dashboardAnalytics.confidence.high": "Alta",
  "dashboardAnalytics.confidence.medium": "Média",
  "dashboardAnalytics.confidence.low": "Baixa",
};

function fallbackTranslate(key, params = {}) {
  const template = FALLBACK_TRANSLATIONS[key] ?? key;

  return Object.entries(params).reduce(
    (result, [paramKey, value]) => result.replaceAll(`{{${paramKey}}}`, String(value)),
    template
  );
}

function translate(t, key, params) {
  if (typeof t === "function") {
    return t(key, params);
  }

  return fallbackTranslate(key, params);
}

export function getPeriodOptions(t) {
  return [
    { value: "current-month", label: translate(t, "dashboardAnalytics.period.currentMonth") },
    { value: "last-3-months", label: translate(t, "dashboardAnalytics.period.last3Months") },
    { value: "last-6-months", label: translate(t, "dashboardAnalytics.period.last6Months") },
    { value: "all", label: translate(t, "dashboardAnalytics.period.allHistory") },
  ];
}

export function getComparisonRangeOptions(t) {
  return [
    { value: 1, label: translate(t, "dashboardAnalytics.comparisonRange.singleMonth") },
    { value: 3, label: translate(t, "dashboardAnalytics.comparisonRange.months", { count: 3 }) },
    { value: 6, label: translate(t, "dashboardAnalytics.comparisonRange.months", { count: 6 }) },
  ];
}

export function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastNMonthsISO(n) {
  const months = [];
  const d = new Date();
  d.setDate(1);

  for (let i = 0; i < n; i += 1) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }

  return months.reverse();
}

export function getRelativeMonthsISO(offset, count) {
  const months = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);

  for (let i = 0; i < count; i += 1) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }

  return months.reverse();
}

export function shiftMonthISO(month, offset) {
  const [year, monthNumber] = String(month || "").split("-").map(Number);

  if (!year || !monthNumber) {
    return "";
  }

  const date = new Date(year, monthNumber - 1, 1);
  date.setMonth(date.getMonth() + offset);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getLatestTransactionMonthISO(transactions) {
  return transactions.reduce((latest, transaction) => {
    const month = (transaction.date || "").slice(0, 7);

    if (!month) {
      return latest;
    }

    if (!latest || month > latest) {
      return month;
    }

    return latest;
  }, "");
}

export function getTrailingMonthsFromAnchor(anchorMonth, count) {
  const months = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    months.push(shiftMonthISO(anchorMonth, -index));
  }

  return months;
}

export function getMonthsForPeriod(period) {
  switch (period) {
    case "current-month":
      return [currentMonthISO()];
    case "last-3-months":
      return lastNMonthsISO(3);
    case "last-6-months":
      return lastNMonthsISO(6);
    case "all":
    default:
      return [];
  }
}

export function summarizeTransactions(transactions) {
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    const value = Number(transaction.amountCents) || 0;

    if (transaction.type === "income") {
      income += value;
    } else {
      expense += value;
    }
  }

  return {
    income,
    expense,
    balance: income - expense,
  };
}

export function buildMonthlySeries(transactions, months) {
  return months.map((month) => {
    const monthTransactions = transactions.filter(
      (transaction) => (transaction.date || "").slice(0, 7) === month
    );

    return {
      month,
      ...summarizeTransactions(monthTransactions),
    };
  });
}

export function buildExpenseTotalsByCategory(transactions, t) {
  const totals = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== "expense") {
      continue;
    }

    const category = transaction.category || translate(t, "dashboardAnalytics.defaultCategory");
    totals.set(category, (totals.get(category) || 0) + (Number(transaction.amountCents) || 0));
  }

  return totals;
}

export function getCategoryLeaders(currentTransactions, previousTransactions, t) {
  const currentTotals = buildExpenseTotalsByCategory(currentTransactions, t);
  const previousTotals = buildExpenseTotalsByCategory(previousTransactions, t);
  const allCategories = new Set([...currentTotals.keys(), ...previousTotals.keys()]);

  let biggestIncrease = { category: "", value: 0 };
  let biggestDrop = { category: "", value: 0 };

  for (const category of allCategories) {
    const delta = (currentTotals.get(category) || 0) - (previousTotals.get(category) || 0);

    if (delta > biggestIncrease.value) {
      biggestIncrease = { category, value: delta };
    }

    if (delta < biggestDrop.value) {
      biggestDrop = { category, value: Math.abs(delta) };
    }
  }

  return {
    biggestIncrease,
    biggestDrop,
  };
}

export function getAutomaticInsights(transactions, t) {
  const incomeTransactions = transactions.filter((transaction) => transaction.type === "income");
  const expenseTransactions = transactions.filter((transaction) => transaction.type === "expense");

  const totalIncome = incomeTransactions.reduce(
    (sum, transaction) => sum + (Number(transaction.amountCents) || 0),
    0
  );
  const totalExpense = expenseTransactions.reduce(
    (sum, transaction) => sum + (Number(transaction.amountCents) || 0),
    0
  );
  const balance = totalIncome - totalExpense;

  const topExpenseCategory = Array.from(buildExpenseTotalsByCategory(transactions, t).entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];

  const recurringExpenses = expenseTransactions.filter((transaction) => transaction.isRecurring);
  const recurringExpenseTotal = recurringExpenses.reduce(
    (sum, transaction) => sum + (Number(transaction.amountCents) || 0),
    0
  );

  const recurringIncomes = incomeTransactions.filter((transaction) => transaction.isRecurring);
  const recurringIncomeTotal = recurringIncomes.reduce(
    (sum, transaction) => sum + (Number(transaction.amountCents) || 0),
    0
  );

  const insights = [];

  if (topExpenseCategory && totalExpense > 0) {
    const [categoryName, categoryValue] = topExpenseCategory;
    const share = Math.round((categoryValue / totalExpense) * 100);

    insights.push({
      key: "top-category",
      title: translate(t, "dashboardAnalytics.insights.topCategoryTitle"),
      badge: `${share}%`,
      tone: "expense",
      description: translate(t, "dashboardAnalytics.insights.topCategoryDescription", {
        category: categoryName,
        share,
      }),
    });
  }

  if (totalIncome > 0) {
    const savingsRaté = Math.round((balance / totalIncome) * 100);
    const tone = savingsRaté >= 20 ? "income" : savingsRaté < 0 ? "expense" : "primary";
    const badge = savingsRaté > 0 ? `+${savingsRate}%` : `${savingsRate}%`;

    insights.push({
      key: "savings-rate",
      title: translate(t, "dashboardAnalytics.insights.savingsRateTitle"),
      badge,
      tone,
      description:
        savingsRaté >= 20
          ? translate(t, "dashboardAnalytics.insights.savingsRateHealthy")
          : savingsRaté >= 0
            ? translate(t, "dashboardAnalytics.insights.savingsRatePositive")
            : translate(t, "dashboardAnalytics.insights.savingsRateNegative"),
    });
  }

  if (recurringExpenses.length > 0 || recurringIncomes.length > 0) {
    const recurringNet = recurringIncomeTotal - recurringExpenseTotal;
    const tone = recurringNet > 0 ? "income" : recurringNet < 0 ? "expense" : "neutral";

    insights.push({
      key: "recurring",
      title: translate(t, "dashboardAnalytics.insights.recurringTitle"),
      badge: translate(t, "dashboardAnalytics.insights.recurringItems", {
        count: recurringExpenses.length + recurringIncomes.length,
      }),
      tone,
      description:
        recurringNet >= 0
          ? translate(t, "dashboardAnalytics.insights.recurringPositive", {
              amount: formatBRLFromCents(recurringNet),
            })
          : translate(t, "dashboardAnalytics.insights.recurringNegative", {
              amount: formatBRLFromCents(Math.abs(recurringNet)),
            }),
    });
  } else {
    const biggestExpense = [...expenseTransactions].sort(
      (left, right) => (Number(right.amountCents) || 0) - (Number(left.amountCents) || 0)
    )[0];

    if (biggestExpense) {
      insights.push({
        key: "biggest-expense",
        title: translate(t, "dashboardAnalytics.insights.biggestExpenseTitle"),
        badge: biggestExpense.category || translate(t, "dashboardAnalytics.biggestExpenseBadge"),
        tone: "expense",
        description: translate(t, "dashboardAnalytics.insights.biggestExpenseDescription", {
          description: biggestExpense.description,
          amount: formatBRLFromCents(biggestExpense.amountCents),
        }),
      });
    }
  }

  return insights.slice(0, 3);
}

export function getPrescriptiveInsights(transactions, t) {
  const incomeTransactions = transactions.filter((transaction) => transaction.type === "income");
  const expenseTransactions = transactions.filter((transaction) => transaction.type === "expense");

  const totalIncome = incomeTransactions.reduce(
    (sum, transaction) => sum + (Number(transaction.amountCents) || 0),
    0
  );
  const totalExpense = expenseTransactions.reduce(
    (sum, transaction) => sum + (Number(transaction.amountCents) || 0),
    0
  );
  const balance = totalIncome - totalExpense;
  const savingsRaté = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : null;

  const topExpenseCategory = Array.from(buildExpenseTotalsByCategory(transactions, t).entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];

  const recurringExpenses = expenseTransactions.filter((transaction) => transaction.isRecurring);
  const recurringExpenseTotal = recurringExpenses.reduce(
    (sum, transaction) => sum + (Number(transaction.amountCents) || 0),
    0
  );

  const recurringIncomes = incomeTransactions.filter((transaction) => transaction.isRecurring);
  const recurringIncomeTotal = recurringIncomes.reduce(
    (sum, transaction) => sum + (Number(transaction.amountCents) || 0),
    0
  );

  const recommendations = [];

  if (savingsRaté !== null) {
    if (savingsRaté < 0) {
      recommendations.push({
        key: "prescriptive-balance-negative",
        title: translate(t, "dashboardAnalytics.prescriptive.priorityTitle"),
        badge: translate(t, "dashboardAnalytics.prescriptive.priorityBadge"),
        tone: "expense",
        description: translate(t, "dashboardAnalytics.prescriptive.priorityDescription"),
      });
    } else if (savingsRaté < 10) {
      recommendations.push({
        key: "prescriptive-balance-low",
        title: translate(t, "dashboardAnalytics.prescriptive.nextStepTitle"),
        badge: translate(t, "dashboardAnalytics.prescriptive.nextStepBadge"),
        tone: "primary",
        description: translate(t, "dashboardAnalytics.prescriptive.nextStepDescription"),
      });
    } else if (savingsRaté >= 20) {
      recommendations.push({
        key: "prescriptive-balance-healthy",
        title: translate(t, "dashboardAnalytics.prescriptive.opportunityTitle"),
        badge: translate(t, "dashboardAnalytics.prescriptive.opportunityBadge"),
        tone: "income",
        description: translate(t, "dashboardAnalytics.prescriptive.opportunityDescription"),
      });
    }
  }

  if (topExpenseCategory && totalExpense > 0) {
    const [categoryName, categoryValue] = topExpenseCategory;
    const share = Math.round((categoryValue / totalExpense) * 100);

    if (share >= 35) {
      recommendations.push({
        key: "prescriptive-top-category",
        title: translate(t, "dashboardAnalytics.prescriptive.topCategoryTitle"),
        badge: categoryName,
        tone: "expense",
        description: translate(t, "dashboardAnalytics.prescriptive.topCategoryDescription", {
          category: categoryName,
          share,
        }),
      });
    }
  }

  if (recurringExpenses.length > 0 || recurringIncomes.length > 0) {
    const recurringNet = recurringIncomeTotal - recurringExpenseTotal;

    if (recurringNet < 0) {
      recommendations.push({
        key: "prescriptive-recurring-negative",
        title: translate(t, "dashboardAnalytics.prescriptive.recurringTitle"),
        badge: translate(t, "dashboardAnalytics.prescriptive.recurringBadge"),
        tone: "expense",
        description: translate(t, "dashboardAnalytics.prescriptive.recurringDescription"),
      });
    }
  }

  if (recommendations.length === 0 && totalIncome + totalExpense > 0) {
    recommendations.push({
      key: "prescriptive-default",
      title: translate(t, "dashboardAnalytics.prescriptive.defaultTitle"),
      badge: translate(t, "dashboardAnalytics.prescriptive.defaultBadge"),
      tone: "neutral",
      description: translate(t, "dashboardAnalytics.prescriptive.defaultDescription"),
    });
  }

  return recommendations.slice(0, 3);
}

function getWeightedAverage(values) {
  let weightedTotal = 0;
  let totalWeight = 0;

  values.forEach((value, index) => {
    const weight = index + 1;
    weightedTotal += value * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedTotal / totalWeight : 0;
}

function getTrendStep(values) {
  if (values.length < 2) {
    return 0;
  }

  return (values[values.length - 1] - values[0]) / (values.length - 1);
}

function getAverageAbsoluteChange(values) {
  if (values.length < 2) {
    return 0;
  }

  let total = 0;

  for (let index = 1; index < values.length; index += 1) {
    total += Math.abs(values[index] - values[index - 1]);
  }

  return total / (values.length - 1);
}

export function getForecastSnapshot(
  transactions,
  { historyMonths = 6, horizon = 3, t } = {}
) {
  const latestMonth = getLatestTransactionMonthISO(transactions);

  if (!latestMonth) {
    return {
      hasEnoughData: false,
      history: [],
      forecast: [],
      confidence: {
        label: translate(t, "dashboardAnalytics.confidence.low"),
        tone: "neutral",
      },
    };
  }

  const availableMonths = Array.from(
    new Set(
      transactions
        .map((transaction) => (transaction.date || "").slice(0, 7))
        .filter(Boolean)
    )
  ).sort();

  const historyWindow = Math.max(3, Math.min(historyMonths, availableMonths.length));

  if (availableMonths.length < 3) {
    return {
      hasEnoughData: false,
      history: [],
      forecast: [],
      confidence: {
        label: translate(t, "dashboardAnalytics.confidence.low"),
        tone: "neutral",
      },
    };
  }

  const historyMonthsList = getTrailingMonthsFromAnchor(latestMonth, historyWindow);
  const historySeries = buildMonthlySeries(transactions, historyMonthsList);

  if (historySeries.length < 3) {
    return {
      hasEnoughData: false,
      history: historySeries,
      forecast: [],
      confidence: {
        label: translate(t, "dashboardAnalytics.confidence.low"),
        tone: "neutral",
      },
    };
  }

  const incomeValues = historySeries.map((item) => item.income);
  const expenseValues = historySeries.map((item) => item.expense);

  const baseIncome = getWeightedAverage(incomeValues);
  const baseExpense = getWeightedAverage(expenseValues);
  const incomeTrendStep = getTrendStep(incomeValues);
  const expenseTrendStep = getTrendStep(expenseValues);

  const forecast = Array.from({ length: horizon }, (_, index) => {
    const monthOffset = index + 1;
    const income = Math.max(0, Math.round(baseIncome + incomeTrendStep * monthOffset * 0.5));
    const expense = Math.max(0, Math.round(baseExpense + expenseTrendStep * monthOffset * 0.5));

    return {
      month: shiftMonthISO(latestMonth, monthOffset),
      income,
      expense,
      balance: income - expense,
    };
  });

  const incomeVolatilityBase = Math.max(getWeightedAverage(incomeValues), 1);
  const expenseVolatilityBase = Math.max(getWeightedAverage(expenseValues), 1);
  const incomeVolatility = getAverageAbsoluteChange(incomeValues) / incomeVolatilityBase;
  const expenseVolatility = getAverageAbsoluteChange(expenseValues) / expenseVolatilityBase;
  const volatility = Math.max(incomeVolatility, expenseVolatility);

  let confidence = {
    label: translate(t, "dashboardAnalytics.confidence.high"),
    tone: "income",
  };

  if (historySeries.length < 5 || volatility > 0.45) {
    confidence = {
      label: translate(t, "dashboardAnalytics.confidence.medium"),
      tone: "primary",
    };
  }

  if (historySeries.length < 4 || volatility > 0.75) {
    confidence = {
      label: translate(t, "dashboardAnalytics.confidence.low"),
      tone: "neutral",
    };
  }

  const averageIncome = Math.round(getWeightedAverage(incomeValues));
  const averageExpense = Math.round(getWeightedAverage(expenseValues));
  const averageBalance = averageIncome - averageExpense;

  return {
    hasEnoughData: true,
    historyMonths: historySeries.length,
    history: historySeries,
    forecast,
    confidence,
    averageIncome,
    averageExpense,
    averageBalance,
  };
}
