import { useEffect, useState } from "react";
import HomeCustomizationCard from "../components/HomeCustomizationCard";
import PasswordToggleButton from "../components/PasswordToggleButton";
import { useI18n } from "../i18n/LanguageProvider";
import {
  getNotificationDeliveries,
  getProfile,
  updateProfileRequest,
} from "../lib/api/auth";
import {
  getPublicDashboardSettings,
  revokePublicDashboardToken,
  rotatePublicDashboardToken,
  updatePublicDashboardSettings,
} from "../lib/api/publicDashboard";
import { isPasswordStrong } from "../lib/auth/passwordPolicy";
import {
  DEFAULT_HOME_WIDGETS,
  loadHomeWidgets,
  saveHomeWidgets,
} from "../lib/home/homePreferences";

export default function Profile() {
  const { t, formatDateTime } = useI18n();
  const [form, setForm] = useState({
    name: "",
    email: "",
    emailGoalAlertsEnabled: false,
    goalAlertThresholdPercent: 80,
    monthlyReportEmailsEnabled: false,
    monthlyReportDay: 1,
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCurrentPasswordVisible, setIsCurrentPasswordVisible] = useState(false);
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [isUpdatingPublicDashboard, setIsUpdatingPublicDashboard] = useState(false);
  const [notificationDeliveries, setNotificationDeliveries] = useState([]);
  const [publicDashboard, setPublicDashboard] = useState({
    enabled: false,
    hasActiveToken: false,
    publicUrl: "",
  });
  const [profileUser, setProfileUser] = useState(null);
  const [homeWidgets, setHomeWidgets] = useState(() => loadHomeWidgets());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publicDashboardMessage, setPublicDashboardMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const [user, deliveries, publicDashboardSettings] = await Promise.all([
          getProfile(),
          getNotificationDeliveries(),
          getPublicDashboardSettings(),
        ]);
        setForm((current) => ({
          ...current,
          name: user.name ?? "",
          email: user.email ?? "",
          emailGoalAlertsEnabled: user.emailGoalAlertsEnabled ?? false,
          goalAlertThresholdPercent: user.goalAlertThresholdPercent ?? 80,
          monthlyReportEmailsEnabled: user.monthlyReportEmailsEnabled ?? false,
          monthlyReportDay: user.monthlyReportDay ?? 1,
        }));
        setProfileUser(user);
        setHomeWidgets(loadHomeWidgets(user));
        setNotificationDeliveries(Array.isArray(deliveries) ? deliveries : []);
        setPublicDashboard({
          enabled: publicDashboardSettings?.enabled ?? false,
          hasActiveToken: publicDashboardSettings?.hasActiveToken ?? false,
          publicUrl: publicDashboardSettings?.publicUrl ?? "",
        });
      } catch (err) {
        setError(err.message || t("profile.loadError"));
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [t]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSuccess("");
    setPublicDashboardMessage("");
  }

  function handleToggleHomeWidget(widgetKey) {
    const nextWidgets = saveHomeWidgets(profileUser, {
      ...homeWidgets,
      [widgetKey]: !homeWidgets[widgetKey],
    });
    setHomeWidgets(nextWidgets);
  }

  function handleResetHomeWidgets() {
    const nextWidgets = saveHomeWidgets(profileUser, DEFAULT_HOME_WIDGETS);
    setHomeWidgets(nextWidgets);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError(t("profile.emptyNameError"));
      return;
    }

    const wantsToChangePassword =
      form.currentPassword.trim() || form.newPassword.trim() || form.confirmPassword.trim();

    if (wantsToChangePassword) {
      if (!form.currentPassword.trim()) {
        setError(t("profile.currentPasswordError"));
        return;
      }

      if (!form.newPassword.trim()) {
        setError(t("profile.newPasswordError"));
        return;
      }

      if (!isPasswordStrong(form.newPassword)) {
        setError(t("passwordPolicy.message"));
        return;
      }

      if (form.newPassword !== form.confirmPassword) {
        setError(t("profile.confirmMismatchError"));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const user = await updateProfileRequest({
        name: form.name,
        emailGoalAlertsEnabled: form.emailGoalAlertsEnabled,
        goalAlertThresholdPercent: Number(form.goalAlertThresholdPercent),
        monthlyReportEmailsEnabled: form.monthlyReportEmailsEnabled,
        monthlyReportDay: Number(form.monthlyReportDay),
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      setForm((current) => ({
        ...current,
        name: user.name ?? current.name,
        email: user.email ?? current.email,
        emailGoalAlertsEnabled: user.emailGoalAlertsEnabled ?? current.emailGoalAlertsEnabled,
        goalAlertThresholdPercent:
          user.goalAlertThresholdPercent ?? current.goalAlertThresholdPercent,
        monthlyReportEmailsEnabled:
          user.monthlyReportEmailsEnabled ?? current.monthlyReportEmailsEnabled,
        monthlyReportDay: user.monthlyReportDay ?? current.monthlyReportDay,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setSuccess(t("profile.success"));
    } catch (err) {
      setError(err.message || t("profile.updateError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTogglePublicDashboard(enabled) {
    setIsUpdatingPublicDashboard(true);
    setError("");
    setSuccess("");
    setPublicDashboardMessage("");

    try {
      const settings = await updatePublicDashboardSettings(enabled);
      setPublicDashboard({
        enabled: settings?.enabled ?? false,
        hasActiveToken: settings?.hasActiveToken ?? false,
        publicUrl: settings?.publicUrl ?? "",
      });
      setPublicDashboardMessage(
        enabled ? t("profile.publicDashboardEnabledSuccess") : t("profile.publicDashboardDisabledSuccess")
      );
    } catch (err) {
      setError(err.message || t("profile.publicDashboardUpdateError"));
    } finally {
      setIsUpdatingPublicDashboard(false);
    }
  }

  async function handleRotatePublicDashboardLink() {
    setIsUpdatingPublicDashboard(true);
    setError("");
    setSuccess("");
    setPublicDashboardMessage("");

    try {
      const settings = await rotatePublicDashboardToken();
      setPublicDashboard({
        enabled: settings?.enabled ?? false,
        hasActiveToken: settings?.hasActiveToken ?? false,
        publicUrl: settings?.publicUrl ?? "",
      });
      setPublicDashboardMessage(t("profile.publicDashboardRotatedSuccess"));
    } catch (err) {
      setError(err.message || t("profile.publicDashboardRotateError"));
    } finally {
      setIsUpdatingPublicDashboard(false);
    }
  }

  async function handleRevokePublicDashboardLink() {
    setIsUpdatingPublicDashboard(true);
    setError("");
    setSuccess("");
    setPublicDashboardMessage("");

    try {
      const settings = await revokePublicDashboardToken();
      setPublicDashboard({
        enabled: settings?.enabled ?? false,
        hasActiveToken: settings?.hasActiveToken ?? false,
        publicUrl: "",
      });
      setPublicDashboardMessage(t("profile.publicDashboardRevokedSuccess"));
    } catch (err) {
      setError(err.message || t("profile.publicDashboardRevokeError"));
    } finally {
      setIsUpdatingPublicDashboard(false);
    }
  }

  async function handleCopyPublicDashboardLink() {
    if (!publicDashboard.publicUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicDashboard.publicUrl);
      setPublicDashboardMessage(t("profile.publicDashboardCopied"));
    } catch {
      setPublicDashboardMessage(t("profile.publicDashboardCopyError"));
    }
  }

  return (
    <section className="finova-section-space">
      <div className="finova-page-header">
        <div className="finova-page-header-copy">
          <h1 className="finova-title">{t("profile.title")}</h1>
          <p className="finova-subtitle mb-0">{t("profile.subtitle")}</p>
        </div>
      </div>

      <div className="finova-page-note">
        {t("profile.pageNote")}
      </div>

      <div className="finova-page-stack finova-page-stack-narrow">
        <div className="finova-card p-4 p-md-5">
          {isLoading ? (
            <div className="finova-loading-state">
              <div className="spinner-border spinner-border-sm text-primary" />
              <p className="finova-subtitle mb-0">{t("profile.loading")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="row g-3">
              <div className="col-12">
                <div className="finova-profile-section-heading">
                  <h2 className="finova-title h5 mb-1">{t("profile.accountSectionTitle")}</h2>
                  <p className="finova-subtitle small mb-0">{t("profile.accountSectionSubtitle")}</p>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-dark fw-medium" htmlFor="profile-name">
                  {t("common.name")}
                </label>
                <input
                  id="profile-name"
                  type="text"
                  className="form-control finova-input"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder={t("common.preferredNamePlaceholder")}
                  disabled={isSubmitting}
                  required
                />
                <div className="form-text">{t("common.preferredNameHelp")}</div>
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-dark fw-medium" htmlFor="profile-email">
                  {t("common.email")}
                </label>
                <input
                  id="profile-email"
                  type="email"
                  className="form-control finova-input"
                  value={form.email}
                  disabled
                  readOnly
                />
              </div>

              <div className="col-12">
                <div className="finova-card finova-profile-subsection border-0 p-3 p-md-4">
                  <div className="d-flex flex-column flex-md-row align-items-md-start justify-content-between gap-3">
                    <div>
                      <h2 className="finova-title h5 mb-1">{t("profile.emailAlertsTitle")}</h2>
                      <p className="finova-subtitle small mb-0">
                        {t("profile.emailAlertsSubtitle")}
                      </p>
                    </div>

                    <div className="form-check form-switch m-0">
                      <input
                        id="emailGoalAlertsEnabled"
                        type="checkbox"
                        className="form-check-input"
                        checked={form.emailGoalAlertsEnabled}
                        onChange={(e) => updateField("emailGoalAlertsEnabled", e.target.checked)}
                        disabled={isSubmitting}
                      />
                      <label
                        className="form-check-label text-dark fw-medium"
                        htmlFor="emailGoalAlertsEnabled"
                      >
                        {form.emailGoalAlertsEnabled
                          ? t("profile.emailAlertsEnabled")
                          : t("profile.emailAlertsDisabled")}
                      </label>
                    </div>
                  </div>

                  <div className="row g-3 mt-1">
                    <div className="col-12 col-md-6">
                      <label
                        className="form-label text-dark fw-medium"
                        htmlFor="goalAlertThresholdPercent"
                      >
                        {t("profile.emailAlertsThresholdLabel")}
                      </label>
                      <select
                        id="goalAlertThresholdPercent"
                        className="form-select finova-input"
                        value={String(form.goalAlertThresholdPercent)}
                        onChange={(e) =>
                          updateField("goalAlertThresholdPercent", Number(e.target.value))
                        }
                        disabled={isSubmitting || !form.emailGoalAlertsEnabled}
                      >
                        {[50, 60, 70, 80, 90, 100].map((value) => (
                          <option key={value} value={value}>
                            {t("profile.emailAlertsThresholdOption", { percent: value })}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">{t("profile.emailAlertsThresholdHelp")}</div>
                    </div>

                    <div className="col-12">
                      <div className="border-top pt-3">
                        <div className="d-flex flex-column flex-md-row align-items-md-start justify-content-between gap-3">
                          <div>
                            <h3 className="finova-title h6 mb-1">
                              {t("profile.monthlyReportTitle")}
                            </h3>
                            <p className="finova-subtitle small mb-0">
                              {t("profile.monthlyReportSubtitle")}
                            </p>
                          </div>

                          <div className="form-check form-switch m-0">
                            <input
                              id="monthlyReportEmailsEnabled"
                              type="checkbox"
                              className="form-check-input"
                              checked={form.monthlyReportEmailsEnabled}
                              onChange={(e) =>
                                updateField("monthlyReportEmailsEnabled", e.target.checked)
                              }
                              disabled={isSubmitting}
                            />
                            <label
                              className="form-check-label text-dark fw-medium"
                              htmlFor="monthlyReportEmailsEnabled"
                            >
                              {form.monthlyReportEmailsEnabled
                                ? t("profile.monthlyReportEnabled")
                                : t("profile.monthlyReportDisabled")}
                            </label>
                          </div>
                        </div>

                        <div className="row g-3 mt-1">
                          <div className="col-12 col-md-6">
                            <label
                              className="form-label text-dark fw-medium"
                              htmlFor="monthlyReportDay"
                            >
                              {t("profile.monthlyReportDayLabel")}
                            </label>
                            <select
                              id="monthlyReportDay"
                              className="form-select finova-input"
                              value={String(form.monthlyReportDay)}
                              onChange={(e) =>
                                updateField("monthlyReportDay", Number(e.target.value))
                              }
                              disabled={isSubmitting || !form.monthlyReportEmailsEnabled}
                            >
                              {Array.from({ length: 28 }, (_, index) => index + 1).map((value) => (
                                <option key={value} value={value}>
                                  {t("profile.monthlyReportDayOption", { day: value })}
                                </option>
                              ))}
                            </select>
                            <div className="form-text">
                              {t("profile.monthlyReportDayHelp")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div className="finova-profile-section-heading finova-profile-section-heading-divider">
                  <h2 className="finova-title h5 mb-1">{t("profile.changePasswordTitle")}</h2>
                  <p className="finova-subtitle small mb-0">{t("profile.changePasswordSubtitle")}</p>
                </div>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label text-dark fw-medium" htmlFor="profile-current-password">
                  {t("common.currentPassword")}
                </label>
                <div className="input-group">
                  <input
                    id="profile-current-password"
                    type={isCurrentPasswordVisible ? "text" : "password"}
                    className="form-control finova-input"
                    value={form.currentPassword}
                    onChange={(e) => updateField("currentPassword", e.target.value)}
                    disabled={isSubmitting}
                  />
                  <PasswordToggleButton
                    isVisible={isCurrentPasswordVisible}
                    onToggle={() => setIsCurrentPasswordVisible((current) => !current)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label text-dark fw-medium" htmlFor="profile-new-password">
                  {t("common.newPassword")}
                </label>
                <div className="input-group">
                  <input
                    id="profile-new-password"
                    type={isNewPasswordVisible ? "text" : "password"}
                    className="form-control finova-input"
                    value={form.newPassword}
                    onChange={(e) => updateField("newPassword", e.target.value)}
                    disabled={isSubmitting}
                  />
                  <PasswordToggleButton
                    isVisible={isNewPasswordVisible}
                    onToggle={() => setIsNewPasswordVisible((current) => !current)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="form-text">{t("passwordPolicy.message")}</div>
              </div>

              <div className="col-12 col-md-4">
                <label className="form-label text-dark fw-medium" htmlFor="profile-confirm-password">
                  {t("common.confirmPassword")}
                </label>
                <div className="input-group">
                  <input
                    id="profile-confirm-password"
                    type={isConfirmPasswordVisible ? "text" : "password"}
                    className="form-control finova-input"
                    value={form.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    disabled={isSubmitting}
                  />
                  <PasswordToggleButton
                    isVisible={isConfirmPasswordVisible}
                    onToggle={() => setIsConfirmPasswordVisible((current) => !current)}
                    disabled={isSubmitting}
                  />
                </div>
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
                  <button
                    type="submit"
                    className="btn finova-btn-primary px-4"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t("profile.savingButton") : t("profile.saveButton")}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {!isLoading ? (
          <div>
            <HomeCustomizationCard
              widgets={homeWidgets}
              onToggle={handleToggleHomeWidget}
              onReset={handleResetHomeWidgets}
              title={t("profile.homeCustomizationTitle")}
              description={t("profile.homeCustomizationSubtitle")}
              resetLabel={t("profile.homeCustomizationReset")}
            />
          </div>
        ) : null}

        {!isLoading ? (
          <div className="finova-card p-4 p-md-5">
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-3">
              <div>
                <h2 className="finova-title h5 mb-1">{t("profile.publicDashboardTitle")}</h2>
                <p className="finova-subtitle small mb-0">
                  {t("profile.publicDashboardSubtitle")}
                </p>
              </div>

              <div className="form-check form-switch m-0">
                <input
                  id="publicDashboardEnabled"
                  type="checkbox"
                  className="form-check-input"
                  checked={publicDashboard.enabled}
                  onChange={(event) => handleTogglePublicDashboard(event.target.checked)}
                  disabled={isUpdatingPublicDashboard}
                />
                <label
                  className="form-check-label text-dark fw-medium"
                  htmlFor="publicDashboardEnabled"
                >
                  {publicDashboard.enabled
                    ? t("profile.publicDashboardEnabled")
                    : t("profile.publicDashboardDisabled")}
                </label>
              </div>
            </div>

            {publicDashboard.enabled ? (
              <div className="d-grid gap-3">
                {publicDashboard.publicUrl ? (
                  <div>
                    <label className="form-label text-dark fw-medium" htmlFor="publicDashboardUrl">
                      {t("profile.publicDashboardLinkLabel")}
                    </label>
                    <input
                      id="publicDashboardUrl"
                      type="text"
                      className="form-control finova-input"
                      value={publicDashboard.publicUrl}
                      readOnly
                    />
                    <div className="form-text">{t("profile.publicDashboardLinkHelp")}</div>
                  </div>
                ) : (
                  <p className="finova-subtitle mb-0">
                    {publicDashboard.hasActiveToken
                      ? t("profile.publicDashboardHiddenLink")
                      : t("profile.publicDashboardMissingLink")}
                  </p>
                )}

                <div className="finova-actions-row">
                  {publicDashboard.publicUrl ? (
                    <>
                      <button
                        type="button"
                        className="btn finova-btn-light"
                        onClick={handleCopyPublicDashboardLink}
                        disabled={isUpdatingPublicDashboard}
                      >
                        {t("profile.publicDashboardCopy")}
                      </button>
                      <a
                        href={publicDashboard.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn finova-btn-primary"
                      >
                        {t("profile.publicDashboardOpen")}
                      </a>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn finova-btn-light"
                    onClick={handleRotatePublicDashboardLink}
                    disabled={isUpdatingPublicDashboard}
                  >
                    {t("profile.publicDashboardRotate")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={handleRevokePublicDashboardLink}
                    disabled={isUpdatingPublicDashboard}
                  >
                    {t("profile.publicDashboardRevoke")}
                  </button>
                </div>
              </div>
            ) : (
              <p className="finova-subtitle mb-0">{t("profile.publicDashboardEmpty")}</p>
            )}

            {publicDashboardMessage ? (
              <div className="alert alert-success py-2 mb-0 mt-3" role="status">
                {publicDashboardMessage}
              </div>
            ) : null}
          </div>
        ) : null}

        {!isLoading ? (
          <div className="finova-card p-4 p-md-5">
            <div className="d-flex flex-column gap-1 mb-3">
              <h2 className="finova-title h5 mb-0">{t("profile.notificationHistoryTitle")}</h2>
              <p className="finova-subtitle small mb-0">
                {t("profile.notificationHistorySubtitle")}
              </p>
            </div>

            {notificationDeliveries.length === 0 ? (
              <p className="finova-subtitle mb-0">{t("profile.notificationHistoryEmpty")}</p>
            ) : (
              <div className="d-grid gap-3">
                {notificationDeliveries.map((delivery) => (
                  <div key={delivery.id} className="finova-card-soft p-3">
                    <div className="d-flex flex-column flex-md-row justify-content-between gap-2 mb-2">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="finova-badge-neutral">
                          {formatNotificationType(delivery.notificationType, t)}
                        </span>
                      </div>
                      <span className="finova-subtitle small">
                        {formatDateTime(delivery.sentAtUtc)}
                      </span>
                    </div>
                    <div className="fw-medium">{delivery.subject}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function formatNotificationType(notificationType, t) {
  if (notificationType === "goal_alert") {
    return t("profile.notificationTypeGoalAlert");
  }

  if (notificationType === "monthly_report") {
    return t("profile.notificationTypeMonthlyReport");
  }

  return notificationType;
}
