import { useEffect, useMemo, useRef, useState } from "react";
import { getTransactionCategories } from "../../../lib/constants/transactionCategories";
import { parseMoneyToCents } from "../../../lib/format/currency";
import { useI18n } from "../../../i18n/LanguageProvider";

function todayISO() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMonthsISO(dateString, monthsToAdd) {
  if (!dateString) {
    return "";
  }

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setMonth(date.getMonth() + monthsToAdd);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function centsToInput(value) {
  if (!Number.isFinite(Number(value))) {
    return "";
  }

  return (Number(value) / 100).toFixed(2).replace(".", ",");
}

function formatTagNamesForInput(tagNames) {
  return Array.isArray(tagNames) ? tagNames.join(", ") : "";
}

function parseTagNames(rawValue) {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(
      (item, index, array) =>
        array.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index
    );
}

export default function TransactionModal({
  mode,
  isOpen,
  onClose,
  onSubmit,
  initial,
  accounts = [],
  quickCreate = false,
}) {
  const { t } = useI18n();
  const isEdit = mode === "edit";
  const isQuickCreate = quickCreate && !isEdit;

  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState(getTransactionCategories("expense")[0]);
  const [amount, setAmount] = useState("");
  const [financialAccountId, setFinancialAccountId] = useState("all");
  const [tagNamesInput, setTagNamesInput] = useState("");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("2");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const descriptionInputRef = useRef(null);

  const title = isEdit
    ? t("transactions.modalEditTitle")
    : isQuickCreate
      ? t("transactions.quickCreateTitle")
      : t("transactions.modalCreateTitle");
  const categories = useMemo(() => getTransactionCategories(type), [type]);
  const minimumRecurrenceEndDate = useMemo(() => addMonthsISO(date, 1), [date]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (isEdit && initial) {
      const nextType = initial.type || "expense";
      const nextCategories = getTransactionCategories(nextType);

      setDate((initial.date || "").slice(0, 10) || todayISO());
      setDescription(initial.description || "");
      setType(nextType);
      setCategory(initial.category || nextCategories[0]);
      setAmount(centsToInput(initial.amountCents));
      setFinancialAccountId(
        initial.financialAccountId != null ? String(initial.financialAccountId) : "all"
      );
      setTagNamesInput(formatTagNamesForInput(initial.tagNames));
      setIsInstallment(Boolean(initial.installmentCount && initial.installmentCount > 1));
      setInstallmentCount(String(initial.installmentCount || 2));
      setIsRecurring(Boolean(initial.isRecurring));
      setRecurrenceEndDate((initial.recurrenceEndDate || "").slice(0, 10));
    } else {
      const baseDate = todayISO();

      setDate(baseDate);
      setDescription("");
      setType("expense");
      setCategory(getTransactionCategories("expense")[0]);
      setAmount("");
      setFinancialAccountId("all");
      setTagNamesInput("");
      setIsInstallment(false);
      setInstallmentCount("2");
      setIsRecurring(false);
      setRecurrenceEndDate(addMonthsISO(baseDate, 1));
    }

    setError("");
    setIsSubmitting(false);
  }, [isOpen, isEdit, initial]);

  useEffect(() => {
    if (!categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    descriptionInputRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSubmitting, onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const amountCents = parseMoneyToCents(amount);

    if (!description.trim()) {
      setError(t("transactions.validationDescription"));
      setIsSubmitting(false);
      return;
    }

    if (!date) {
      setError(t("transactions.validationDate"));
      setIsSubmitting(false);
      return;
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setError(t("transactions.validationAmount"));
      setIsSubmitting(false);
      return;
    }

    const parsedInstallmentCount = Number(installmentCount) || 1;

    if (isInstallment) {
      if (type !== "expense") {
        setError(t("transactions.validationInstallmentType"));
        setIsSubmitting(false);
        return;
      }

      if (parsedInstallmentCount < 2) {
        setError(t("transactions.validationInstallmentCount"));
        setIsSubmitting(false);
        return;
      }
    }

    if (isRecurring) {
      if (!recurrenceEndDate) {
        setError(t("transactions.validationRecurrenceEnd"));
        setIsSubmitting(false);
        return;
      }

      if (minimumRecurrenceEndDate && recurrenceEndDate < minimumRecurrenceEndDate) {
        setError(t("transactions.validationRecurrenceMinimum"));
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await onSubmit({
        date,
        description: description.trim(),
        type,
        category,
        amountCents,
        financialAccountId: financialAccountId === "all" ? null : Number(financialAccountId),
        tagNames: parseTagNames(tagNamesInput),
        isRecurring,
        installmentCount: isInstallment ? parsedInstallmentCount : 1,
        recurrenceEndDate: isRecurring ? recurrenceEndDate : null,
      });

      onClose();
    } catch (requestError) {
      setError(requestError.message || t("transactions.saveError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleTypeChange(nextType) {
    const nextCategories = getTransactionCategories(nextType);
    setType(nextType);
    setCategory(nextCategories[0]);

    if (nextType !== "expense") {
      setIsInstallment(false);
      setInstallmentCount("2");
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal d-block finova-modal-backdrop"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div
          className={`modal-content border-0 finova-modal-surface${
            isQuickCreate ? " finova-transaction-modal-quick" : ""
          }`}
        >
          <div className="modal-header border-0 pb-0 px-4 pt-4 finova-modal-header">
            <div>
              <h2 className="finova-title h4 mb-1">{title}</h2>
              <p className="finova-subtitle small mb-0">
                {isQuickCreate
                  ? t("transactions.quickCreateSubtitle")
                  : t("transactions.modalSubtitle")}
              </p>
            </div>

            <button
              type="button"
              className="btn-close finova-modal-close finova-icon-tooltip"
              aria-label={t("transactions.close")}
              title={t("transactions.close")}
              data-tooltip={t("transactions.close")}
              onClick={onClose}
            />
          </div>

          <div className="modal-body px-4 pb-4 pt-3">
            <form onSubmit={handleSubmit} className="row g-3">
              {isQuickCreate ? null : (
                <div className="col-12 col-md-4">
                  <label className="form-label text-dark fw-medium" htmlFor="transaction-date">
                    {t("common.date")}
                  </label>
                  <input
                    id="transaction-date"
                    type="date"
                    className="form-control finova-input"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
              )}

              <div className={`col-12${isQuickCreate ? "" : " col-md-8"}`}>
                <label
                  className="form-label text-dark fw-medium"
                  htmlFor="transaction-description"
                >
                  {t("common.description")}
                </label>
                <input
                  id="transaction-description"
                  ref={descriptionInputRef}
                  type="text"
                  className="form-control finova-input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t("transactions.placeholderDescription")}
                />
              </div>

              {isQuickCreate ? (
                <div className="col-12 col-md-6">
                  <label className="form-label text-dark fw-medium" htmlFor="transaction-amount">
                    {t("common.value")}
                  </label>
                  <input
                    id="transaction-amount"
                    type="text"
                    className="form-control finova-input"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={t("transactions.placeholderAmount")}
                    inputMode="decimal"
                  />
                </div>
              ) : null}

              <div className={`col-12${isQuickCreate ? " col-md-6" : " col-md-4"}`}>
                {isQuickCreate ? (
                  <span id="transaction-type-label" className="form-label text-dark fw-medium d-block">
                    {t("common.type")}
                  </span>
                ) : (
                  <label className="form-label text-dark fw-medium" htmlFor="transaction-type">
                    {t("common.type")}
                  </label>
                )}
                {isQuickCreate ? (
                  <div
                    className="finova-transaction-type-toggle"
                    role="group"
                    aria-labelledby="transaction-type-label"
                  >
                    <button
                      type="button"
                      className={`btn finova-transaction-type-option${
                        type === "expense" ? " is-active" : ""
                      }`}
                      aria-pressed={type === "expense"}
                      onClick={() => handleTypeChange("expense")}
                    >
                      {t("transactions.expense")}
                    </button>
                    <button
                      type="button"
                      className={`btn finova-transaction-type-option${
                        type === "income" ? " is-active" : ""
                      }`}
                      aria-pressed={type === "income"}
                      onClick={() => handleTypeChange("income")}
                    >
                      {t("transactions.income")}
                    </button>
                  </div>
                ) : (
                  <select
                    id="transaction-type"
                    className="form-select finova-select"
                    value={type}
                    onChange={(event) => handleTypeChange(event.target.value)}
                  >
                    <option value="expense">{t("transactions.expense")}</option>
                    <option value="income">{t("transactions.income")}</option>
                  </select>
                )}
              </div>

              {isQuickCreate ? null : (
                <div className="col-12 col-md-4">
                  <label className="form-label text-dark fw-medium" htmlFor="transaction-category">
                    {t("common.category")}
                  </label>
                  <select
                    id="transaction-category"
                    className="form-select finova-select"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isQuickCreate ? null : (
                <div className="col-12 col-md-4">
                  <label className="form-label text-dark fw-medium" htmlFor="transaction-account">
                    {t("accounts.metaAccount")}
                  </label>
                  <select
                    id="transaction-account"
                    className="form-select finova-select"
                    value={financialAccountId}
                    onChange={(event) => setFinancialAccountId(event.target.value)}
                  >
                    <option value="all">{t("transactions.unlinkedAccount")}</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={String(account.id)}>
                        {account.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isQuickCreate ? null : (
                <div className="col-12 col-md-4">
                  <label className="form-label text-dark fw-medium" htmlFor="transaction-amount">
                    {t("common.value")}
                  </label>
                  <input
                    id="transaction-amount"
                    type="text"
                    className="form-control finova-input"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={t("transactions.placeholderAmount")}
                    inputMode="decimal"
                  />
                </div>
              )}

              <div className="col-12">
                <details className="finova-transaction-more-options">
                  <summary>{t("transactions.moreOptions")}</summary>
                  <div className="row g-3 pt-3">
                    {isQuickCreate ? (
                      <>
                        <div className="col-12 col-md-4">
                          <label
                            className="form-label text-dark fw-medium"
                            htmlFor="transaction-date"
                          >
                            {t("common.date")}
                          </label>
                          <input
                            id="transaction-date"
                            type="date"
                            className="form-control finova-input"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                          />
                        </div>

                        <div className="col-12 col-md-4">
                          <label
                            className="form-label text-dark fw-medium"
                            htmlFor="transaction-category"
                          >
                            {t("common.category")}
                          </label>
                          <select
                            id="transaction-category"
                            className="form-select finova-select"
                            value={category}
                            onChange={(event) => setCategory(event.target.value)}
                          >
                            {categories.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-12 col-md-4">
                          <label
                            className="form-label text-dark fw-medium"
                            htmlFor="transaction-account"
                          >
                            {t("accounts.metaAccount")}
                          </label>
                          <select
                            id="transaction-account"
                            className="form-select finova-select"
                            value={financialAccountId}
                            onChange={(event) => setFinancialAccountId(event.target.value)}
                          >
                            <option value="all">{t("transactions.unlinkedAccount")}</option>
                            {accounts.map((account) => (
                              <option key={account.id} value={String(account.id)}>
                                {account.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : null}
                    <div className="col-12">
                      <label className="form-label text-dark fw-medium" htmlFor="transaction-tags">
                        {t("common.tags")}
                      </label>
                      <input
                        id="transaction-tags"
                        type="text"
                        className="form-control finova-input"
                        value={tagNamesInput}
                        onChange={(event) => setTagNamesInput(event.target.value)}
                        placeholder={t("transactions.placeholderTags")}
                      />
                      <p className="form-text mb-0">{t("transactions.tagsHelp")}</p>
                    </div>

                    {!isEdit ? (
                <>
                  {type === "expense" ? (
                    <div className="col-12 col-md-6">
                      <div className="form-check finova-check">
                        <input
                          id="transaction-installment"
                          type="checkbox"
                          className="form-check-input"
                          checked={isInstallment}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setIsInstallment(checked);

                            if (checked) {
                              setIsRecurring(false);
                              setRecurrenceEndDate("");
                            }
                          }}
                        />
                        <label
                          className="form-check-label text-dark fw-medium"
                          htmlFor="transaction-installment"
                        >
                          {t("transactions.installmentToggle")}
                        </label>
                      </div>
                      <p className="form-text mb-0">{t("transactions.installmentHelp")}</p>
                    </div>
                  ) : null}

                  {isInstallment ? (
                    <div className="col-12 col-md-6">
                      <label
                        className="form-label text-dark fw-medium"
                        htmlFor="transaction-installment-count"
                      >
                        {t("transactions.installmentCountLabel")}
                      </label>
                      <input
                        id="transaction-installment-count"
                        type="number"
                        min="2"
                        max="48"
                        className="form-control finova-input"
                        value={installmentCount}
                        onChange={(event) => setInstallmentCount(event.target.value)}
                      />
                      <p className="form-text mb-0">{t("transactions.installmentCountHelp")}</p>
                    </div>
                  ) : null}

                  <div className="col-12">
                    <div className="form-check finova-check">
                      <input
                        id="transaction-recurring"
                        type="checkbox"
                        className="form-check-input"
                        checked={isRecurring}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setIsRecurring(checked);

                          if (checked && !recurrenceEndDate) {
                            setRecurrenceEndDate(addMonthsISO(date, 1));
                          }

                          if (checked) {
                            setIsInstallment(false);
                            setInstallmentCount("2");
                          }
                        }}
                        disabled={isInstallment}
                      />
                      <label
                        className="form-check-label text-dark fw-medium"
                        htmlFor="transaction-recurring"
                      >
                        {t("transactions.recurringToggle")}
                      </label>
                    </div>
                    <p className="form-text mb-0">{t("transactions.recurringHelp")}</p>
                  </div>

                  {isRecurring ? (
                    <div className="col-12 col-md-6">
                      <label
                        className="form-label text-dark fw-medium"
                        htmlFor="transaction-recurrence-end-date"
                      >
                        {t("transactions.recurrenceEndLabel")}
                      </label>
                      <input
                        id="transaction-recurrence-end-date"
                        type="date"
                        className="form-control finova-input"
                        value={recurrenceEndDate}
                        min={minimumRecurrenceEndDate}
                        onChange={(event) => setRecurrenceEndDate(event.target.value)}
                      />
                      <p className="form-text mb-0">{t("transactions.recurrenceEndHelp")}</p>
                    </div>
                  ) : null}
                    </>
                    ) : null}
                  </div>
                </details>
              </div>

              {isEdit && initial?.isRecurring ? (
                <div className="col-12">
                  <div className="alert alert-info py-2 mb-0 finova-status-banner">
                    {t("transactions.editRecurringInfo")}
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="col-12">
                  <div className="alert alert-danger py-2 mb-0 finova-status-banner">{error}</div>
                </div>
              ) : null}

              <div className="col-12">
                <div className="finova-actions-row finova-actions-row-end finova-modal-actions pt-2">
                  <button
                    type="button"
                    className="btn finova-btn-light px-4"
                    onClick={onClose}
                    disabled={isSubmitting}
                  >
                    {t("common.cancel")}
                  </button>

                  <button
                    type="submit"
                    className="btn finova-btn-primary px-4"
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? t("transactions.saving")
                      : isEdit
                        ? t("transactions.saveChanges")
                        : t("transactions.addButton")}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
