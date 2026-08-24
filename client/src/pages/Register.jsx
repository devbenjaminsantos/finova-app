import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import PasswordToggleButton from "../components/PasswordToggleButton";
import { useI18n } from "../i18n/LanguageProvider";
import { hasValidSession, registerRequest } from "../lib/api/auth";
import { isPasswordStrong } from "../lib/auth/passwordPolicy";

export default function Register() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (hasValidSession()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!isPasswordStrong(password)) {
      setError(t("passwordPolicy.message"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await registerRequest(name, email, password);
      setSuccess(
        response.verificationEmailSent
          ? t("auth.registerSuccess")
          : t("auth.registerEmailPending")
      );
      setName("");
      setEmail("");
      setPassword("");
    } catch (requestError) {
      if (requestError.code === "EMAIL_ALREADY_REGISTERED") {
        navigate("/forgot-password", {
          replace: true,
          state: {
            email: email.trim(),
            reason: "email-already-registered",
          },
        });
        return;
      }

      setError(requestError.message || t("auth.registerError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="finova-page finova-auth-layout d-flex align-items-center justify-content-center px-3 py-4">
      <div className="finova-auth-shell finova-auth-shell-sm">
        <div className="text-center mb-4 finova-auth-hero">
          <BrandMark className="mb-2" size="hero" centered />
          <p className="finova-subtitle mb-0">{t("auth.registerPageSubtitle")}</p>
        </div>

        <div className="finova-card finova-auth-card p-4 p-md-5">
          <div className="mb-4 text-center finova-auth-card-header">
            <h2 className="finova-title h4 mb-2">{t("auth.registerTitle")}</h2>
            <p className="finova-subtitle mb-0">{t("auth.registerSubtitle")}</p>
          </div>

          <form onSubmit={handleSubmit} className="d-grid gap-3">
            <div>
              <label className="form-label text-dark fw-medium" htmlFor="register-name">
                {t("common.name")}
              </label>
              <input
                id="register-name"
                type="text"
                className="form-control finova-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("common.preferredNamePlaceholder")}
                disabled={isSubmitting}
                required
              />
              <div className="form-text">{t("common.preferredNameHelp")}</div>
            </div>

            <div>
              <label className="form-label text-dark fw-medium" htmlFor="register-email">
                {t("common.email")}
              </label>
              <input
                id="register-email"
                type="email"
                className="form-control finova-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("common.emailPlaceholder")}
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="form-label text-dark fw-medium" htmlFor="register-password">
                {t("common.password")}
              </label>
              <div className="input-group">
                <input
                  id="register-password"
                  type={isPasswordVisible ? "text" : "password"}
                  className="form-control finova-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("common.password")}
                  disabled={isSubmitting}
                  required
                />
                <PasswordToggleButton
                  isVisible={isPasswordVisible}
                  onToggle={() => setIsPasswordVisible((current) => !current)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="form-text">{t("passwordPolicy.message")}</div>
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

            <button type="submit" className="btn finova-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? t("auth.submittingRegister") : t("auth.submitRegister")}
            </button>
          </form>

          <div className="text-center mt-4 finova-auth-footer">
            <span className="finova-subtitle small">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link to="/login" className="text-decoration-none fw-semibold finova-auth-link">
                {t("auth.signIn")}
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
