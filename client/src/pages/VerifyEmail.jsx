import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import { useI18n } from "../i18n/LanguageProvider";
import { verifyEmailRequest } from "../lib/api/auth";

export default function VerifyEmail() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(true);

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!token) {
        setError(t("auth.verifyInvalidLink"));
        setIsSubmitting(false);
        return;
      }

      try {
        await verifyEmailRequest(token);
        if (!active) {
          return;
        }

        setSuccess(t("auth.verifySuccess"));
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(requestError.message || t("auth.verifyError"));
      } finally {
        if (active) {
          setIsSubmitting(false);
        }
      }
    }

    verify();

    return () => {
      active = false;
    };
  }, [token, t]);

  return (
    <div className="finova-page finova-auth-layout d-flex align-items-center justify-content-center px-3 py-4">
      <div className="finova-auth-shell finova-auth-shell-md">
        <div className="text-center mb-4 finova-auth-hero">
          <BrandMark className="mb-2" size="hero" centered />
          <p className="finova-subtitle mb-0">{t("auth.verifySubtitle")}</p>
        </div>

        <div className="finova-card finova-auth-card p-4 p-md-5 text-center">
          <div className="finova-auth-card-header mb-4">
            <h2 className="finova-title h4 mb-2">{t("auth.verifyTitle")}</h2>
            <p className="finova-subtitle mb-0">{t("auth.verifySubtitle")}</p>
          </div>

          {isSubmitting ? (
            <div className="alert alert-info py-2 mb-0" role="status">
              {t("auth.verifySubmitting")}
            </div>
          ) : null}

          {!isSubmitting && error ? (
            <div className="alert alert-danger py-2 mb-0" role="alert">
              {error}
            </div>
          ) : null}

          {!isSubmitting && !error && success ? (
            <div className="alert alert-success py-2 mb-0" role="status">
              {success}
            </div>
          ) : null}

          <div className="text-center mt-4 finova-auth-footer">
            <Link to="/login" className="text-decoration-none fw-semibold finova-auth-link">
              {t("auth.goToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
