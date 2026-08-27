export default function Toast({ children, className = "", onDismiss, tone = "info", dismissLabel = "Close" }) {
  const isDanger = tone === "danger";

  return (
    <output
      className={["finova-toast", `finova-toast-${tone}`, className].filter(Boolean).join(" ")}
      role={isDanger ? "alert" : "status"}
    >
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" className="finova-toast-dismiss" aria-label={dismissLabel} onClick={onDismiss}>
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </output>
  );
}
