/**
 * components/master-data/MasterDataStatusBanner.tsx
 *
 * Lightweight success/error notification banner. The repo has no toast
 * library and WP-ADMIN-02A §8 prohibits introducing another
 * state-management/UI dependency, so this is a self-contained,
 * dependency-free banner using an aria-live region — reusable by every
 * future Master Data module for create/update/archive notifications.
 */

import { useEffect } from 'react';

export interface MasterDataStatus {
  kind: 'success' | 'error';
  message: string;
}

interface MasterDataStatusBannerProps {
  status: MasterDataStatus | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

export function MasterDataStatusBanner({ status, onDismiss, autoDismissMs = 4000 }: MasterDataStatusBannerProps) {
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!status) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm',
        status.kind === 'success'
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      ].join(' ')}
    >
      <span>{status.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded-md p-1 hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}
