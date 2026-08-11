/**
 * components/administrators/AdministratorLifecycleConfirmDialog.tsx
 *
 * WP-ADMIN-05A — confirmation dialog for the four certified Administrator
 * lifecycle actions (grant/suspend/reactivate/revoke). Modeled on
 * components/permissions/RevokeConfirmDialog.tsx's chrome (overlay, focus
 * trap, ESC-to-cancel, button layout), generalized to one dialog per
 * action instead of one dialog per component, since the four actions share
 * identical mechanics and differ only in copy/severity.
 *
 * This component makes no lifecycle decision — it only asks the admin to
 * confirm an action the page has already determined is available (see
 * adminLifecycle.states.js#canTransition, consumed by AdministratorDetailPage).
 */

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';

export type AdministratorLifecycleAction = 'suspend' | 'reactivate' | 'revoke';

interface AdministratorLifecycleConfirmDialogProps {
  isOpen: boolean;
  action: AdministratorLifecycleAction | null;
  administratorLabel: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const COPY: Record<
  AdministratorLifecycleAction,
  { title: string; body: (label: string) => string; confirmLabel: string; destructive: boolean }
> = {
  suspend: {
    title: 'Suspend this Administrator?',
    body: (label) =>
      `${label} will immediately lose Administrator access. This is reversible — you can reactivate them later.`,
    confirmLabel: 'Suspend',
    destructive: true,
  },
  reactivate: {
    title: 'Reactivate this Administrator?',
    body: (label) => `${label} will regain Administrator access immediately.`,
    confirmLabel: 'Reactivate',
    destructive: false,
  },
  revoke: {
    title: 'Revoke this Administrator?',
    body: (label) =>
      `${label} will permanently lose Administrator access. This cannot be undone — re-granting access requires a new Grant.`,
    confirmLabel: 'Revoke',
    destructive: true,
  },
};

export function AdministratorLifecycleConfirmDialog({
  isOpen,
  action,
  administratorLabel,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: AdministratorLifecycleConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !action) return null;

  const copy = COPY[action];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => !isSubmitting && onCancel()} />

      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-lifecycle-confirm-title"
        aria-describedby="admin-lifecycle-confirm-desc"
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl focus:outline-none"
      >
        <h2 id="admin-lifecycle-confirm-title" className="text-base font-semibold text-foreground">
          {copy.title}
        </h2>
        <p id="admin-lifecycle-confirm-desc" className="mt-2 text-sm text-muted-foreground">
          {copy.body(administratorLabel)}
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={copy.destructive ? 'destructive' : 'primary'}
            size="md"
            onClick={onConfirm}
            isLoading={isSubmitting}
          >
            {copy.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
