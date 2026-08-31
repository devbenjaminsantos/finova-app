import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useI18n } from "../i18n/LanguageProvider";
import { forgotPasswordRequest } from "../lib/api/auth";

export default function ForgotPassword() {
  const { t } = useI18n();
  const location = useLocation();
  const redirectedFromRegistration =
    location.state?.reason === "email-already-registered";
  const [email, setEmail] = useState(
    redirectedFromRegistration && typeof location.state?.email === "string"
      ? location.state.email
      : ""
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setResetUrl("");
    setIsSubmitting(true);

    try {
      const response = await forgotPasswordRequest(email);
      setSuccess(t("auth.forgotSuccess"));
      setResetUrl(response.resetUrl || "");
    } catch (err) {
      setError(err.message || t("auth.forgotError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const localResetPath = resetUrl
    ? (() => {
        try {
          const parsed = new URL(resetUrl);
          return `${parsed.pathname}${parsed.search}`;
        } catch {
          return "";
        }
      })()
    : "";

  return (
    <div className="hestia-page hestia-auth-layout d-flex align-items-center justify-content-center px-3 py-4">
      <div className="hestia-auth-shell hestia-auth-shell-md">
        <div className="text-center mb-4 hestia-auth-hero">
          <BrandMark className="mb-2" size="hero" centered />
          <p className="hestia-subtitle mb-0">{t("auth.forgotPageSubtitle")}</p>
        </div>

        <div className="hestia-card hestia-auth-card p-4 p-md-5">
          <div className="mb-4 text-center hestia-auth-card-header">
            <h2 className="hestia-title h4 mb-2">{t("auth.forgotTitle")}</h2>
            <p className="hestia-subtitle mb-0">{t("auth.forgotSubtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="d-grid gap-3">
            {redirectedFromRegistration && !error && !success ? (
              <div className="alert alert-warning py-2 mb-0" role="status">
                {t("auth.emailAlreadyRegisteredError")}
              </div>
            ) : null}

            <Input
              id="forgot-password-email"
              type="email"
              label={t("common.email")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("common.emailPlaceholder")}
              disabled={isSubmitting}
              required
            />

            {error ? (
              <div className="alert alert-danger py-2 mb-0" role="alert">
                {error}
              </div>
            ) : null}

            {!error && success ? (
              <div className="alert alert-success py-2 mb-0" role="status">
                {success}
                {localResetPath ? (
                  <div className="mt-2">
                    <Link to={localResetPath} className="fw-semibold hestia-auth-link">
                      {t("auth.openResetLink")}
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? t("auth.submittingForgot") : t("auth.submitForgot")}
            </Button>
          </form>

          <div className="text-center mt-4 hestia-auth-footer">
            <Link to="/login" className="text-decoration-none fw-semibold hestia-auth-link">
              {t("common.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
