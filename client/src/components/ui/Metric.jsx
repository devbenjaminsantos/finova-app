export default function Metric({ className = "", helper, label, tone = "default", value }) {
  return (
    <div className={["finova-metric", `finova-metric-${tone}`, className].filter(Boolean).join(" ")}>
      <span className="finova-metric-label">{label}</span>
      <strong className="finova-metric-value">{value}</strong>
      {helper ? <span className="finova-metric-helper">{helper}</span> : null}
    </div>
  );
}
