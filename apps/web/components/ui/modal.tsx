"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "small" | "medium" | "large";
  closeDisabled?: boolean;
  onClose: () => void;
};

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Modal({ open, title, description, children, footer, size = "medium", closeDisabled = false, onClose }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const modal = modalRef.current;
    const firstFocusable = modal?.querySelector<HTMLElement>(focusableSelector);
    (firstFocusable ?? modal)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled) {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !modal) return;
      const focusable = [...modal.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
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
      previousActive?.focus();
    };
  }, [closeDisabled, open]);

  if (!open) return null;
  const sizeClass = size === "small" ? "dsModal-sm" : size === "large" ? "dsModal-lg" : "";

  return (
    <div className="dsModalBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !closeDisabled) onClose();
    }}>
      <div
        className={["dsModal", sizeClass].filter(Boolean).join(" ")}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="dsModalHeader">
          <div className="dsModalHeaderContent">
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button className="dsModalClose" type="button" onClick={onClose} disabled={closeDisabled} aria-label="Close dialog">×</button>
        </header>
        <div className="dsModalBody">{children}</div>
        {footer && <footer className="dsModalFooter">{footer}</footer>}
      </div>
    </div>
  );
}
