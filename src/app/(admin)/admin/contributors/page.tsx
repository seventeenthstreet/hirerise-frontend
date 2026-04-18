// app/(admin)/admin/contributors/page.tsx
'use client';

import { useState } from 'react';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

// ✅ KEEP existing paths until those files are migrated
import {
  useContributors,
  usePromoteContributor,
  useDemoteContributor,
} from '@/hooks/admin/usePending';

import type { Contributor } from '@/services/pendingService';

function Avatar({
  name,
  email,
}: {
  name: string | null;
  email: string;
}) {
  const label = (name || email)[0].toUpperCase();

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hr-100 text-sm font-bold text-hr-700">
      {label}
    </div>
  );
}

export default function ContributorsPage() {
  const [promoteUid, setPromoteUid] = useState('');
  const [promoteEmail, setPromoteEmail] = useState('');
  const [showPromote, setShowPromote] = useState(false);
  const [demoteTarget, setDemoteTarget] =
    useState<Contributor | null>(null);

  const { data, isLoading } = useContributors();
  const promoteMutation = usePromoteContributor();
  const demoteMutation = useDemoteContributor();

  const contributors: Contributor[] = Array.isArray(data?.contributors)
    ? data.contributors
    : [];

  const handlePromote = async () => {
    const uid = promoteUid.trim();
    if (!uid) return;

    await promoteMutation.mutateAsync(uid);

    setPromoteUid('');
    setPromoteEmail('');
    setShowPromote(false);
  };

  const handleDemote = async () => {
    if (!demoteTarget?.id) return;

    await demoteMutation.mutateAsync(demoteTarget.id);
    setDemoteTarget(null);
  };

  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Contributors" />

      <div className="flex-1 space-y-5 overflow-y-auto p-6 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-surface-900">
              Contributor Management
            </h2>
            <p className="text-sm text-surface-500">
              Grant trusted users contributor access to submit content for
              review. Only admins can approve their entries.
            </p>
          </div>

          <Button onClick={() => setShowPromote(true)}>
            Add contributor
          </Button>
        </div>

        <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-800">
          <p className="font-semibold">Role hierarchy</p>
          <ul className="mt-2 space-y-1 text-violet-700">
            <li>🟣 <strong>Master Admin</strong></li>
            <li>🔵 <strong>Admin / Super Admin</strong></li>
            <li>🟡 <strong>Contributor</strong></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-surface-400">
            Active contributors ({contributors.length})
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-surface-100"
                />
              ))}
            </div>
          ) : contributors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 py-14 text-center">
              <p className="text-sm text-surface-500">
                No contributors yet.
              </p>
              <p className="mt-1 text-xs text-surface-400">
                Add a contributor using the button above.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {contributors.map((c: Contributor) => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 rounded-xl border border-surface-100 bg-white px-5 py-3 shadow-card"
                >
                  <Avatar
                    name={c.displayName}
                    email={c.email}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-surface-900">
                      {c.displayName || c.email}
                    </p>
                    <p className="truncate text-xs text-surface-400">
                      {c.email}
                    </p>

                    {c.promotedAt && (
                      <p className="mt-0.5 text-[10px] text-surface-300">
                        Promoted{' '}
                        {new Date(c.promotedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <span className="rounded-full border border-amber-100 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Contributor
                  </span>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDemoteTarget(c)}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPromote && (
        <Modal
          open
          onClose={() => setShowPromote(false)}
          title="Add contributor"
        >
          <div className="space-y-4">
            <p className="text-sm text-surface-600">
              Enter the Supabase user UUID.
            </p>

            <Input
              value={promoteUid}
              onChange={(e) => setPromoteUid(e.target.value)}
              placeholder="UUID"
            />

            <Input
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              placeholder="Optional email"
              type="email"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowPromote(false)}
              >
                Cancel
              </Button>

              <Button
                disabled={!promoteUid.trim()}
                loading={promoteMutation.isPending}
                onClick={handlePromote}
              >
                Grant access
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {demoteTarget && (
        <Modal
          open
          onClose={() => setDemoteTarget(null)}
          title="Revoke contributor access"
        >
          <div className="space-y-4">
            <p className="text-sm text-surface-600">
              Remove contributor access from{' '}
              <strong>
                {demoteTarget.displayName || demoteTarget.email}
              </strong>
              ?
            </p>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDemoteTarget(null)}
              >
                Cancel
              </Button>

              <Button
                variant="danger"
                loading={demoteMutation.isPending}
                onClick={handleDemote}
              >
                Revoke access
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}