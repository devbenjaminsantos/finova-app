import { useId } from "react";

export default function Select({
  children,
  className = "",
  error,
  helpText,
  id,
  label,
  options,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const helpId = helpText ? `${selectId}-help` : null;
  const errorId = error ? `${selectId}-error` : null;
  const describedBy = [props["aria-describedby"], helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="finova-field">
      {label ? (
        <label className="finova-field-label" htmlFor={selectId}>
          {label}
        </label>
      ) : null}
      <select
        {...props}
        id={selectId}
        className={["form-select", "finova-select", className].filter(Boolean).join(" ")}
        aria-describedby={describedBy}
        aria-invalid={error ? true : props["aria-invalid"]}
      >
        {children ||
          options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
      </select>
      {helpText ? (
        <div id={helpId} className="finova-field-help">
          {helpText}
        </div>
      ) : null}
      {error ? (
        <div id={errorId} className="finova-field-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
