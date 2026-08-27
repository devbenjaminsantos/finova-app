export default function InsightCard({ badge, children, className = "", description, title, tone = "primary" }) {
  return (
    <article className={["finova-insight-card", `finova-insight-card-${tone}`, className].filter(Boolean).join(" ")}>
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <h2 className="finova-title h6 mb-0">{title}</h2>
        {badge ? <span className={`finova-badge-${tone}`}>{badge}</span> : null}
      </div>
      {description ? <p className="finova-subtitle mb-0">{description}</p> : null}
      {children}
    </article>
  );
}
