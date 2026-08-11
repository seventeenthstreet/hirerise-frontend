/**
 * components/master-data/MasterDataDeleteDialog.tsx
 *
 * Confirmation dialog for archive (soft-delete) actions. Always labelled
 * "Archive", never "Delete", to match the backend semantics — the record
 * is soft-deleted, never destroyed.
 */

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui';

interface MasterDataDeleteDialogProps {
  isOpen: boolean;
  recordLabel: string;
  entityLabel: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MasterDataDeleteDialog({
  isOpen,
  recordLabel,
  entityLabel,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: MasterDataDeleteDialogProps) {
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
        aria-labelledby="master-data-delete-title"
        aria-describedby="master-data-delete-desc"
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl focus:outline-none"
      >
        <h2 id="master-data-delete-title" className="text-base font-semibold text-foreground">
          Archive {entityLabel}?
        </h2>
        <p id="master-data-delete-desc" className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{recordLabel}</span> will be archived and hidden from active
          lists. This can be reversed by an administrator later — it is not a permanent deletion.
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" size="md" onClick={onConfirm} isLoading={isSubmitting}>
            Archive
          </Button>
        </div>
      </div>
    </div>
  );
}
