'use client';

// features/admin/cms/components/DeleteConfirmModal.tsx
// Reusable delete confirmation used by all CMS tables.

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DeleteConfirmModalProps {
  open:      boolean;
  name:      string;
  entity?:   string;  // e.g. 'role', 'skill' — used in copy
  isPending: boolean;
  onConfirm: () => void;
  onClose:   () => void;
}

export function DeleteConfirmModal({
  open, name, entity = 'record', isPending, onConfirm, onClose,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Delete ${entity}`}
      description={`Are you sure you want to delete "${name}"? This is a soft delete — the record will be hidden from the platform but can be restored from the database.`}
      size="sm"
    >
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant="danger" loading={isPending} onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}