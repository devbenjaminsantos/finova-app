import { useEffect, useMemo, useState } from "react";
import {
  createBudgetGoal,
  deleteBudgetGoal,
  getBudgetGoals,
  updateBudgetGoal,
} from "../../lib/api/budgetGoals";
import { EXPENSE_TRANSACTION_CATEGORIES } from "../../lib/constants/transactionCategories";
import { parseMoneyToCents } from "../../lib/format/currency";
import { useI18n } from "../../i18n/LanguageProvider";
import BudgetProgress from "../../components/ui/BudgetProgress";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import Metric from "../../components/ui/Metric";
import Modal from "../../components/ui/Modal";
import Toast from "../../components/ui/Toast";

function dispatchBudgetGoalsChange() {
  window.dispatchEvent(new Event("finova-budget-goals-change"));
}

function currentMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month, delta) {
  const [year, rawMonth] = month.split("-").map(Number);
  const date = new Date(year, rawMonth - 1, 1);
  date.setMonth(date.getMonth() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month, locale) {
  const [year, rawMonth] = month.split("-");
  const date = new Date(Number(year), Number(rawMonth) - 1, 1);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

function centsToInput(value) {
  if (!Number.isFinite(Number(value))) {
    return "";
  }

  return (Number(value) / 100).toFixed(2).replace(".", ",");
}

function normalizeCategory(value) {
  return value === "__overall__" ? "" : value;
}

function sortGoals(left, right) {
  if (!left.category && right.category) {
    return -1;
  }

  if (left.category && !right.category) {
    return 1;
  }

  return (left.category || "").localeCompare(right.category || "", "pt-BR");
}

function getGoalTone(progress) {
  if (progress >= 1) {
    return "danger";
  }

  if (progress >= 0.8) {
    return "warning";
  }

  return "safe";
}

function getGoalStatus(progress, t) {
  if (progress >= 1) {
    return t("dashboard.goalStatusExceeded");
  }

  if (progress >= 0.8) {
    return t("dashboard.goalStatusWarning");
  }

  return t("dashboard.goalStatusSafe");
}

function GoalCard({ goal, spentCents, onEdit, onDelete, isDeleting, t, formatCurrencyFromCents }) {
  const progress = goal.amountCents > 0 ? spentCents / goal.amountCents : 0;
  const tone = getGoalTone(progress);
  const percent = Math.round(progress * 100);
  const remaining = goal.amountCents - spentCents;

  return (
    <div className="finova-card-soft p-3 h-100">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="finova-title h6 mb-1">
            {goal.category || t("dashboard.goalOverallBudget")}
          </div>
          <div className={`finova-goal-pill finova-goal-pill-${tone}`}>
            {getGoalStatus(progress, t)}
          </div>
        </div>

        <div className="finova-actions-row finova-actions-row-end">
          <Button type="button" variant="secondary" className="btn-sm" onClick={() => onEdit(goal)}>
            {t("transactions.edit")}
          </Button>
          <Button type="button" variant="danger" className="btn-sm" onClick={() => onDelete(goal)} loading={isDeleting}>
            {isDeleting ? t("accounts.removing") : t("dashboard.goalDelete")}
          </Button>
        </div>
      </div>

      <div className="d-flex justify-content-between small mb-2">
        <span className="finova-subtitle">{t("dashboard.goalCurrentSpent")}</span>
        <strong>{formatCurrencyFromCents(spentCents)}</strong>
      </div>
      <div className="d-flex justify-content-between small mb-2">
        <span className="finova-subtitle">{t("dashboard.goalTarget")}</span>
        <strong>{formatCurrencyFromCents(goal.amountCents)}</strong>
      </div>
      <div className="d-flex justify-content-between small mb-3">
        <span className="finova-subtitle">
          {remaining >= 0 ? t("dashboard.goalAvailableBalance") : t("dashboard.goalOverage")}
        </span>
        <strong className={remaining >= 0 ? "" : "text-danger"}>
          {formatCurrencyFromCents(Math.abs(remaining))}
        </strong>
      </div>

      <BudgetProgress
        className="mb-2"
        label={t("dashboard.goalProgressConsumed", { percent })}
        progress={progress * 100}
        tone={tone}
      />

      <div className="small finova-subtitle">
        {t("dashboard.goalProgressConsumed", { percent })}
      </div>
    </div>
  );
}

export default function BudgetGoalsSection({ transactions }) {
  const { locale, t, formatCurrencyFromCents } = useI18n();
  const [month, setMonth] = useState(currentMonthISO);
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [goalPendingDelete, setGoalPendingDelete] = useState(null);
  const [category, setCategory] = useState("__overall__");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const availableCategories = useMemo(() => {
    const categorySet = new Set(EXPENSE_TRANSACTION_CATEGORIES);

    for (const transaction of transactions) {
      if (transaction.type === "expense" && transaction.category) {
        categorySet.add(transaction.category);
      }
    }

    return Array.from(categorySet).sort((a, b) => a.localeCompare(b, locale));
  }, [transactions, locale]);

  const monthlyExpenses = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.type === "expense" && (transaction.date || "").slice(0, 7) === month
      ),
    [transactions, month]
  );

  const spentByCategory = useMemo(() => {
    const totals = new Map();

    for (const transaction of monthlyExpenses) {
      const key = transaction.category || t("dashboard.goalOtherCategory");
      totals.set(key, (totals.get(key) || 0) + (Number(transaction.amountCents) || 0));
    }

    return totals;
  }, [monthlyExpenses, t]);

  const totalSpent = useMemo(
    () => monthlyExpenses.reduce((sum, item) => sum + (Number(item.amountCents) || 0), 0),
    [monthlyExpenses]
  );

  const overallGoal = useMemo(() => goals.find((goal) => !goal.category) || null, [goals]);
  const categoryGoals = useMemo(() => goals.filter((goal) => goal.category), [goals]);
  const categoryGoalSet = useMemo(
    () => new Set(categoryGoals.map((goal) => goal.category)),
    [categoryGoals]
  );

  const categoriesWithExpenses = useMemo(
    () =>
      Array.from(spentByCategory.entries())
        .filter(([, value]) => value > 0)
        .map(([goalCategory]) => goalCategory)
        .sort((a, b) => a.localeCompare(b, locale)),
    [spentByCategory, locale]
  );

  const uncoveredCategorySuggestions = useMemo(
    () =>
      Array.from(spentByCategory.entries())
        .filter(([goalCategory, value]) => value > 0 && !categoryGoalSet.has(goalCategory))
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([goalCategory, spentCents]) => ({ category: goalCategory, spentCents })),
    [spentByCategory, categoryGoalSet]
  );

  const categoriesOverLimitCount = useMemo(
    () =>
      categoryGoals.filter((goal) => (spentByCategory.get(goal.category) || 0) >= goal.amountCents)
        .length,
    [categoryGoals, spentByCategory]
  );

  useEffect(() => {
    let active = true;

    async function loadGoals() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getBudgetGoals(month);

        if (active) {
          setGoals(Array.isArray(data) ? [...data].sort(sortGoals) : []);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || t("dashboard.goalsLoadError"));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadGoals();

    return () => {
      active = false;
    };
  }, [month, t]);

  function resetForm() {
    setEditingGoalId(null);
    setCategory("__overall__");
    setAmount("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");

    const amountCents = parseMoneyToCents(amount);

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError(t("dashboard.goalValidationAmount"));
      return;
    }

    const payload = {
      month,
      category: normalizeCategory(category) || null,
      amountCents,
    };

    setIsSaving(true);

    try {
      if (editingGoalId) {
        const updated = await updateBudgetGoal(editingGoalId, payload);
        setGoals((current) =>
          current.map((goal) => (goal.id === editingGoalId ? updated : goal)).sort(sortGoals)
        );
        setFeedback(t("dashboard.goalUpdated"));
      } else {
        const created = await createBudgetGoal(payload);
        setGoals((current) => [...current, created].sort(sortGoals));
        setFeedback(t("dashboard.goalCreated"));
      }

      dispatchBudgetGoalsChange();
      resetForm();
    } catch (requestError) {
      setError(requestError.message || t("dashboard.goalSaveError"));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(goal) {
    setEditingGoalId(goal.id);
    setCategory(goal.category || "__overall__");
    setAmount(centsToInput(goal.amountCents));
    setError("");
    setFeedback("");
  }

  function handleCancelEdit() {
    resetForm();
    setError("");
    setFeedback("");
  }

  async function handleDelete(id) {
    setDeletingId(id);
    setError("");
    setFeedback("");

    try {
      await deleteBudgetGoal(id);
      setGoals((current) => current.filter((goal) => goal.id !== id));
      dispatchBudgetGoalsChange();

      if (editingGoalId === id) {
        handleCancelEdit();
      }

      setFeedback(t("dashboard.goalDeleted"));
    } catch (requestError) {
      setError(requestError.message || t("dashboard.goalDeleteError"));
    } finally {
      setDeletingId(null);
      setGoalPendingDelete(null);
    }
  }

  function handlePickSuggestedCategory(nextCategory) {
    setCategory(nextCategory);
    setEditingGoalId(null);
    setError("");
    setFeedback("");
  }

  const monthLabel = formatMonthLabel(month, locale);
  const currentMonth = currentMonthISO();
  const isCurrentMonth = month === currentMonth;

  return (
    <div className="finova-budget-goals-section">
      <div className="d-flex flex-column flex-xl-row justify-content-between align-items-xl-end gap-3 mb-4">
        <div>
          <h2 className="finova-title h4 mb-1">{t("dashboard.goalsTitle")}</h2>
          <p className="finova-subtitle mb-0">{t("dashboard.goalsSubtitle")}</p>
        </div>

        <div className="finova-actions-row align-items-center">
          <button
            type="button"
            className="btn finova-btn-light"
            onClick={() => setMonth((currentValue) => shiftMonth(currentValue, -1))}
          >
            {t("dashboard.previousMonth")}
          </button>
          <div className="finova-goal-summary text-center">
            <span className="finova-subtitle small d-block">{t("dashboard.focusMonth")}</span>
            <strong className="text-capitalize">{monthLabel}</strong>
          </div>
          <button
            type="button"
            className="btn finova-btn-light"
            onClick={() => setMonth((currentValue) => shiftMonth(currentValue, 1))}
          >
            {t("dashboard.nextMonth")}
          </button>
          {!isCurrentMonth ? (
            <button
              type="button"
              className="btn finova-btn-light"
              onClick={() => setMonth(currentMonth)}
            >
              {t("dashboard.backToCurrentMonth")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-3">
          <Metric
            className="finova-card-soft p-3 h-100"
            label={t("dashboard.summarySpentMonth")}
            value={formatCurrencyFromCents(totalSpent)}
            helper={t("dashboard.summarySpentMonthHelp")}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <Metric
            className="finova-card-soft p-3 h-100"
            label={t("dashboard.summaryGoalCategories")}
            value={String(categoryGoals.length)}
            helper={t("dashboard.summaryGoalCategoriesHelp")}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <Metric
            className="finova-card-soft p-3 h-100"
            label={t("dashboard.summaryWithoutGoal")}
            value={String(Math.max(categoriesWithExpenses.length - categoryGoals.length, 0))}
            helper={t("dashboard.summaryWithoutGoalHelp")}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <Metric
            className="finova-card-soft p-3 h-100"
            label={t("dashboard.summaryGoalsAtRisk")}
            value={String(categoriesOverLimitCount)}
            helper={t("dashboard.summaryGoalsAtRiskHelp")}
          />
        </div>
      </div>

      {uncoveredCategorySuggestions.length > 0 ? (
        <div className="finova-card-soft p-3 mb-4">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div>
              <h3 className="finova-title h6 mb-1">{t("dashboard.suggestionsTitle")}</h3>
              <p className="finova-subtitle mb-0">
                {t("dashboard.suggestionsSubtitle", { month: monthLabel })}
              </p>
            </div>

            <div className="finova-suggestion-list">
              {uncoveredCategorySuggestions.map((item) => (
                <button
                  key={item.category}
                  type="button"
                  className="btn finova-goal-suggestion"
                  onClick={() => handlePickSuggestedCategory(item.category)}
                >
                  <span>{item.category}</span>
                  <strong>{formatCurrencyFromCents(item.spentCents)}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <form className="row g-3 mb-4" onSubmit={handleSubmit}>
        <div className="col-12 col-lg-5">
          <label className="form-label text-dark fw-medium" htmlFor="budget-goal-category">
            {t("common.category")}
          </label>
          <select
            id="budget-goal-category"
            className="form-select finova-select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={isSaving}
          >
            <option value="__overall__">{t("dashboard.goalOverallBudgetMonth")}</option>
            {availableCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="col-12 col-lg-4">
          <label className="form-label text-dark fw-medium" htmlFor="budget-goal-amount">
            {t("dashboard.goalAmountLabel")}
          </label>
          <input
            id="budget-goal-amount"
            type="text"
            className="form-control finova-input"
            placeholder={t("dashboard.goalAmountPlaceholder")}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            disabled={isSaving}
          />
        </div>

        <div className="col-12 col-lg-3 d-flex align-items-end gap-2">
          <button
            type="submit"
            className="btn finova-btn-primary flex-grow-1"
            disabled={isSaving}
          >
            {isSaving
              ? t("dashboard.goalSaving")
              : editingGoalId
                ? t("dashboard.goalSaveButton")
                : t("dashboard.goalAddButton")}
          </button>

          {editingGoalId ? (
            <button
              type="button"
              className="btn finova-btn-light"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </button>
          ) : null}
        </div>
      </form>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {feedback ? (
        <Toast tone="success" dismissLabel={t("transactions.close")} onDismiss={() => setFeedback("")}>
          {feedback}
        </Toast>
      ) : null}

      {isLoading ? (
        <div className="finova-subtitle">{t("dashboard.goalsLoading")}</div>
      ) : (
        <>
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
              <div>
                <h3 className="finova-title h5 mb-1">{t("dashboard.overviewTitle")}</h3>
                <p className="finova-subtitle mb-0">{t("dashboard.overviewSubtitle")}</p>
              </div>
            </div>

            {overallGoal ? (
              <GoalCard
                goal={overallGoal}
                spentCents={totalSpent}
                onEdit={handleEdit}
                onDelete={setGoalPendingDelete}
                isDeleting={deletingId === overallGoal.id}
                t={t}
                formatCurrencyFromCents={formatCurrencyFromCents}
              />
            ) : (
              <EmptyState
                className="finova-card-soft p-4"
                titleAs="h4"
                title={t("dashboard.overviewEmptyTitle", { month: monthLabel })}
                description={t("dashboard.overviewEmptySubtitle")}
              />
            )}
          </div>

          <div>
            <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
              <div>
                <h3 className="finova-title h5 mb-1">{t("dashboard.categoryGoalsTitle")}</h3>
                <p className="finova-subtitle mb-0">{t("dashboard.categoryGoalsSubtitle")}</p>
              </div>
              <span className="finova-badge-primary">
                {t("dashboard.categoryGoalsConfigured", { count: categoryGoals.length })}
              </span>
            </div>

            {categoryGoals.length === 0 ? (
              <EmptyState
                className="finova-card-soft p-4"
                titleAs="h4"
                title={t("dashboard.categoryGoalsEmptyTitle")}
                description={t("dashboard.categoryGoalsEmptySubtitle")}
              />
            ) : (
              <div className="row g-3">
                {categoryGoals.map((goal) => (
                  <div className="col-12 col-xl-6" key={goal.id}>
                    <GoalCard
                      goal={goal}
                      spentCents={spentByCategory.get(goal.category) || 0}
                      onEdit={handleEdit}
                      onDelete={setGoalPendingDelete}
                      isDeleting={deletingId === goal.id}
                      t={t}
                      formatCurrencyFromCents={formatCurrencyFromCents}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <Modal
        isOpen={Boolean(goalPendingDelete)}
        onClose={() => setGoalPendingDelete(null)}
        dismissible={!deletingId}
        title={t("dashboard.goalDelete")}
        closeLabel={t("transactions.close")}
        footer={(
          <div className="finova-actions-row finova-actions-row-end w-100">
            <Button type="button" variant="secondary" onClick={() => setGoalPendingDelete(null)} disabled={Boolean(deletingId)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="danger" loading={Boolean(deletingId)} onClick={() => handleDelete(goalPendingDelete.id)}>
              {t("dashboard.goalDelete")}
            </Button>
          </div>
        )}
      >
        <p className="finova-subtitle mb-0">{t("dashboard.goalDeleteConfirm")}</p>
      </Modal>
    </div>
  );
}
