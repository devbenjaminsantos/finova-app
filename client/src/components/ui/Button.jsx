export default function Button({
  children,
  className = "",
  disabled = false,
  loading = false,
  type = "button",
  variant = "primary",
  ...props
}) {
  const classes = ["btn", "hestia-button", `hestia-button-${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
