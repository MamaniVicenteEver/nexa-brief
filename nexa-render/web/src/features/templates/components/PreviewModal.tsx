"use client";

import { Maximize2, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./PreviewModal.css";

interface PreviewModalProps {
  title: string;
  openLabel: string;
  closeLabel: string;
  details?: ReactNode;
  children: ReactNode;
}

/** Visor ampliado compartido: mantiene el encuadre completo del preview. */
export function PreviewModal({
  title,
  openLabel,
  closeLabel,
  details,
  children,
}: PreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="nr-preview-modal__open"
        onClick={() => setIsOpen(true)}
        aria-label={openLabel}
      >
        <Maximize2 size={14} />
        <span>{openLabel}</span>
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="nr-preview-modal__backdrop" role="presentation">
              <button
                type="button"
                className="nr-preview-modal__dismiss"
                onClick={() => setIsOpen(false)}
                aria-label={closeLabel}
              />
              <section
                className="nr-preview-modal__dialog"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="nr-preview-modal__header">
                  <span>{title}</span>
                  <button
                    type="button"
                    className="nr-preview-modal__close"
                    onClick={() => setIsOpen(false)}
                    aria-label={closeLabel}
                  >
                    <X size={18} />
                  </button>
                </header>
                {details ? <div className="nr-preview-modal__details">{details}</div> : null}
                <div className="nr-preview-modal__screen">{children}</div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
