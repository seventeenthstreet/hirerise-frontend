/**
 * components/permissions/RevokeConfirmDialog.tsx
 *
 * Confirmation dialog for revoking a Permission Assignment. Modeled on
 * components/master-data/MasterDataDeleteDialog.tsx's chrome (overlay,
 * focus trap, ESC-to-cancel, button layout) — but NOT reused directly:
 * that component's copy is hardcoded to soft-delete/archive semantics
 * ("archived and hidden... reversible by an administrator later"),
 * which would misdescribe an access-control revoke to the admin
 * confirming it. A revoke is an immediate authorization change, not a
 * reversible archive, so the copy here says exactly that instead.
 */

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';

interface RevokeConfirmDialogProps {
  isOpen: boolean;
  /** e.g. "user:view" */
  permissionLabel: string;
  /** e.g. "Ada Lovelace" or the raw principal id if the name isn't known */
  principalLabel: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RevokeConfirmDialog({
  isOpen,
  permissionLabel,
  principalLabel,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: RevokeConfirmDialogProps) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => !isSubmitting && onCancel()} />

      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="revoke-confirm-title"
        aria-describedby="revoke-confirm-desc"
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl focus:outline-none"
      >
        <h2 id="revoke-confirm-title" className="text-base font-semibold text-foreground">
          Revoke this Permission?
        </h2>
        <p id="revoke-confirm-desc" className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{principalLabel}</span> will immediately lose the{' '}
          <span className="font-medium text-foreground">{permissionLabel}</span> Permission. This takes effect right
          away — re-granting it requires a new assignment.
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" size="md" onClick={onConfirm} isLoading={isSubmitting}>
            Revoke
          </Button>
        </div>
      </div>
    </div>
  );
}
