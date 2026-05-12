import { useEffect, useMemo, useRef, useState } from "react";
import { getTransactionCategories } from "../../../lib/constants/transactionCategories";
import { useI18n } from "../../../i18n/LanguageProvider";

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

export default function InstallmentGroupModal({
  isOpen,
  onClose,
  onSubmit,
  initial,
}) {
  const { t } = useI18n();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tagNamesInput, setTagNamesInput] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const descriptionInputRef = useRef(null);

  const categories = useMemo(
    () =>
      Array.from(
        new Set([
          ...getTransactionCategories("expense"),
          ...getTransactionCategories("income"),
          initial?.category || "",
        ].filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [initial?.category]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDescription(initial?.description || "");
    setCategory(initial?.category || categories[0] || "");
    setTagNamesInput(formatTagNamesForInput(initial?.tagNames));
    setError("");
    setIsSubmitting(false);
  }, [isOpen, initial, categories]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    descriptionInputRef.current?.focus();
  }, [isOpen]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (!description.trim()) {
      setError(t("transactions.installmentGroupValidationDescription"));
      setIsSubmitting(false);
      return;
    }

    if (!category.trim()) {
      setError(t("transactions.installmentGroupValidationCategory"));
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmit({
        description: description.trim(),
        category: category.trim(),
        tagNames: parseTagNames(tagNamesInput),
      });
      onClose();
    } catch (requestError) {
      setError(requestError.message || t("transactions.installmentGroupSaveError"));
    } finally {
      setIsSubmitting(false);
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
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 finova-modal-surface">
          <div className="modal-header border-0 pb-0 px-4 pt-4 finova-modal-header">
            <div>
              <h2 className="finova-title h4 mb-1">{t("transactions.installmentGroupTitle")}</h2>
              <p className="finova-subtitle small mb-0">
                {t("transactions.installmentGroupSubtitle")}
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
              <div className="col-12">
                <label className="form-label text-dark fw-medium" htmlFor="installment-group-description">
                  {t("common.description")}
                </label>
                <input
                  id="installment-group-description"
                  ref={descriptionInputRef}
                  type="text"
                  className="form-control finova-input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div className="col-12">
                <label className="form-label text-dark fw-medium" htmlFor="installment-group-category">
                  {t("common.category")}
                </label>
                <select
                  id="installment-group-category"
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

              <div className="col-12">
                <label className="form-label text-dark fw-medium" htmlFor="installment-group-tags">
                  {t("common.tags")}
                </label>
                <input
                  id="installment-group-tags"
                  type="text"
                  className="form-control finova-input"
                  value={tagNamesInput}
                  onChange={(event) => setTagNamesInput(event.target.value)}
                  placeholder={t("transactions.installmentGroupTagsPlaceholder")}
                />
              </div>

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
                    {isSubmitting ? t("transactions.saving") : t("transactions.installmentGroupSave")}
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
