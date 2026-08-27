import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import PasswordToggleButton from "../components/PasswordToggleButton";
import Button from "../components/ui/Button";
import { useI18n } from "../i18n/LanguageProvider";
import {
  consumePostLoginRedirect,
  consumeStoredLogoutReason,
  demoLoginRequest,
  getLogoutMessageKey,
  hasValidSession,
  loginRequest,
  resendEmailVerificationRequest,
} from "../lib/api/auth";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState(null);
  const [info, setInfo] = useState(() => {
    const messageKey = getLogoutMessageKey(consumeStoredLogoutReason());
    return messageKey ? t(messageKey) : "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoSubmitting, setIsDemoSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  if (hasValidSession()) {
    return <Navigate to="/" replace />;
  }

  const shouldShowResendVerification =
    errorCode === "EMAIL_NOT_CONFIRMED" && email.trim();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setErrorCode(null);
    setInfo("");
    setIsSubmitting(true);

    try {
      await loginRequest(email, password);
      setInfo(t("auth.loginSuccess"));
      navigate(consumePostLoginRedirect(), { replace: true });
    } catch (requestError) {
      setError(requestError.message || t("auth.loginError"));
      setErrorCode(requestError.code || null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setError("");
    setErrorCode(null);
    setInfo(t("auth.preparingDemo"));
    setIsDemoSubmitting(true);

    try {
      await demoLoginRequest();
      setInfo(t("auth.demoReady"));
      navigate(consumePostLoginRedirect(), { replace: true });
    } catch (requestError) {
      setError(requestError.message || t("auth.demoError"));
      setInfo("");
    } finally {
      setIsDemoSubmitting(false);
    }
  }

  async function handleResendVerification() {
    if (!email.trim()) {
      return;
    }

    setIsResendingVerification(true);

    try {
      await resendEmailVerificationRequest(email);
      setInfo(t("auth.resendVerificationSuccess"));
    } catch (requestError) {
      setError(requestError.message || t("auth.verifyError"));
    } finally {
      setIsResendingVerification(false);
    }
  }

  const demoHighlights = t("auth.demoHighlights");

  return (
    <div className="finova-page finova-auth-layout d-flex align-items-center justify-content-center px-3 py-4">
      <div className="finova-auth-shell finova-auth-shell-lg">
        <div className="text-center mb-4 finova-auth-hero">
          <BrandMark className="mb-2" size="hero" centered />
          <p className="finova-subtitle mb-0">{t("auth.loginPageSubtitle")}</p>
        </div>

        <div className="finova-card finova-auth-card p-4 p-md-5">
          <div className="mb-4 text-center finova-auth-card-header">
            <h2 className="finova-title h4 mb-2">{t("auth.loginTitle")}</h2>
            <p className="finova-subtitle mb-0">{t("auth.loginSubtitle")}</p>
          </div>

          <div className="finova-demo-panel p-4 mb-4">
            <div className="d-flex flex-column flex-md-row justify-content-between gap-3 align-items-start">
              <div>
                <div className="small text-uppercase fw-semibold text-primary mb-2">
                  {t("auth.demoEyebrow")}
                </div>
                <h3 className="finova-title h5 mb-2">{t("auth.demoTitle")}</h3>
                <p className="finova-subtitle mb-3">{t("auth.demoDescription")}</p>
                <div className="d-grid gap-2 finova-auth-highlight-list">
                  {demoHighlights.map((item) => (
                    <div key={item} className="small text-muted finova-auth-highlight-item">
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="button"
                className="px-4"
                onClick={handleDemoLogin}
                loading={isDemoSubmitting}
                disabled={isSubmitting || isResendingVerification}
              >
                {isDemoSubmitting ? t("auth.demoButtonLoading") : t("auth.demoButton")}
              </Button>
            </div>
          </div>

          <div className="finova-divider mb-4">
            <hr />
            <span className="finova-subtitle small">{t("auth.demoDivider")}</span>
            <hr />
          </div>

          <form onSubmit={handleSubmit} className="d-grid gap-3">
            <div>
              <label className="form-label text-dark fw-medium" htmlFor="login-email">
                {t("common.email")}
              </label>
              <input
                id="login-email"
                type="email"
                className="form-control finova-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("common.emailPlaceholder")}
                disabled={isSubmitting || isDemoSubmitting || isResendingVerification}
                required
              />
            </div>

            <div>
              <div className="d-flex justify-content-between align-items-center">
                <label className="form-label text-dark fw-medium" htmlFor="login-password">
                  {t("common.password")}
                </label>
                <Link
                  to="/forgot-password"
                  className="small text-decoration-none fw-semibold mb-2 finova-auth-link"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <div className="input-group">
                <input
                  id="login-password"
                  type={isPasswordVisible ? "text" : "password"}
                  className="form-control finova-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("common.password")}
                  disabled={isSubmitting || isDemoSubmitting || isResendingVerification}
                  required
                />
                <PasswordToggleButton
                  isVisible={isPasswordVisible}
                  onToggle={() => setIsPasswordVisible((current) => !current)}
                  disabled={isSubmitting || isDemoSubmitting || isResendingVerification}
                />
              </div>
            </div>

            {error ? (
              <div className="alert alert-danger py-2 mb-0" role="alert">
                <div>{error}</div>
                {shouldShowResendVerification ? (
                  <Button
                    type="button"
                    variant="link"
                    className="mt-2 finova-auth-link"
                    onClick={handleResendVerification}
                    loading={isResendingVerification}
                  >
                    {isResendingVerification
                      ? t("auth.resendingVerification")
                      : t("auth.resendVerification")}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {!error && info ? (
              <div className="alert alert-info py-2 mb-0" role="status">
                {info}
              </div>
            ) : null}

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isDemoSubmitting || isResendingVerification}
            >
              {isSubmitting ? t("auth.submittingLogin") : t("auth.submitLogin")}
            </Button>
          </form>

          <div className="text-center mt-4 finova-auth-footer">
            <span className="finova-subtitle small">
              {t("auth.noAccount")}{" "}
              <Link to="/register" className="text-decoration-none fw-semibold finova-auth-link">
                {t("auth.createAccount")}
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
