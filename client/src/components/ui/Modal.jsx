import { useEffect, useId, useRef } from "react";

function getFocusableElements(element) {
  return Array.from(
    element?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || []
  );
}

export default function Modal({
  children,
  className = "",
  closeLabel = "Close",
  dismissible = true,
  footer,
  isOpen,
  onClose,
  size = "md",
  subtitle,
  title,
}) {
  const generatedTitleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    const focusDialog = () => {
      const focusable = getFocusableElements(dialogRef.current);
      (focusable.find((element) => element.hasAttribute("data-modal-initial-focus")) || focusable[0] || dialogRef.current)?.focus();
    };

    document.body.style.overflow = "hidden";
    focusDialog();

    function handleKeyDown(event) {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(dialogRef.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [dismissible, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal d-block hestia-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={`modal-dialog modal-dialog-centered modal-${size} ${className}`.trim()}>
        <div
          ref={dialogRef}
          className="modal-content border-0 hestia-modal-surface"
          role="dialog"
          aria-modal="true"
          aria-labelledby={generatedTitleId}
          tabIndex="-1"
        >
          <div className="modal-header border-0 pb-0 px-4 pt-4 hestia-modal-header">
            <div>
              <h2 id={generatedTitleId} className="hestia-title h4 mb-1">{title}</h2>
              {subtitle ? <p className="hestia-subtitle small mb-0">{subtitle}</p> : null}
            </div>

            {dismissible ? (
              <button
                type="button"
                className="btn-close hestia-modal-close hestia-icon-tooltip"
                aria-label={closeLabel}
                title={closeLabel}
                data-tooltip={closeLabel}
                onClick={onClose}
              />
            ) : null}
          </div>

          <div className="modal-body px-4 pb-4 pt-3">{children}</div>
          {footer ? <div className="modal-footer border-0 px-4 pb-4 pt-0">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
