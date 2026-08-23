import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import PasswordToggleButton from "../components/PasswordToggleButton";
import { useI18n } from "../i18n/LanguageProvider";
import { resetPasswordRequest } from "../lib/api/auth";
import { isPasswordStrong } from "../lib/auth/passwordPolicy";

export default function ResetPassword() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError(t("auth.resetInvalidLink"));
      return;
    }

    if (!isPasswordStrong(newPassword)) {
      setError(t("passwordPolicy.message"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("auth.resetConfirmMismatch"));
      return;
    }

    setIsSubmitting(true);

    try {
      await resetPasswordRequest(token, newPassword);
      setSuccess(t("auth.resetSuccess"));
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || t("auth.resetError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="finova-page finova-auth-layout d-flex align-items-center justify-content-center px-3 py-4">
      <div className="finova-auth-shell finova-auth-shell-md">
        <div className="text-center mb-4 finova-auth-hero">
          <BrandMark className="mb-2" size="hero" centered />
          <p className="finova-subtitle mb-0">{t("auth.resetPageSubtitle")}</p>
        </div>

        <div className="finova-card finova-auth-card p-4 p-md-5">
          <div className="mb-4 text-center finova-auth-card-header">
            <h2 className="finova-title h4 mb-2">{t("auth.resetTitle")}</h2>
            <p className="finova-subtitle mb-0">{t("auth.resetSubtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="d-grid gap-3">
            <div>
              <label className="form-label text-dark fw-medium" htmlFor="reset-new-password">
                {t("common.newPassword")}
              </label>
              <div className="input-group">
                <input
                  id="reset-new-password"
                  type={isNewPasswordVisible ? "text" : "password"}
                  className="form-control finova-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting || !!success}
                  required
                />
                <PasswordToggleButton
                  isVisible={isNewPasswordVisible}
                  onToggle={() => setIsNewPasswordVisible((current) => !current)}
                  disabled={isSubmitting || !!success}
                />
              </div>
              <div className="form-text">{t("passwordPolicy.message")}</div>
            </div>

            <div>
              <label className="form-label text-dark fw-medium" htmlFor="reset-confirm-password">
                {t("common.confirmPassword")}
              </label>
              <div className="input-group">
                <input
                  id="reset-confirm-password"
                  type={isConfirmPasswordVisible ? "text" : "password"}
                  className="form-control finova-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting || !!success}
                  required
                />
                <PasswordToggleButton
                  isVisible={isConfirmPasswordVisible}
                  onToggle={() => setIsConfirmPasswordVisible((current) => !current)}
                  disabled={isSubmitting || !!success}
                />
              </div>
            </div>

            {error ? (
              <div className="alert alert-danger py-2 mb-0" role="alert">
                {error}
              </div>
            ) : null}

            {!error && success ? (
              <div className="alert alert-success py-2 mb-0" role="status">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              className="btn finova-btn-primary"
              disabled={isSubmitting || !!success}
            >
              {isSubmitting ? t("auth.submittingReset") : t("auth.submitReset")}
            </button>
          </form>

          <div className="text-center mt-4 finova-auth-footer">
            <Link to="/login" className="text-decoration-none fw-semibold finova-auth-link">
              {t("common.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
