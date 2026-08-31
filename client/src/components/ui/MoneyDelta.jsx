export default function MoneyDelta({ className = "", delta = 0, label }) {
  const tone = delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral";

  return (
    <span className={["hestia-money-delta", `hestia-money-delta-${tone}`, className].filter(Boolean).join(" ")}>
      {label}
    </span>
  );
}
