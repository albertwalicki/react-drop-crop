import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Theme } from '../types';
import { cx } from '../core/cx';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  label: string;
  /** Active theme — carried onto the portal so --rdc-* tokens resolve in the portal. */
  theme?: Theme;
  className?: string;
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal: rendered in a portal on document.body, traps focus, closes
 * on Esc / backdrop click, locks body scroll, and restores focus on close.
 */
export function Modal({
  open,
  onClose,
  label,
  theme = 'auto',
  className,
  children,
}: ModalProps): React.ReactPortal | null {
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = (document.activeElement as HTMLElement) ?? null;

    // Lock body scroll.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element (or the card itself).
    const card = cardRef.current;
    const first = card?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? card)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    // `rdc-root` + data-theme re-establish the --rdc-* tokens, since the portal
    // lives on document.body, outside the component's own root element.
    <div
      className={cx('rdc-modal', 'rdc-root', className)}
      data-theme={theme}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="rdc-modal__backdrop" onClick={onClose} />
      <div ref={cardRef} className="rdc-modal__card" tabIndex={-1}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
