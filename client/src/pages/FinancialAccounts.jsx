import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Metric from "../components/ui/Metric";
import Modal from "../components/ui/Modal";
import { useTransactions } from "../features/transactions/useTransactions";
import { useI18n } from "../i18n/LanguageProvider";
import {
  createFinancialAccount,
  deleteFinancialAccount,
  getFinancialAccounts,
  updateFinancialAccount,
} from "../lib/api/financialAccounts";
import { formatFinancialAccountLabel } from "../lib/financialAccounts/presentation";

const PROVIDER_OPTIONS = [
  {
    value: "manual",
    labelKey: "accounts.providerManual",
    descriptionKey: "accounts.providerManualDescription",
  },
];

const ACCOUNT_TYPE_OPTIONS = [
  {
    value: "bank_account",
    labelKey: "accounts.accountTypeBank",
    descriptionKey: "accounts.accountTypeBankDescription",
  },
  {
    value: "wallet",
    labelKey: "accounts.accountTypeWallet",
    descriptionKey: "accounts.accountTypeWalletDescription",
  },
  {
    value: "cash",
    labelKey: "accounts.accountTypeCash",
    descriptionKey: "accounts.accountTypeCashDescription",
  },
  {
    value: "credit_card",
    labelKey: "accounts.accountTypeCreditCard",
    descriptionKey: "accounts.accountTypeCreditCardDescription",
  },
];

const INITIAL_FORM = {
  accountType: ACCOUNT_TYPE_OPTIONS[0].value,
  provider: PROVIDER_OPTIONS[0].value,
  institutionName: "",
  institutionCode: "",
  accountName: "",
  accountMask: "",
  externalAccountId: "",
};

function getStatusMeta(status, t) {
  switch ((status || "").toLowerCase()) {
    case "connected":
      return { label: t("accounts.statusConnected"), className: "finova-badge-income" };
    case "error":
      return { label: t("accounts.statusError"), className: "finova-badge-danger" };
    case "disconnected":
      return { label: t("accounts.statusDisconnected"), className: "finova-badge-neutral" };
    case "pending":
    default:
      return { label: t("accounts.statusPending"), className: "finova-badge-warning" };
  }
}

function getAccountTypeMeta(accountType, t) {
  switch ((accountType || "").toLowerCase()) {
    case "wallet":
      return { label: t("accounts.accountTypeWallet"), className: "finova-badge-primary" };
    case "cash":
      return { label: t("accounts.accountTypeCashBadge"), className: "finova-badge-warning" };
    case "credit_card":
      return { label: t("accounts.accountTypeCreditCard"), className: "finova-badge-danger" };
    case "bank_account":
    default:
      return { label: t("accounts.accountTypeBank"), className: "finova-badge-income" };
  }
}

function formatProviderLabel(provider, t) {
  const option = PROVIDER_OPTIONS.find((item) => item.value === provider);
  return option ? t(option.labelKey) : provider;
}

function sortAccounts(list) {
  return [...list].sort((a, b) => {
    const institutionCompare = (a.institutionName || "").localeCompare(b.institutionName || "");
    if (institutionCompare !== 0) {
      return institutionCompare;
    }

    return (a.accountName || "").localeCompare(b.accountName || "");
  });
}

function FinancialAccountRow({ account, formatDateTime, isRemoving, onEdit, onRemove, t }) {
  const statusMeta = getStatusMeta(account.status, t);
  const accountTypeMeta = getAccountTypeMeta(account.accountType, t);

  return (
    <li className="finova-account-list-item">
      <div className="finova-account-list-main">
        <div className="finova-account-list-copy">
          <strong className="finova-transaction-list-description">{account.institutionName}</strong>
          <div className="finova-transaction-list-badges">
            <span className={statusMeta.className}>{statusMeta.label}</span>
            <span className={accountTypeMeta.className}>{accountTypeMeta.label}</span>
            <span className="finova-badge-neutral">{formatProviderLabel(account.provider, t)}</span>
          </div>
        </div>

        <div className="finova-actions-row finova-transaction-list-actions">
          <Button variant="secondary" className="btn-sm" onClick={() => onEdit(account)} disabled={isRemoving}>
            {t("accounts.editButton")}
          </Button>
          <Button variant="danger" className="btn-sm" onClick={() => onRemove(account)} disabled={isRemoving} loading={isRemoving}>
            {isRemoving ? t("accounts.removing") : t("accounts.remove")}
          </Button>
        </div>
      </div>

      <div className="finova-account-list-label">
        {formatFinancialAccountLabel(account, {
          fallbackName: t("accounts.fallbackAccountName"),
          endingLabel: t("accounts.endingLabel"),
        })}
      </div>

      <div className="finova-financial-account-meta">
        <span>{t("accounts.metaAccount")}: {account.accountName}</span>
        <span>{t("accounts.metaType")}: {accountTypeMeta.label}</span>
        {account.accountMask ? <span>{t("accounts.metaEnding")}: {account.accountMask}</span> : null}
        <span>{t("accounts.metaTransactions")}: {account.linkedTransactionsCount ?? 0}</span>
        <span>
          {t("accounts.metaLastSync")}: {account.lastSyncedAtUtc
            ? formatDateTime(account.lastSyncedAtUtc)
            : t("accounts.neverSynced")}
        </span>
      </div>

      {account.linkedTransactionsCount > 0 ? (
        <p className="finova-account-list-warning mb-0">
          {t("accounts.linkedTransactionsWarning", { count: account.linkedTransactionsCount })}
        </p>
      ) : null}
    </li>
  );
}

export default function FinancialAccounts() {
  const { t, formatDateTime } = useI18n();
  const { loadAll: reloadTransactions } = useTransactions();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingAccountId, setRemovingAccountId] = useState(null);
  const [removalTarget, setRemovalTarget] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await getFinancialAccounts();
      setAccounts(sortAccounts(Array.isArray(data) ? data : []));
    } catch (err) {
      setAccounts([]);
      setError(err.message || t("accounts.loadError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const summary = useMemo(() => {
    const connectedCount = accounts.filter((account) => account.status === "connected").length;
    const pendingCount = accounts.filter((account) => account.status === "pending").length;
    const syncedCount = accounts.filter((account) => account.lastSyncedAtUtc).length;
    const creditCardCount = accounts.filter((account) => account.accountType === "credit_card").length;

    return {
      total: accounts.length,
      connected: connectedCount,
      pending: pendingCount,
      synced: syncedCount,
      creditCards: creditCardCount,
    };
  }, [accounts]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
  }

  function handleStartEdit(account) {
    setEditingAccountId(account.id);
    setForm({
      accountType: account.accountType,
      provider: account.provider,
      institutionName: account.institutionName || "",
      institutionCode: account.institutionCode || "",
      accountName: account.accountName || "",
      accountMask: account.accountMask || "",
      externalAccountId: account.externalAccountId || "",
    });
    setError("");
    setSuccess("");
  }

  function handleCancelEdit() {
    setEditingAccountId(null);
    setForm(INITIAL_FORM);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.institutionName.trim()) {
      setError(t("accounts.validationInstitution"));
      return;
    }

    if (!form.accountName.trim()) {
      setError(t("accounts.validationAccountName"));
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        accountType: form.accountType,
        provider: form.provider,
        institutionName: form.institutionName.trim(),
        institutionCode: form.institutionCode.trim() || null,
        accountName: form.accountName.trim(),
        accountMask: form.accountMask.trim() || null,
        externalAccountId: form.externalAccountId.trim() || null,
      };

      if (editingAccountId) {
        const updated = await updateFinancialAccount(editingAccountId, payload);
        setAccounts((current) =>
          sortAccounts(current.map((account) => (account.id === editingAccountId ? updated : account)))
        );
        setSuccess(t("accounts.updateSuccess"));
      } else {
        const created = await createFinancialAccount(payload);
        setAccounts((current) => sortAccounts([...current, created]));
        setSuccess(t("accounts.createSuccess"));
      }

      setEditingAccountId(null);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(
        err.message ||
          (editingAccountId
            ? t("accounts.updateError")
            : t("accounts.createError"))
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function requestRemoval(account) {
    if (isSubmitting || removingAccountId) {
      return;
    }

    setRemovalTarget(account);
  }

  async function confirmRemoval() {
    const account = removalTarget;

    if (!account || isSubmitting || removingAccountId) {
      return;
    }

    setRemovingAccountId(account.id);
    setError("");
    setSuccess("");

    try {
      await deleteFinancialAccount(account.id);
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      await reloadTransactions();

      if (editingAccountId === account.id) {
        handleCancelEdit();
      }

      setSuccess(
        account.linkedTransactionsCount > 0
          ? t("accounts.removeSuccessWithTransactions")
          : t("accounts.removeSuccess")
      );
    } catch (err) {
      setError(err.message || t("accounts.removeError"));
    } finally {
      setRemovingAccountId(null);
      setRemovalTarget(null);
    }
  }

  return (
    <section className="finova-section-space">
      <PageHeader title={t("pages.accountsTitle")} subtitle={t("pages.accountsSubtitle")} />

      <div className="d-grid gap-4">
        <div className="finova-page-note">
          {t("pages.accountsPageNote")}
        </div>

        <div className="finova-account-metrics">
          <Metric label={t("accounts.summaryRegistered")} value={summary.total} />
          <Metric label={t("accounts.summaryConnected")} value={summary.connected} tone="income" />
          <Metric label={t("accounts.summaryPending")} value={summary.pending} tone="warning" />
          <Metric label={t("accounts.summarySynced")} value={summary.synced} tone="primary" />
          <Metric label={t("accounts.summaryCreditCards")} value={summary.creditCards} />
        </div>

        <div className="row g-4">
          <div className="col-12 col-xxl-5">
            <div className="finova-card p-4 h-100">
              <div className="mb-3">
                <h2 className="finova-title h5 mb-1">
                  {editingAccountId ? t("accounts.editTitle") : t("accounts.addTitle")}
                </h2>
                <p className="finova-subtitle mb-0">
                  {editingAccountId
                    ? t("accounts.editSubtitle")
                    : t("accounts.addSubtitle")}
                </p>
              </div>

              <form className="row g-3" onSubmit={handleSubmit}>
                <div className="col-12">
                  <label className="form-label text-dark fw-medium" htmlFor="financial-account-type">
                    {t("accounts.fieldAccountType")}
                  </label>
                  <select
                    id="financial-account-type"
                    className="form-select finova-select"
                    value={form.accountType}
                    onChange={(event) => updateField("accountType", event.target.value)}
                    disabled={isSubmitting}
                  >
                    {ACCOUNT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    {t(
                      ACCOUNT_TYPE_OPTIONS.find((option) => option.value === form.accountType)
                        ?.descriptionKey
                    )}
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label text-dark fw-medium" htmlFor="financial-provider">
                    {t("accounts.fieldProvider")}
                  </label>
                  <select
                    id="financial-provider"
                    className="form-select finova-select"
                    value={form.provider}
                    onChange={(event) => updateField("provider", event.target.value)}
                    disabled={isSubmitting}
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    {t(
                      PROVIDER_OPTIONS.find((option) => option.value === form.provider)
                        ?.descriptionKey
                    )}
                  </div>
                </div>

                <div className="col-12 col-md-7">
                  <label
                    className="form-label text-dark fw-medium"
                    htmlFor="financial-institution-name"
                  >
                    {t("accounts.fieldInstitution")}
                  </label>
                  <input
                    id="financial-institution-name"
                    type="text"
                    className="form-control finova-input"
                    value={form.institutionName}
                    onChange={(event) => updateField("institutionName", event.target.value)}
                    placeholder={t("accounts.placeholderInstitution")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="col-12 col-md-5">
                  <label
                    className="form-label text-dark fw-medium"
                    htmlFor="financial-institution-code"
                  >
                    {t("accounts.fieldInstitutionCode")}
                  </label>
                  <input
                    id="financial-institution-code"
                    type="text"
                    className="form-control finova-input"
                    value={form.institutionCode}
                    onChange={(event) => updateField("institutionCode", event.target.value)}
                    placeholder={t("accounts.placeholderOptional")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label text-dark fw-medium" htmlFor="financial-account-name">
                    {t("accounts.fieldAccountName")}
                  </label>
                  <input
                    id="financial-account-name"
                    type="text"
                    className="form-control finova-input"
                    value={form.accountName}
                    onChange={(event) => updateField("accountName", event.target.value)}
                    placeholder={t("accounts.placeholderAccountName")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label text-dark fw-medium" htmlFor="financial-account-mask">
                    {t("accounts.fieldMask")}
                  </label>
                  <input
                    id="financial-account-mask"
                    type="text"
                    className="form-control finova-input"
                    value={form.accountMask}
                    onChange={(event) => updateField("accountMask", event.target.value)}
                    placeholder={t("accounts.placeholderMask")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="col-12 col-md-3">
                  <label
                    className="form-label text-dark fw-medium"
                    htmlFor="financial-account-external-id"
                  >
                    {t("accounts.fieldExternalId")}
                  </label>
                  <input
                    id="financial-account-external-id"
                    type="text"
                    className="form-control finova-input"
                    value={form.externalAccountId}
                    onChange={(event) => updateField("externalAccountId", event.target.value)}
                    placeholder={t("accounts.placeholderOptional")}
                    disabled={isSubmitting}
                  />
                </div>

                {error ? (
                  <div className="col-12">
                    <div className="alert alert-danger py-2 mb-0" role="alert">
                      {error}
                    </div>
                  </div>
                ) : null}

                {!error && success ? (
                  <div className="col-12">
                    <div className="alert alert-success py-2 mb-0" role="status">
                      {success}
                    </div>
                  </div>
                ) : null}

                <div className="col-12">
                  <div className="finova-actions-row finova-actions-row-end pt-2">
                    {editingAccountId ? (
                      <Button
                        variant="secondary"
                        onClick={handleCancelEdit}
                        disabled={isSubmitting}
                      >
                        {t("accounts.cancelEdit")}
                      </Button>
                    ) : null}
                    <Button type="submit" className="px-4" loading={isSubmitting}>
                      {isSubmitting
                        ? editingAccountId
                          ? t("accounts.saving")
                          : t("accounts.creating")
                        : editingAccountId
                          ? t("accounts.saveChanges")
                          : t("accounts.addButton")}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div className="col-12 col-xxl-7">
            <div className="finova-card p-4 h-100">
              <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
                <div>
                  <h2 className="finova-title h5 mb-1">{t("accounts.listTitle")}</h2>
                  <p className="finova-subtitle mb-0">{t("accounts.listSubtitle")}</p>
                </div>

                <Button variant="secondary" onClick={loadAccounts} loading={isLoading}>
                  {isLoading ? t("accounts.refreshing") : t("accounts.refresh")}
                </Button>
              </div>

              <div className="finova-card-soft p-3 mb-3">
                <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                  <div>
                    <div className="finova-title h6 mb-1">{t("accounts.openFinanceTitle")}</div>
                    <p className="finova-subtitle mb-0">{t("accounts.openFinanceSubtitle")}</p>
                  </div>
                  <span className="finova-badge-warning align-self-start">{t("accounts.manualBadge")}</span>
                </div>
              </div>

              <div className="finova-page-note mb-3">{t("accounts.removeNote")}</div>

              {isLoading ? (
                <div className="finova-loading-state">
                  <div className="spinner-border spinner-border-sm text-primary" />
                  <p className="finova-subtitle mb-0">{t("accounts.loading")}</p>
                </div>
              ) : accounts.length === 0 ? (
                <EmptyState titleAs="h3" title={t("accounts.emptyTitle")} description={t("accounts.emptySubtitle")} />
              ) : (
                <ul className="finova-account-list list-unstyled mb-0" aria-label={t("accounts.listTitle")}>
                  {accounts.map((account) => {
                    return (
                      <FinancialAccountRow
                        key={account.id}
                        account={account}
                        formatDateTime={formatDateTime}
                        isRemoving={removingAccountId === account.id}
                        onEdit={handleStartEdit}
                        onRemove={requestRemoval}
                        t={t}
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={Boolean(removalTarget)}
        onClose={() => setRemovalTarget(null)}
        title={t("accounts.removeTitle")}
        subtitle={
          removalTarget?.linkedTransactionsCount > 0
            ? t("accounts.removeConfirmWithTransactions", {
                institution: removalTarget.institutionName,
                account: removalTarget.accountName,
                count: removalTarget.linkedTransactionsCount,
              })
            : t("accounts.removeConfirm", {
                institution: removalTarget?.institutionName,
                account: removalTarget?.accountName,
              })
        }
        closeLabel={t("common.cancel")}
        dismissible={!removingAccountId}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemovalTarget(null)} disabled={Boolean(removingAccountId)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={confirmRemoval} loading={Boolean(removingAccountId)}>
              {t("accounts.confirmRemove")}
            </Button>
          </>
        }
      >
        <p className="mb-0">{t("accounts.removeNote")}</p>
      </Modal>
    </section>
  );
}
