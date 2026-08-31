export default function InsightCard({ badge, children, className = "", description, title, tone = "primary" }) {
  return (
    <article className={["hestia-insight-card", `hestia-insight-card-${tone}`, className].filter(Boolean).join(" ")}>
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <h2 className="hestia-title h6 mb-0">{title}</h2>
        {badge ? <span className={`hestia-badge-${tone}`}>{badge}</span> : null}
      </div>
      {description ? <p className="hestia-subtitle mb-0">{description}</p> : null}
      {children}
    </article>
  );
}
