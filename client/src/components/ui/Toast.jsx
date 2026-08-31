export default function Toast({ children, className = "", onDismiss, tone = "info", dismissLabel = "Close" }) {
  const isDanger = tone === "danger";

  return (
    <output
      className={["hestia-toast", `hestia-toast-${tone}`, className].filter(Boolean).join(" ")}
      role={isDanger ? "alert" : "status"}
    >
      <span>{children}</span>
      {onDismiss ? (
        <button type="button" className="hestia-toast-dismiss" aria-label={dismissLabel} onClick={onDismiss}>
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </output>
  );
}
