import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTransaction,
  deleteInstallmentGroup,
  deleteTransaction,
  getInstallmentPlans,
  getRecurringRules,
  getTransactions,
  importTransactions,
  updateInstallmentGroup,
  updateTransaction,
} from "../../lib/api/transactions";
import { hasValidSession } from "../../lib/api/auth";
import { TransactionsContext } from "./TransactionsContext";

export function TransactionsProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [installmentPlans, setInstallmentPlans] = useState([]);
  const [recurringRules, setRecurringRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!hasValidSession()) {
      setTransactions([]);
      setInstallmentPlans([]);
      setRecurringRules([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [transactionResult, installmentPlanResult, recurringRuleResult] =
        await Promise.allSettled([
          getTransactions(),
          getInstallmentPlans(),
          getRecurringRules(),
        ]);

      if (transactionResult.status === "fulfilled") {
        setTransactions(Array.isArray(transactionResult.value) ? transactionResult.value : []);
      } else {
        console.error("Erro ao carregar transações:", transactionResult.reason);
        setTransactions([]);
      }

      if (installmentPlanResult.status === "fulfilled") {
        setInstallmentPlans(
          Array.isArray(installmentPlanResult.value) ? installmentPlanResult.value : []
        );
      } else {
        console.error("Erro ao carregar parcelamentos:", installmentPlanResult.reason);
        setInstallmentPlans([]);
      }

      if (recurringRuleResult.status === "fulfilled") {
        setRecurringRules(Array.isArray(recurringRuleResult.value) ? recurringRuleResult.value : []);
      } else {
        console.error("Erro ao carregar recorrências:", recurringRuleResult.reason);
        setRecurringRules([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    function handleSessionChange() {
      loadAll();
    }

    window.addEventListener("finova-session-change", handleSessionChange);

    return () => {
      window.removeEventListener("finova-session-change", handleSessionChange);
    };
  }, [loadAll]);

  const addTransaction = useCallback(
    async (data) => {
      await createTransaction(data);
      await loadAll();
    },
    [loadAll]
  );

  const importTransactionsBatch = useCallback(
    async (payload) => {
      const result = await importTransactions(payload);
      await loadAll();
      return result;
    },
    [loadAll]
  );

  const removeTransaction = useCallback(
    async (id) => {
      await deleteTransaction(id);
      await loadAll();
    },
    [loadAll]
  );

  const removeInstallmentGroup = useCallback(async (installmentGroupId) => {
    await deleteInstallmentGroup(installmentGroupId);
    setTransactions((current) =>
      current.filter((transaction) => transaction.installmentGroupId !== installmentGroupId)
    );
    setInstallmentPlans((current) => current.filter((plan) => plan.id !== installmentGroupId));
  }, []);

  const updateInstallmentGroupItem = useCallback(
    async (installmentGroupId, data) => {
      await updateInstallmentGroup(installmentGroupId, data);
      await loadAll();
    },
    [loadAll]
  );

  const updateTransactionItem = useCallback(async (id, data) => {
    const updated = await updateTransaction(id, data);
    setTransactions((current) =>
      current.map((transaction) => (transaction.id === id ? updated : transaction))
    );
  }, []);

  const summary = useMemo(() => {
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
  }, [transactions]);

  const value = useMemo(
    () => ({
      transactions,
      installmentPlans,
      recurringRules,
      isLoading,
      loadAll,
      addTransaction,
      importTransactions: importTransactionsBatch,
      removeTransaction,
      removeInstallmentGroup,
      updateTransaction: updateTransactionItem,
      updateInstallmentGroup: updateInstallmentGroupItem,
      summary,
    }),
    [
      transactions,
      installmentPlans,
      recurringRules,
      isLoading,
      loadAll,
      addTransaction,
      importTransactionsBatch,
      removeTransaction,
      removeInstallmentGroup,
      updateTransactionItem,
      updateInstallmentGroupItem,
      summary,
    ]
  );

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}
