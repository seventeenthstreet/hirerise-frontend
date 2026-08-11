/**
 * components/permissions/GovernanceActionPanel.tsx
 *
 * WP-ADMIN-05C — Enterprise Permission Governance Integration (Phase 6:
 * Frontend Integration).
 *
 * Displays a Permission's current lifecycle state and, when one exists,
 * the single next Governance Lifecycle transition (AUTH-04 §6:
 * Proposal -> Approval -> Publication -> Adoption -> Deprecation ->
 * Retirement) — never more than one, since the Lifecycle is strictly
 * forward-only one stage at a time (permission.governance.lifecycle.js).
 *
 * This component implements NO lifecycle rule itself. GOVERNANCE_NEXT_STAGE
 * (lib/api/adminPermissions.ts) only picks which single button to render
 * from the Permission's own `status` field — it is not a legality check.
 * The backend Governance service remains the sole authority: a stale or
 * incorrect client-side guess simply surfaces as a 422
 * GOVERNANCE_INVALID_LIFECYCLE_TRANSITION error (rendered inline below),
 * never as a silently-wrong UI state.
 *
 * Confirm-dialog chrome (overlay, focus trap, ESC-to-cancel, button
 * layout) is modeled directly on RevokeConfirmDialog.tsx — reused
 * pattern, not reimplemented.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { PermissionStatusBadge } from './PermissionStatusBadge';
import { useGovernanceTransition } from '@/hooks/admin/usePermissionsAdmin';
import { GOVERNANCE_NEXT_STAGE, type AdminPermission } from '@/lib/api/adminPermissions';

interface GovernanceActionPanelProps {
  permission: AdminPermission;
}

export function GovernanceActionPanel({ permission }: GovernanceActionPanelProps) {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const transition = useGovernanceTransition();

  const next = GOVERNANCE_NEXT_STAGE[permission.status];
  const isTerminal = permission.lifecycleStage?.isTerminal ?? !next;

  useEffect(() => {
    if (!isConfirmOpen) return;
    panelRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !transition.isPending) setConfirmOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmOpen]);

  if (!next) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Lifecycle</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isTerminal ? 'This Permission is retired — no further transition is possible.' : 'No further transition is available.'}
            </p>
          </div>
          <PermissionStatusBadge status={permission.status} />
        </div>
      </Card>
    );
  }

  const handleConfirm = () => {
    transition.mutate(
      { id: permission.id, stage: next.stage },
      { onSuccess: () => setConfirmOpen(false) }
    );
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Lifecycle</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Currently <PermissionStatusBadge status={permission.status} className="mx-1" /> — next stage is{' '}
            <span className="font-medium text-foreground">{next.label}</span>.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
          {next.label}…
        </Button>
      </div>

      {transition.isError && (
        <p className="mt-3 text-sm text-destructive">
          {transition.error?.message ?? 'That transition was rejected — this Permission may have already moved to a different stage.'}
        </p>
      )}

      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden="true"
            onClick={() => !transition.isPending && setConfirmOpen(false)}
          />
          <div
            ref={panelRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="governance-confirm-title"
            aria-describedby="governance-confirm-desc"
            tabIndex={-1}
            className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl focus:outline-none"
          >
            <h2 id="governance-confirm-title" className="text-base font-semibold text-foreground">
              {next.label} this Permission?
            </h2>
            <p id="governance-confirm-desc" className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{permission.identity}</span> will move from{' '}
              <span className="font-medium text-foreground">{permission.status}</span> to{' '}
              <span className="font-medium text-foreground">{next.stage === 'retire' ? 'retired' : `${next.label.toLowerCase()}d`}</span>.
              {next.stage === 'retire' && ' This is a terminal stage — it cannot be moved forward again.'}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="md" onClick={() => setConfirmOpen(false)} disabled={transition.isPending}>
                Cancel
              </Button>
              <Button type="button" variant="primary" size="md" onClick={handleConfirm} isLoading={transition.isPending}>
                {next.label}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
