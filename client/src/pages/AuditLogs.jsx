import { useEffect, useMemo, useState } from "react";
import {
  formatActionLabel,
  formatAuditDate,
  getActionGroup,
  getActionToneClass,
  VISIBLE_AUDIT_ACTIONS,
} from "../features/history/auditLogPresentation";
import { useI18n } from "../i18n/LanguageProvider";
import { getAuditLogs } from "../lib/api/auditLogs";

export default function AuditLogs() {
  const { t, formatDateTime } = useI18n();
  const [logs, setLogs] = useState([]);
  const [limit, setLimit] = useState(50);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAuditLogs() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getAuditLogs(limit);

        if (active) {
          setLogs(Array.isArray(data) ? data : []);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || t("history.loadError"));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadAuditLogs();

    return () => {
      active = false;
    };
  }, [limit, t]);

  const visibleLogs = useMemo(
    () => logs.filter((log) => VISIBLE_AUDIT_ACTIONS.has(log.action)),
    [logs]
  );

  const hiddenLogsCount = logs.length - visibleLogs.length;

  return (
    <section className="finova-section-space">
      <div className="finova-page-header">
        <div className="finova-page-header-copy">
          <h1 className="finova-title">{t("pages.historyTitle")}</h1>
          <p className="finova-subtitle mb-0">{t("pages.historySubtitle")}</p>
        </div>

        <div className="finova-page-header-side">
          <label className="form-label text-dark fw-medium" htmlFor="history-limit">
            {t("pages.historyLimit")}
          </label>
          <select
            id="history-limit"
            className="form-select finova-select"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            <option value={25}>{t("history.limit25")}</option>
            <option value={50}>{t("history.limit50")}</option>
            <option value={100}>{t("history.limit100")}</option>
          </select>
        </div>
      </div>

      <div className="finova-page-note mb-4">{t("pages.historyPageNote")}</div>

      <div className="finova-card p-4">
        {isLoading ? (
          <div className="finova-loading-state">
            <div className="spinner-border spinner-border-sm text-primary" />
            <p className="finova-subtitle mb-0">{t("history.loading")}</p>
          </div>
        ) : error ? (
          <div className="alert alert-danger py-2 mb-0" role="alert">
            {error}
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="finova-empty-state">
            <h2 className="finova-title h6 mb-2">{t("history.emptyTitle")}</h2>
            <p className="finova-subtitle mb-0">{t("history.emptySubtitle")}</p>
          </div>
        ) : (
          <div className="d-grid gap-3">
            {hiddenLogsCount > 0 ? (
              <div className="alert alert-info py-2 mb-0" role="status">
                {t(
                  hiddenLogsCount === 1
                    ? "history.hiddenLogsSingle"
                    : "history.hiddenLogsPlural",
                  { count: hiddenLogsCount }
                )}
              </div>
            ) : null}

            {visibleLogs.map((log) => (
              <div key={log.id} className="finova-card-soft p-3">
                <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-2">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className={getActionToneClass(log.action)}>
                      {formatActionLabel(log.action, t)}
                    </span>
                    <span className="finova-badge-neutral">{getActionGroup(log.action, t)}</span>
                  </div>

                  <span className="finova-subtitle small">
                    {formatAuditDate(log.createdAtUtc, formatDateTime)}
                  </span>
                </div>

                <div className="fw-medium">{log.summary}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
