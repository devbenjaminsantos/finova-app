export default function BudgetProgress({ className = "", label, progress, tone = "safe" }) {
  const percentage = Math.min(Math.max(Number(progress) || 0, 0), 100);

  return (
    <div className={["finova-budget-progress", className].filter(Boolean).join(" ")}>
      <div
        className="finova-goal-progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(percentage)}
      >
        <div
          className={`finova-goal-progress-bar finova-goal-progress-bar-${tone}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
