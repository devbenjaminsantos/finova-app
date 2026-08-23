import { useEffect, useMemo, useState } from "react";
import InstallmentGroupModal from "../features/transactions/components/InstallmentGroupModal";
import TransactionImportModal from "../features/transactions/components/TransactionImportModal";
import TransactionModal from "../features/transactions/components/TransactionModal";
import TransactionsFilters from "../features/transactions/components/TransactionsFilters";
import TransactionsTable from "../features/transactions/components/TransactionsTable";
import { useTransactions } from "../features/transactions/useTransactions";
import { getFinancialAccounts } from "../lib/api/financialAccounts";
import { getTransactionCategories } from "../lib/constants/transactionCategories";
import { downloadCsv } from "../lib/export/csv";
import { exportTransactionsToPdf } from "../lib/export/pdf";
import { formatFinancialAccountLabel } from "../lib/financialAccounts/presentation";
import { loadJSON, saveJSON } from "../lib/storage/jsonStorage";
import { useI18n } from "../i18n/LanguageProvider";

const FILTERS_KEY = "fd_tx_filters_v1";

function applyTransactionFilters(
  list,
  { q, accountFilter, tagFilter, typeFilter, categoryFilter, month, sortBy }
) {
  let next = [...list];

  if (q.trim()) {
    const search = q.trim().toLowerCase();
    next = next.filter(
      (transaction) =>
        (transaction.description || "").toLowerCase().includes(search) ||
        (transaction.tagNames || []).some((tagName) => tagName.toLowerCase().includes(search))
    );
  }

  if (tagFilter !== "all") {
    next = next.filter((transaction) => (transaction.tagNames || []).includes(tagFilter));
  }

  if (accountFilter === "unassigned") {
    next = next.filter((transaction) => transaction.financialAccountId == null);
  } else if (accountFilter !== "all") {
    next = next.filter((transaction) => String(transaction.financialAccountId) === accountFilter);
  }

  if (typeFilter !== "all") {
    next = next.filter((transaction) => transaction.type === typeFilter);
  }

  if (categoryFilter !== "all") {
    next = next.filter((transaction) => transaction.category === categoryFilter);
  }

  if (month) {
    next = next.filter((transaction) => (transaction.date || "").startsWith(month));
  }

  switch (sortBy) {
    case "date_asc":
      next.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      break;
    case "amount_desc":
      next.sort((a, b) => (Number(b.amountCents) || 0) - (Number(a.amountCents) || 0));
      break;
    case "amount_asc":
      next.sort((a, b) => (Number(a.amountCents) || 0) - (Number(b.amountCents) || 0));
      break;
    case "date_desc":
    default:
      next.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      break;
  }

  return next;
}

export default function Transactions() {
  const { t, formatCurrencyFromCents, formatDate, locale } = useI18n();
  const {
    transactions,
    installmentPlans = [],
    recurringRules = [],
    addTransaction,
    importTransactions,
    removeTransaction,
    removeInstallmentGroup,
    updateTransaction,
    updateInstallmentGroup,
    isLoading,
  } = useTransactions();

  const saved = useMemo(
    () =>
      loadJSON(FILTERS_KEY, {
        q: "",
        accountFilter: "all",
        tagFilter: "all",
        typeFilter: "all",
        categoryFilter: "all",
        month: "",
        sortBy: "date_desc",
      }),
    []
  );

  const [q, setQ] = useState(() => saved.q);
  const [accountFilter, setAccountFilter] = useState(() => saved.accountFilter ?? "all");
  const [tagFilter, setTagFilter] = useState(() => saved.tagFilter ?? "all");
  const [typeFilter, setTypeFilter] = useState(() => saved.typeFilter);
  const [categoryFilter, setCategoryFilter] = useState(() => saved.categoryFilter);
  const [month, setMonth] = useState(() => saved.month);
  const [sortBy, setSortBy] = useState(() => saved.sortBy);
  const [isOpen, setIsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [selected, setSelected] = useState(null);
  const [selectedInstallmentGroup, setSelectedInstallmentGroup] = useState(null);
  const [isMutating, setIsMutating] = useState(false);
  const [importFeedback, setImportFeedback] = useState("");
  const [highlightImportedSince, setHighlightImportedSince] = useState("");
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    saveJSON(FILTERS_KEY, { q, accountFilter, tagFilter, typeFilter, categoryFilter, month, sortBy });
  }, [q, accountFilter, tagFilter, typeFilter, categoryFilter, month, sortBy]);

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      try {
        const data = await getFinancialAccounts();

        if (active) {
          setAccounts(
            (Array.isArray(data) ? data : []).map((account) => ({
              ...account,
              label: formatFinancialAccountLabel(account, {
                fallbackName: t("accounts.fallbackAccountName"),
                endingLabel: t("accounts.endingLabel"),
              }),
            }))
          );
        }
      } catch {
        if (active) {
          setAccounts([]);
        }
      }
    }

    loadAccounts();

    return () => {
      active = false;
    };
  }, [t]);

  const categories = useMemo(() => {
    const baseCategories =
      typeFilter === "all"
        ? [...getTransactionCategories("expense"), ...getTransactionCategories("income")]
        : getTransactionCategories(typeFilter);

    const set = new Set(baseCategories);

    for (const transaction of transactions) {
      if (!transaction.category) {
        continue;
      }

      if (typeFilter === "all" || transaction.type === typeFilter) {
        set.add(transaction.category);
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions, typeFilter]);

  const tags = useMemo(() => {
    const set = new Set();

    for (const transaction of transactions) {
      for (const tagName of transaction.tagNames || []) {
        set.add(tagName);
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const accountLabelsById = useMemo(() => {
    return accounts.reduce((map, account) => {
      map[String(account.id)] = account.label;
      return map;
    }, {});
  }, [accounts]);

  useEffect(() => {
    if (categoryFilter !== "all" && !categories.includes(categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categories, categoryFilter]);

  useEffect(() => {
    if (tagFilter !== "all" && !tags.includes(tagFilter)) {
      setTagFilter("all");
    }
  }, [tagFilter, tags]);

  const filtered = useMemo(
    () =>
      applyTransactionFilters(transactions, {
        q,
        accountFilter,
        tagFilter,
        typeFilter,
        categoryFilter,
        month,
        sortBy,
      }),
    [transactions, q, accountFilter, tagFilter, typeFilter, categoryFilter, month, sortBy]
  );

  const filteredWithAccountLabels = useMemo(
    () =>
      filtered.map((transaction) => ({
        ...transaction,
        financialAccountLabel:
          transaction.financialAccountId != null
            ? accountLabelsById[String(transaction.financialAccountId)] ||
              t("transactions.selectedAccountFallback")
            : t("transactions.unlinkedAccount"),
      })),
    [filtered, accountLabelsById, t]
  );

  const installmentGroups = useMemo(() => {
    if (typeFilter === "income") {
      return [];
    }

    let list = [...installmentPlans];

    if (q.trim()) {
      const search = q.trim().toLowerCase();
      list = list.filter(
        (plan) =>
          (plan.description || "").toLowerCase().includes(search) ||
          (plan.tagNames || []).some((tagName) => tagName.toLowerCase().includes(search))
      );
    }

    if (tagFilter !== "all") {
      list = list.filter((plan) => (plan.tagNames || []).includes(tagFilter));
    }

    if (categoryFilter !== "all") {
      list = list.filter((plan) => plan.category === categoryFilter);
    }

    return list.sort((a, b) => (a.description || "").localeCompare(b.description || ""));
  }, [installmentPlans, q, tagFilter, typeFilter, categoryFilter]);

  const installmentOverview = useMemo(() => {
    return installmentGroups.reduce(
      (accumulator, group) => {
        const nextInstallmentAmount =
          group.nextInstallmentDate && group.nextInstallmentIndex
            ? Number(group.amountPerInstallmentCents) || 0
            : 0;

        return {
          openPlans: accumulator.openPlans + 1,
          remainingAmountCents:
            accumulator.remainingAmountCents + (Number(group.remainingAmountCents) || 0),
          upcomingInstallments:
            accumulator.upcomingInstallments + (Number(group.upcomingInstallments) || 0),
          nextInstallmentsAmountCents:
            accumulator.nextInstallmentsAmountCents + nextInstallmentAmount,
        };
      },
      {
        openPlans: 0,
        remainingAmountCents: 0,
        upcomingInstallments: 0,
        nextInstallmentsAmountCents: 0,
      }
    );
  }, [installmentGroups]);

  const visibleRecurringRules = useMemo(() => {
    let list = [...recurringRules];

    if (q.trim()) {
      const search = q.trim().toLowerCase();
      list = list.filter(
        (rule) =>
          (rule.description || "").toLowerCase().includes(search) ||
          (rule.tagNames || []).some((tagName) => tagName.toLowerCase().includes(search))
      );
    }

    if (tagFilter !== "all") {
      list = list.filter((rule) => (rule.tagNames || []).includes(tagFilter));
    }

    if (typeFilter !== "all") {
      list = list.filter((rule) => rule.type === typeFilter);
    }

    if (categoryFilter !== "all") {
      list = list.filter((rule) => rule.category === categoryFilter);
    }

    return list.sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return (left.nextOccurrenceDate || "9999-12-31").localeCompare(
        right.nextOccurrenceDate || "9999-12-31"
      );
    });
  }, [recurringRules, q, tagFilter, typeFilter, categoryFilter]);

  const recurringOverview = useMemo(() => {
    return visibleRecurringRules.reduce(
      (accumulator, rule) => ({
        activeRules: accumulator.activeRules + (rule.isActive ? 1 : 0),
        nextMonthAmountCents:
          accumulator.nextMonthAmountCents +
          (rule.isActive && rule.nextOccurrenceDate ? Number(rule.amountCents) || 0 : 0),
      }),
      {
        activeRules: 0,
        nextMonthAmountCents: 0,
      }
    );
  }, [visibleRecurringRules]);

  function openCreate() {
    if (isMutating) {
      return;
    }

    setMode("create");
    setSelected(null);
    setIsOpen(true);
  }

  function openEdit(transaction) {
    if (isMutating) {
      return;
    }

    setMode("edit");
    setSelected(transaction);
    setIsOpen(true);
  }

  function openImport() {
    if (isMutating) {
      return;
    }

    setImportFeedback("");
    setIsImportOpen(true);
  }

  function closeModal() {
    setIsOpen(false);
  }

  function closeImport() {
    setIsImportOpen(false);
  }

  function openInstallmentGroupEdit(group) {
    if (isMutating) {
      return;
    }

    setSelectedInstallmentGroup(group);
  }

  function closeInstallmentGroupEdit() {
    setSelectedInstallmentGroup(null);
  }

  async function handleSubmit(data) {
    setIsMutating(true);

    try {
      if (mode === "edit" && selected) {
        await updateTransaction(selected.id, data);
      } else {
        await addTransaction(data);
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function handleImportSubmit(items) {
    setIsMutating(true);

    try {
      const result = await importTransactions(items);
      const importedCount = Number(result?.importedCount) || 0;
      const importLabel = items.importFormat?.toUpperCase() || "CSV";
      const importStartedAt = new Date().toISOString();

      setImportFeedback(
        importedCount > 0
          ? importedCount === 1
            ? t("pages.importSuccessSingle", { format: importLabel })
            : t("pages.importSuccessPlural", { count: importedCount, format: importLabel })
          : t("pages.importNoNew", { format: importLabel })
      );
      setHighlightImportedSince(importedCount > 0 ? importStartedAt : "");

      return result;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemove(id) {
    if (!window.confirm(t("pages.removeTransactionConfirm"))) {
      return;
    }

    setIsMutating(true);

    try {
      await removeTransaction(id);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSubmitInstallmentGroup(data) {
    if (!selectedInstallmentGroup?.id) {
      return;
    }

    setIsMutating(true);

    try {
      await updateInstallmentGroup(selectedInstallmentGroup.id, data);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRemoveInstallmentGroup(installmentGroupId) {
    if (!window.confirm(t("pages.removeInstallmentGroupConfirm"))) {
      return;
    }

    setIsMutating(true);

    try {
      await removeInstallmentGroup(installmentGroupId);
    } finally {
      setIsMutating(false);
    }
  }

  function resetFilters() {
    setQ("");
    setAccountFilter("all");
    setTagFilter("all");
    setTypeFilter("all");
    setCategoryFilter("all");
    setMonth("");
    setSortBy("date_desc");

    saveJSON(FILTERS_KEY, {
      q: "",
      accountFilter: "all",
      tagFilter: "all",
      typeFilter: "all",
      categoryFilter: "all",
      month: "",
      sortBy: "date_desc",
    });
  }

  function getExportRows() {
    return filtered.map((transaction) => [
      formatDate(transaction.date),
      transaction.description || "",
      transaction.category || t("transactions.noCategory"),
      (transaction.tagNames || []).join(", "),
      transaction.type === "income" ? t("transactions.income") : t("transactions.expense"),
      formatCurrencyFromCents(transaction.amountCents),
      Number(transaction.amountCents) || 0,
    ]);
  }

  function exportFilteredTransactionsCsv() {
    const rows = [
      [
        t("common.date"),
        t("common.description"),
        t("common.category"),
        t("common.tags"),
        t("common.type"),
        t("common.value"),
        t("transactions.exportAmountCents"),
      ],
      ...getExportRows(),
    ];

    const monthLabel = month || t("transactions.exportAllPeriodsFilename");
    downloadCsv(`finova-transacoes-${monthLabel}.csv`, rows);
  }

  function exportFilteredTransactionsPdf() {
    const monthLabel = month || t("transactions.exportAllPeriodsFilename");

    exportTransactionsToPdf({
      filename: `finova-transacoes-${monthLabel}.pdf`,
      title: t("pages.transactionsTitle"),
      subtitle: month
        ? t("transactions.exportSubtitleFiltered", {
            month,
            count: filtered.length,
          })
        : t("transactions.exportSubtitleAll", {
            count: filtered.length,
          }),
      columns: [
        t("common.date"),
        t("common.description"),
        t("common.category"),
        t("common.type"),
        t("common.value"),
      ],
      rows: filtered.map((transaction) => [
        formatDate(transaction.date),
        transaction.description || "",
        transaction.category || t("transactions.noCategory"),
        transaction.type === "income" ? t("transactions.income") : t("transactions.expense"),
        formatCurrencyFromCents(transaction.amountCents),
      ]),
      emptyMessage: t("transactions.pdfEmpty"),
      generatedAtLabel: t("transactions.pdfGeneratedAt"),
      pageLabel: t("transactions.pdfPage"),
      pageOfLabel: t("transactions.pdfOf"),
      locale,
    });
  }

  return (
    <section className="finova-section-space">
      <div className="finova-page-header">
        <div className="finova-page-header-copy">
          <h1 className="finova-title">{t("pages.transactionsTitle")}</h1>
          <p className="finova-subtitle mb-0">{t("pages.transactionsSubtitle")}</p>
        </div>

        <div className="finova-page-header-actions">
          <button className="btn finova-btn-light px-4" onClick={openImport} disabled={isMutating}>
            {t("pages.importFile")}
          </button>

          <button
            className="btn finova-btn-primary px-4"
            onClick={openCreate}
            disabled={isMutating}
          >
            {t("pages.newTransaction")}
          </button>
        </div>
      </div>

      <div className="finova-page-note mb-4">{t("pages.transactionsPageNote")}</div>

      <TransactionModal
        mode={mode}
        isOpen={isOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        initial={selected}
        accounts={accounts}
      />

      <InstallmentGroupModal
        isOpen={Boolean(selectedInstallmentGroup)}
        onClose={closeInstallmentGroupEdit}
        onSubmit={handleSubmitInstallmentGroup}
        initial={selectedInstallmentGroup}
      />

      <TransactionImportModal
        isOpen={isImportOpen}
        onClose={closeImport}
        onImport={handleImportSubmit}
        existingTransactions={transactions}
        accounts={accounts}
      />

      <TransactionsFilters
        q={q}
        setQ={setQ}
        accountFilter={accountFilter}
        setAccountFilter={setAccountFilter}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        month={month}
        setMonth={setMonth}
        sortBy={sortBy}
        setSortBy={setSortBy}
        categories={categories}
        tags={tags}
        accounts={accounts}
        onReset={resetFilters}
      />

      {visibleRecurringRules.length > 0 ? (
        <div className="finova-card p-4 mb-4">
          <div className="mb-3">
            <h2 className="finova-title h5 mb-1">{t("transactions.recurringRulesTitle")}</h2>
            <p className="finova-subtitle small mb-0">
              {t("transactions.recurringRulesSubtitle")}
            </p>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-6">
              <div className="finova-card-soft p-3 h-100">
                <div className="finova-subtitle small mb-1">
                  {t("transactions.recurringRulesActiveLabel")}
                </div>
                <div className="finova-title h5 mb-1">{recurringOverview.activeRules}</div>
                <div className="finova-subtitle small mb-0">
                  {t("transactions.recurringRulesActiveHelp")}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="finova-card-soft p-3 h-100">
                <div className="finova-subtitle small mb-1">
                  {t("transactions.recurringRulesNextAmountLabel")}
                </div>
                <div className="finova-title h5 mb-1">
                  {formatCurrencyFromCents(recurringOverview.nextMonthAmountCents)}
                </div>
                <div className="finova-subtitle small mb-0">
                  {t("transactions.recurringRulesNextAmountHelp")}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            {visibleRecurringRules.map((rule) => (
              <div key={rule.id} className="col-12 col-xl-6">
                <div className="finova-card-soft p-3 h-100">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <div className="finova-title h6 mb-0">{rule.description}</div>
                    <span
                      className={rule.isActive ? "finova-badge-income" : "finova-badge-neutral"}
                    >
                      {rule.isActive
                        ? t("transactions.recurringRuleActive")
                        : t("transactions.recurringRuleFinished")}
                    </span>
                  </div>

                  <div className="finova-subtitle small mb-3">{rule.category}</div>

                  <div className="row g-3">
                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.recurringRuleAmount")}
                      </div>
                      <div className="fw-semibold">
                        {formatCurrencyFromCents(rule.amountCents)}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.recurringRuleType")}
                      </div>
                      <div className="fw-semibold">
                        {rule.type === "income"
                          ? t("transactions.income")
                          : t("transactions.expense")}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.recurringRuleNext")}
                      </div>
                      <div className="fw-semibold">
                        {rule.nextOccurrenceDate
                          ? formatDate(rule.nextOccurrenceDate)
                          : t("transactions.recurringRuleNoNext")}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.recurringRuleEnd")}
                      </div>
                      <div className="fw-semibold">{formatDate(rule.endDate)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {installmentGroups.length > 0 ? (
        <div className="finova-card p-4 mb-4">
          <div className="mb-3">
            <h2 className="finova-title h5 mb-1">{t("transactions.installmentPlansTitle")}</h2>
            <p className="finova-subtitle small mb-0">
              {t("transactions.installmentPlansSubtitle")}
            </p>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-12 col-lg-4">
              <div className="finova-card-soft p-3 h-100">
                <div className="finova-subtitle small mb-1">
                  {t("transactions.installmentOpenDebtLabel")}
                </div>
                <div className="finova-title h5 mb-1">
                  {formatCurrencyFromCents(installmentOverview.remainingAmountCents)}
                </div>
                <div className="finova-subtitle small mb-0">
                  {t("transactions.installmentOpenDebtHelp")}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="finova-card-soft p-3 h-100">
                <div className="finova-subtitle small mb-1">
                  {t("transactions.installmentOpenPlansLabel")}
                </div>
                <div className="finova-title h5 mb-1">{installmentOverview.openPlans}</div>
                <div className="finova-subtitle small mb-0">
                  {t("transactions.installmentOpenPlansHelp")}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="finova-card-soft p-3 h-100">
                <div className="finova-subtitle small mb-1">
                  {t("transactions.installmentNextBillsLabel")}
                </div>
                <div className="finova-title h5 mb-1">
                  {formatCurrencyFromCents(installmentOverview.nextInstallmentsAmountCents)}
                </div>
                <div className="finova-subtitle small mb-0">
                  {t("transactions.installmentNextBillsHelp", {
                    count: installmentOverview.upcomingInstallments,
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            {installmentGroups.map((group) => (
              <div key={group.id} className="col-12 col-xl-6">
                <div className="finova-card-soft p-3 h-100">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                    <div className="finova-title h6 mb-0">{group.description}</div>
                    <span className="finova-badge-warning">
                      {t("transactions.installmentBadge", {
                        index: `${group.postedInstallments}/${group.installmentCount}`,
                      })}
                    </span>
                  </div>

                  <div className="finova-subtitle small mb-3">{group.category}</div>

                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center gap-3 small mb-2">
                      <span className="finova-subtitle">
                        {t("transactions.installmentProgress")}
                      </span>
                      <span className="fw-semibold">
                        {Math.round(
                          ((Number(group.paidAmountCents) || 0) /
                            Math.max(Number(group.totalAmountCents) || 1, 1)) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="finova-progress">
                      <div
                        className="finova-progress-bar"
                        style={{
                          width: `${Math.round(
                            ((Number(group.paidAmountCents) || 0) /
                              Math.max(Number(group.totalAmountCents) || 1, 1)) *
                              100
                          )}%`,
                          background:
                            "linear-gradient(90deg, var(--brand), var(--brand-strong, #0f766e))",
                        }}
                      />
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.installmentTotal")}
                      </div>
                      <div className="fw-semibold">
                        {formatCurrencyFromCents(group.totalAmountCents)}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.installmentPaid")}
                      </div>
                      <div className="fw-semibold">
                        {formatCurrencyFromCents(group.paidAmountCents)}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.installmentRemainingLabel")}
                      </div>
                      <div className="fw-semibold">
                        {formatCurrencyFromCents(group.remainingAmountCents)}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.installmentRemainingCount")}
                      </div>
                      <div className="fw-semibold">
                        {t("transactions.installmentRemainingCountValue", {
                          count: group.remainingInstallments,
                        })}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.installmentUpcomingCount")}
                      </div>
                      <div className="fw-semibold">
                        {t("transactions.installmentRemainingCountValue", {
                          count: group.upcomingInstallments,
                        })}
                      </div>
                    </div>

                    <div className="col-6">
                      <div className="finova-subtitle small mb-1">
                        {t("transactions.installmentNextDue")}
                      </div>
                      <div className="fw-semibold">
                        {group.nextInstallmentDate
                          ? t("transactions.installmentNextDueValue", {
                              index: group.nextInstallmentIndex,
                              date: formatDate(group.nextInstallmentDate),
                            })
                          : t("transactions.installmentFullyPosted")}
                      </div>
                    </div>
                  </div>

                  <div className="finova-actions-row finova-actions-row-end pt-3">
                    <button
                      type="button"
                      className="btn finova-btn-light btn-sm"
                      onClick={() => openInstallmentGroupEdit(group)}
                      disabled={isMutating}
                    >
                      {t("transactions.editInstallmentPlan")}
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleRemoveInstallmentGroup(group.id)}
                      disabled={isMutating}
                    >
                      {t("transactions.removeInstallmentPlan")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        {importFeedback ? (
          <div className="alert alert-success mb-4 finova-status-banner" role="status">
            {importFeedback}
          </div>
        ) : null}

        <TransactionsTable
          transactions={filteredWithAccountLabels}
          totalTransactionsCount={transactions.length}
          onEdit={openEdit}
          onRemove={handleRemove}
          onExportCsv={exportFilteredTransactionsCsv}
          onExportPdf={exportFilteredTransactionsPdf}
          highlightImportedSince={highlightImportedSince}
          isLoading={isLoading}
          isMutating={isMutating}
        />
      </div>
    </section>
  );
}
