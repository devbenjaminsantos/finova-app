import { useI18n } from "../../i18n/LanguageProvider";
import SharedInsightCard from "../../components/ui/InsightCard";
import Metric from "../../components/ui/Metric";
import MoneyDelta from "../../components/ui/MoneyDelta";

export function SummaryCard({ label, value, tone = "default" }) {
  return (
    <div className="col-12 col-md-4">
      <Metric className="finova-card-soft h-100 p-4" label={label} value={value} tone={tone} />
    </div>
  );
}

export function ComparisonCard({
  label,
  currentValue,
  previousValue,
  currentRangeLabel,
  previousRangeLabel,
}) {
  const { formatCurrencyFromCents, t } = useI18n();
  const delta = currentValue - previousValue;
  const hasPreviousData = previousValue > 0;
  const percentChange = hasPreviousData ? Math.round((delta / previousValue) * 100) : null;

  const toneText =
    delta > 0
      ? t("dashboardCards.deltaUp")
      : delta < 0
        ? t("dashboardCards.deltaDown")
        : t("dashboardCards.deltaNeutral");

  return (
    <div className="col-12 col-md-4">
      <div className="finova-card-soft h-100 p-4">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
          <div>
            <div className="finova-subtitle small mb-1">{label}</div>
            <div className="finova-title h5 mb-0">{formatCurrencyFromCents(currentValue)}</div>
          </div>
          <MoneyDelta delta={delta} label={toneText} />
        </div>

        <div className="small finova-subtitle mb-2">
          {t("dashboardCards.previousBase", {
            range: previousRangeLabel,
          })}: {formatCurrencyFromCents(previousValue)}
        </div>

        <div className="small">
          {hasPreviousData ? (
            <span className="fw-semibold">
              {t("dashboardCards.percentVsPrevious", {
                percent: `${percentChange > 0 ? "+" : ""}${percentChange}%`,
                range: previousRangeLabel,
              })}
            </span>
          ) : (
            <span className="finova-subtitle">
              {t("dashboardCards.noPreviousBase", {
                range: currentRangeLabel,
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CategoryInsightCard({ title, category, value, tone }) {
  const { formatCurrencyFromCents, t } = useI18n();
  const badgeClass =
    tone === "up"
      ? "finova-badge-expense"
      : tone === "down"
        ? "finova-badge-income"
        : "finova-badge-primary";

  const badgeText =
    tone === "up"
      ? t("dashboardCards.categoryUp")
      : tone === "down"
        ? t("dashboardCards.categoryDown")
        : t("dashboardCards.categoryNeutral");

  return (
    <div className="col-12 col-md-6">
      <div className="finova-card-soft h-100 p-4">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
          <div>
            <div className="finova-subtitle small mb-1">{title}</div>
            <div className="finova-title h5 mb-1">
              {category || t("dashboardCards.noDominantCategory")}
            </div>
            <div className="finova-subtitle small">
              {value > 0
                ? formatCurrencyFromCents(value)
                : t("dashboardCards.noCategoryData")}
            </div>
          </div>
          <span className={badgeClass}>{badgeText}</span>
        </div>
      </div>
    </div>
  );
}

export function InsightCard({ title, description, badge, tone = "primary" }) {
  return (
    <div className="col-12 col-lg-4">
      <SharedInsightCard
        className="finova-card-soft h-100 p-4"
        title={title}
        description={description}
        badge={badge}
        tone={tone}
      />
    </div>
  );
}
