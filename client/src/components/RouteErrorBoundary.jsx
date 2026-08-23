import { Component } from "react";
import { useI18n } from "../i18n/LanguageProvider";

function RouteErrorFallback() {
  const { t } = useI18n();

  return (
    <div className="py-5 text-center" role="alert">
      <h1 className="finova-title h4">{t("common.routeLoadErrorTitle")}</h1>
      <p className="finova-subtitle">{t("common.routeLoadErrorMessage")}</p>
      <button
        type="button"
        className="btn finova-btn-primary"
        onClick={() => window.location.reload()}
      >
        {t("common.reloadPage")}
      </button>
    </div>
  );
}

class RouteErrorBoundaryClass extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? <RouteErrorFallback /> : this.props.children;
  }
}

export default function RouteErrorBoundary({ children }) {
  return <RouteErrorBoundaryClass>{children}</RouteErrorBoundaryClass>;
}
