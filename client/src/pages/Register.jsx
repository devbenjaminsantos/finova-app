import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import PasswordToggleButton from "../components/PasswordToggleButton";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
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
            <Input
              id="register-name"
              type="text"
              label={t("common.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("common.preferredNamePlaceholder")}
              helpText={t("common.preferredNameHelp")}
              disabled={isSubmitting}
              required
            />

            <Input
              id="register-email"
              type="email"
              label={t("common.email")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("common.emailPlaceholder")}
              disabled={isSubmitting}
              required
            />

            <Input
              id="register-password"
              type={isPasswordVisible ? "text" : "password"}
              label={t("common.password")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("common.password")}
              helpText={t("passwordPolicy.message")}
              endAdornment={
                <PasswordToggleButton
                  isVisible={isPasswordVisible}
                  onToggle={() => setIsPasswordVisible((current) => !current)}
                  disabled={isSubmitting}
                />
              }
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
              </div>
            ) : null}

            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? t("auth.submittingRegister") : t("auth.submitRegister")}
            </Button>
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
