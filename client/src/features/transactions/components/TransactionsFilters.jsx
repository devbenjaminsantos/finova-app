import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "../../../i18n/LanguageProvider";

export default function TransactionsFilters({
  q,
  setQ,
  accountFilter,
  setAccountFilter,
  tagFilter,
  setTagFilter,
  typeFilter,
  setTypeFilter,
  categoryFilter,
  setCategoryFilter,
  month,
  setMonth,
  sortBy,
  setSortBy,
  categories,
  tags,
  accounts,
  onReset,
}) {
  const { t } = useI18n();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const searchInputRef = useRef(null);
  const activeFilterCount = [
    Boolean(q.trim()),
    accountFilter !== "all",
    tagFilter !== "all",
    typeFilter !== "all",
    categoryFilter !== "all",
    Boolean(month),
    sortBy !== "date_desc",
  ].filter(Boolean).length;

  useEffect(() => {
    if (!isSheetOpen) {
      return undefined;
    }

    searchInputRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsSheetOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isSheetOpen]);

  return (
    <>
      <div className="finova-mobile-filters-trigger mb-3">
        <button
          type="button"
          className="btn finova-btn-light"
          onClick={() => setIsSheetOpen(true)}
          aria-expanded={isSheetOpen}
          aria-controls="transactions-filters-sheet"
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span>{t("transactions.filtersButton")}</span>
          {activeFilterCount > 0 ? (
            <span className="finova-badge-primary">{activeFilterCount}</span>
          ) : null}
        </button>
        {activeFilterCount > 0 ? (
          <span className="finova-subtitle small">
            {t("transactions.filtersActiveCount", { count: activeFilterCount })}
          </span>
        ) : null}
      </div>

      {isSheetOpen ? (
        <button
          type="button"
          className="finova-filters-sheet-backdrop"
          onClick={() => setIsSheetOpen(false)}
          aria-label={t("transactions.filtersClose")}
        />
      ) : null}

      <div
        id="transactions-filters-sheet"
        className={`finova-card p-4 mb-4 finova-toolbar-surface${
          isSheetOpen ? " finova-toolbar-sheet-open" : ""
        }`}
        role={isSheetOpen ? "dialog" : undefined}
        aria-modal={isSheetOpen || undefined}
        aria-labelledby={isSheetOpen ? "transactions-filters-title" : undefined}
      >
        <div className="finova-filters-sheet-header">
          <div>
            <h2 id="transactions-filters-title" className="finova-title h5 mb-1">
              {t("transactions.filtersSheetTitle")}
            </h2>
            <p className="finova-subtitle small mb-0">
              {activeFilterCount > 0
                ? t("transactions.filtersActiveCount", { count: activeFilterCount })
                : t("transactions.filtersSheetSubtitle")}
            </p>
          </div>
          <button
            type="button"
            className="app-icon-button"
            onClick={() => setIsSheetOpen(false)}
            aria-label={t("transactions.filtersClose")}
            title={t("transactions.filtersClose")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <label className="form-label text-dark fw-medium" htmlFor="transactions-search">
            {t("common.search")}
          </label>
          <input
            id="transactions-search"
            ref={searchInputRef}
            type="text"
            className="form-control finova-input"
            placeholder={t("transactions.searchPlaceholder")}
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>

        <div className="col-6 col-lg-2">
          <label className="form-label text-dark fw-medium" htmlFor="transactions-account-filter">
            {t("transactions.accountFilterLabel")}
          </label>
          <select
            id="transactions-account-filter"
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

        <div className="col-6 col-lg-2">
          <label className="form-label text-dark fw-medium" htmlFor="transactions-type-filter">
            {t("common.type")}
          </label>
          <select
            id="transactions-type-filter"
            className="form-select finova-select"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">{t("transactions.allTypes")}</option>
            <option value="income">{t("transactions.incomePlural")}</option>
            <option value="expense">{t("transactions.expensePlural")}</option>
          </select>
        </div>

        <div className="col-6 col-lg-1">
          <label className="form-label text-dark fw-medium" htmlFor="transactions-category-filter">
            {t("common.category")}
          </label>
          <select
            id="transactions-category-filter"
            className="form-select finova-select"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">{t("transactions.allCategories")}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="col-6 col-lg-1">
          <label className="form-label text-dark fw-medium" htmlFor="transactions-tag-filter">
            {t("common.tags")}
          </label>
          <select
            id="transactions-tag-filter"
            className="form-select finova-select"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="all">{t("transactions.allTags")}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        </div>

        <div className="col-6 col-lg-1">
          <label className="form-label text-dark fw-medium" htmlFor="transactions-month-filter">
            {t("common.month")}
          </label>
          <input
            id="transactions-month-filter"
            type="month"
            className="form-control finova-input"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>

        <div className="col-6 col-lg-1">
          <label className="form-label text-dark fw-medium" htmlFor="transactions-sort-filter">
            {t("common.sort")}
          </label>
          <select
            id="transactions-sort-filter"
            className="form-select finova-select"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="date_desc">{t("transactions.sortRecent")}</option>
            <option value="date_asc">{t("transactions.sortOldest")}</option>
            <option value="amount_desc">{t("transactions.sortHighest")}</option>
            <option value="amount_asc">{t("transactions.sortLowest")}</option>
          </select>
        </div>

        {!isSheetOpen ? (
          <div className="col-12 finova-filters-desktop-actions">
            <div className="finova-actions-row finova-actions-row-end">
              <button type="button" className="btn finova-btn-light" onClick={onReset}>
                {t("common.clearFilters")}
              </button>
            </div>
          </div>
        ) : null}
      </div>

        <div className="finova-filters-sheet-footer">
          <button type="button" className="btn finova-btn-light" onClick={onReset}>
            {t("common.clearFilters")}
          </button>
          <button
            type="button"
            className="btn finova-btn-primary"
            onClick={() => setIsSheetOpen(false)}
          >
            {t("transactions.filtersShowResults")}
          </button>
        </div>
      </div>
    </>
  );
}
