export default function EmptyState({ action, className = "", description, title, titleAs = "h2" }) {
  return (
    <div className={["finova-empty-state", className].filter(Boolean).join(" ")}>
      {titleAs === "h4" ? (
        <h4 className="finova-title h6 mb-0">{title}</h4>
      ) : titleAs === "h3" ? (
        <h3 className="finova-title h6 mb-0">{title}</h3>
      ) : (
        <h2 className="finova-title h6 mb-0">{title}</h2>
      )}
      {description ? <p className="finova-subtitle mb-0">{description}</p> : null}
      {action ? <div className="finova-empty-state-action">{action}</div> : null}
    </div>
  );
}
