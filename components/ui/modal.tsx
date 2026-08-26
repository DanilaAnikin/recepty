"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modální okno s pastí na fokus.
 *
 * Posluchač klávesnice visí na uzlu modalu, ne na dokumentu: u naskládaných
 * modalů (výběr ingredience nad formulářem receptu) má fokus jen ten vrchní,
 * takže Escape zavře právě jeho a ne celý komín.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  size = "regular",
  bodyClassName,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "regular" | "wide" | "full";
  bodyClassName?: string;
}) {
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modalNode = windowRef.current;
    const previouslyFocused =
      typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;

    if (modalNode) {
      const focusable = modalNode.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable ?? modalNode).focus();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !modalNode) {
        return;
      }

      const focusableElements = Array.from(
        modalNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

      if (focusableElements.length === 0) {
        event.preventDefault();
        modalNode.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || active === modalNode) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    modalNode?.addEventListener("keydown", handleKeyDown);

    // Pozadí se nesmí posouvat pod otevřeným modalem.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      modalNode?.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        // Zavírá jen kliknutí do překryvu, ne tažení výběru textu zevnitř ven.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={windowRef}
        className={`modal-window${size === "wide" ? " wide" : size === "full" ? " full" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-button ghost" onClick={onClose} aria-label="Zavřít">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className={bodyClassName ? `modal-body ${bodyClassName}` : "modal-body"}>{children}</div>

        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
