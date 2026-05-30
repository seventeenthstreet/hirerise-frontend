

/**
 * @file components/common/QuotaExhaustedModal.tsx
 * @description Modal overlay shown when a user action is blocked by quota exhaustion.
 *
 * HARDENING — Improvement #3: Quota UX Escalation
 *  Previously, quota exhaustion was silently blocked at the action level.
 *  This modal provides immediate, actionable feedback when any quota-gated
 *  action fails — resume upload, onboarding submit, direction set, rescore.
 *
 * Design decisions:
 *  - Portal-free: renders inline as a fixed overlay (no extra deps)
 *  - Focus-traps via autoFocus on the primary CTA
 *  - Dismissible via Escape key or backdrop click (unless forceUpgrade=true)
 *  - Zero new library dependencies (Tailwind + React only)
 *
 * Usage:
 *   <QuotaExhaustedModal
 *     open={quotaModalOpen}
 *     upgradeUrl="/pricing"
 *     onDismiss={() => setQuotaModalOpen(false)}
 *   />
 */

import { useEffect, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface QuotaExhaustedModalProps {
  /** Controls modal visibility */
  open: boolean;
  /** Upgrade destination — passed through from API 429 response or quota hook */
  upgradeUrl?: string | null;
  /**
   * Called when the user dismisses without upgrading.
   * If omitted the modal is non-dismissible (use for hard blocks).
   */
  onDismiss?: () => void;
  /** Optional override for the modal title */
  title?: string;
  /** Optional override for the body copy */
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function QuotaExhaustedModal({
  open,
  upgradeUrl,
  onDismiss,
  title   = 'Quota exceeded — upgrade required',
  message = "You've used all available credits for this action. Upgrade your plan to continue.",
}: QuotaExhaustedModalProps) {
  const resolvedUpgradeUrl = upgradeUrl ?? '/pricing';
  const isDismissible      = typeof onDismiss === 'function';

  // ── Refs ──────────────────────────────────────────────────────────────────
  // modalRef    : used to query focusable children for trapping + auto-focus
  // triggerRef  : stores the element that had focus before opening so we can
  //               restore it when the modal closes (WCAG 2.1 §2.4.3)
  const modalRef   = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // ── Focus: capture trigger, auto-focus first element on open ─────────────
  useEffect(() => {
    if (!open) return;

    // Remember what had focus before the modal opened
    triggerRef.current = document.activeElement as HTMLElement;

    // Move focus to first interactive element inside the modal
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();
  }, [open]);

  // ── Focus: restore to trigger element on close ────────────────────────────
  useEffect(() => {
    if (open) return;
    triggerRef.current?.focus();
  }, [open]);

  // ── Focus trap: keep Tab/Shift+Tab inside the modal ──────────────────────
  const handleFocusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = Array.from(
      modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab on first element → wrap to last
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab on last element → wrap to first
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // ── Escape key + focus trap listeners ────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDismissible) {
        onDismiss?.();
        return;
      }
      handleFocusTrap(e);
    },
    [isDismissible, onDismiss, handleFocusTrap],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  // ── Body scroll lock ──────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-modal-title"
      aria-describedby="quota-modal-desc"
      onClick={(e) => {
        // Dismiss on backdrop click (not panel click)
        if (e.target === e.currentTarget && isDismissible) {
          onDismiss?.();
        }
      }}
    >
      {/* Panel */}
      <div ref={modalRef} className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">

        {/* Dismiss button (×) — only shown when dismissible */}
        {isDismissible && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {/* Icon */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-6 w-6 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          >
            <path
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Heading */}
        <h2
          id="quota-modal-title"
          className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-100"
        >
          {title}
        </h2>

        {/* Body */}
        <p
          id="quota-modal-desc"
          className="mb-6 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
        >
          {message}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          {/* Primary CTA — upgrade */}
          <a
            href={resolvedUpgradeUrl}
            autoFocus
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            Upgrade plan
          </a>

          {/* Secondary — dismiss (only when dismissible) */}
          {isDismissible && (
            <button
              onClick={onDismiss}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
