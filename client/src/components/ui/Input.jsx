import { useId } from "react";

export default function Input({
  className = "",
  endAdornment,
  error,
  helpText,
  id,
  label,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const helpId = helpText ? `${inputId}-help` : null;
  const errorId = error ? `${inputId}-error` : null;
  const describedBy = [props["aria-describedby"], helpId, errorId].filter(Boolean).join(" ") || undefined;

  const input = (
    <input
      {...props}
      id={inputId}
      className={["form-control", "finova-input", className].filter(Boolean).join(" ")}
      aria-describedby={describedBy}
      aria-invalid={error ? true : props["aria-invalid"]}
    />
  );

  return (
    <div className="finova-field">
      {label ? (
        <label className="finova-field-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      {endAdornment ? <div className="input-group">{input}{endAdornment}</div> : input}
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
