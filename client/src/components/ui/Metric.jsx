export default function Metric({ className = "", helper, label, tone = "default", value }) {
  return (
    <div className={["hestia-metric", `hestia-metric-${tone}`, className].filter(Boolean).join(" ")}>
      <span className="hestia-metric-label">{label}</span>
      <strong className="hestia-metric-value">{value}</strong>
      {helper ? <span className="hestia-metric-helper">{helper}</span> : null}
    </div>
  );
}
