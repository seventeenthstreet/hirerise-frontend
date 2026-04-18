'use client';

// features/admin/secrets/components/SecretsTable.tsx
//
// Table listing all secrets with safe metadata only.
// Secret values are NEVER displayed — only masked previews on demand.

import { useState } from 'react';
import { useSecrets, useSecretStatus, useDeleteSecret } from '../hooks/useSecrets';
import { SecretModal }    from './SecretModal';
import { Button }         from '@/components/ui/Button';
import { Badge }          from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal }          from '@/components/ui/Modal';
import type { SecretMeta, SecretModalMode, SecretModalState } from '@/types/secrets';
import { AI_ROUTER_SECRETS } from '@/types/secrets';

// ─── Masked preview cell ──────────────────────────────────────────────────────

function MaskedPreviewCell({ name }: { name: string }) {
  const [reveal, setReveal] = useState(false);
  const { data, isFetching } = useSecretStatus(name, reveal);

  if (!reveal) {
    return (
      <button
        onClick={() => setReveal(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-surface-400
          hover:bg-surface-50 hover:text-surface-700 transition-colors border border-dashed border-surface-200"
        title="Reveal masked preview"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Show preview
      </button>
    );
  }

  if (isFetching) {
    return <span className="text-xs text-surface-400 font-mono">loading…</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded bg-surface-100 px-2 py-0.5 text-xs font-mono text-surface-700 select-none">
        {data?.maskedPreview ?? '****'}
      </code>
      <button
        onClick={() => setReveal(false)}
        className="text-[10px] text-surface-400 hover:text-surface-600 transition-colors"
      >
        hide
      </button>
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  secret,
  onConfirm,
  onClose,
  isDeleting,
}: {
  secret:     SecretMeta;
  onConfirm:  () => void;
  onClose:    () => void;
  isDeleting: boolean;
}) {
  return (
    <Modal open={true} onClose={onClose} title="Delete Secret" size="sm">
      <div className="space-y-4 py-1">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">
            <strong>This cannot be undone.</strong> The secret{' '}
            <code className="rounded bg-red-100 px-1 font-mono font-semibold">{secret.name}</code>{' '}
            will be permanently deleted. Any backend service relying on it will fail.
          </p>
        </div>
        <p className="text-sm text-surface-600">
          Make sure no active service is using this secret before deleting.
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

// ─── AI Router coverage panel ─────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  PRIMARY:      'bg-emerald-100 text-emerald-700',
  FALLBACK:     'bg-blue-100 text-blue-700',
  BACKUP:       'bg-violet-100 text-violet-700',
  EMERGENCY:    'bg-amber-100 text-amber-700',
  'LAST RESORT':'bg-rose-100 text-rose-700',
};

function AiRouterCoveragePanel({ storedNames }: { storedNames: string[] }) {
  const stored = new Set(storedNames);
  const configuredCount = AI_ROUTER_SECRETS.filter(p => stored.has(p.name)).length;
  const total = AI_ROUTER_SECRETS.length;

  return (
    <div className="rounded-xl border border-surface-100 bg-white shadow-sm overflow-hidden mb-6">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 bg-surface-50/60">
        <div className="flex items-center gap-2.5">
          <svg className="h-4 w-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
          </svg>
          <span className="text-sm font-semibold text-surface-800">AI Router — Provider Coverage</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold tabular-nums ${
            configuredCount === total ? 'text-emerald-600' :
            configuredCount >= 3     ? 'text-amber-600'   : 'text-red-600'
          }`}>
            {configuredCount}/{total} configured
          </span>
          {configuredCount === total && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Full coverage
            </span>
          )}
          {configuredCount < total && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              Incomplete
            </span>
          )}
        </div>
      </div>

      {/* Provider rows */}
      <div className="divide-y divide-surface-50">
        {AI_ROUTER_SECRETS.map((provider, index) => {
          const isStored = stored.has(provider.name);
          return (
            <div key={provider.name}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-50/50 transition-colors">
              {/* Order indicator */}
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-100 text-[10px] font-bold text-surface-500">
                {index + 1}
              </span>

              {/* Status dot */}
              <span className={`flex h-2 w-2 shrink-0 rounded-full ${
                isStored ? 'bg-emerald-500' : 'bg-surface-300'
              }`} />

              {/* Provider name */}
              <code className="text-xs font-mono font-semibold text-surface-800 w-40 shrink-0">
                {provider.name}
              </code>

              {/* Label */}
              <span className="text-xs text-surface-500 w-24 shrink-0">{provider.label}</span>

              {/* Priority badge */}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                PRIORITY_COLORS[provider.priority] ?? 'bg-surface-100 text-surface-600'
              }`}>
                {provider.priority}
              </span>

              {/* Status */}
              <span className="ml-auto text-[11px] font-medium">
                {isStored ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Stored
                  </span>
                ) : (
                  <span className="text-surface-400 flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Not added
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      {configuredCount < total && (
        <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100">
          <p className="text-[11px] text-amber-700">
            <strong>{total - configuredCount} key{total - configuredCount !== 1 ? 's' : ''} missing.</strong>
            {' '}The AI router will skip unconfigured providers and fall back to the next available one.
            Add missing keys above using the <strong>Add Secret</strong> button.
          </p>
        </div>
      )}
    </div>
  );
}

export function SecretsTable() {
  const { data, isLoading, isError } = useSecrets();
  const deleteMutation = useDeleteSecret();

  const [modal, setModal] = useState<SecretModalState>({
    open: false, mode: 'create', secret: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<SecretMeta | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSaved = (name: string, isNew: boolean) => {
    showToast(isNew ? `Secret "${name}" created.` : `Secret "${name}" updated.`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.name);
    setDeleteTarget(null);
    showToast(`Secret "${deleteTarget.name}" deleted.`);
  };

  // data is SecretMeta[] directly (apiFetch unwraps the { success, data } envelope)
  const secrets = data ?? [];
  const storedNames = secrets.map(s => s.name);

  return (
    <div className="space-y-4">

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-green-200
          bg-white px-4 py-3 shadow-lg shadow-surface-900/10 animate-slide-up">
          <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-surface-800">{toast}</span>
        </div>
      )}

      {/* AI Router coverage panel — always visible, updates as secrets load */}
      <AiRouterCoveragePanel storedNames={isLoading ? [] : storedNames} />

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-surface-500">
            {isLoading
              ? 'Loading…'
              : `${secrets.length} secret${secrets.length !== 1 ? 's' : ''} stored`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setModal({ open: true, mode: 'create', secret: null })}
          leftIcon={
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add Secret
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-8 text-center">
          <p className="text-sm text-red-700">Failed to load secrets. Please refresh.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && secrets.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-surface-200 py-16 text-center">
          <svg className="mx-auto mb-3 h-8 w-8 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-surface-500">No secrets stored yet</p>
          <p className="mt-1 text-xs text-surface-400">
            Add API keys, tokens, and credentials for backend services.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setModal({ open: true, mode: 'create', secret: null })}
          >
            Add your first secret
          </Button>
        </div>
      )}

      {/* Table */}
      {!isLoading && secrets.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-surface-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400 w-52">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400 w-44">
                  Preview
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-surface-400 w-36">
                  Last Updated
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-surface-400 w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-50">
              {secrets.map(secret => (
                <tr key={secret.id} className="hover:bg-surface-50/50 transition-colors">

                  {/* Name */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <svg className="h-3.5 w-3.5 shrink-0 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      </svg>
                      <code className="font-mono font-semibold text-surface-900 text-xs">
                        {secret.name}
                      </code>
                    </div>
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3.5 text-surface-500 text-xs">
                    {secret.description || (
                      <span className="text-surface-300 italic">No description</span>
                    )}
                  </td>

                  {/* Masked preview — lazy loaded */}
                  <td className="px-4 py-3.5">
                    <MaskedPreviewCell name={secret.name} />
                  </td>

                  {/* Last updated */}
                  <td className="px-4 py-3.5">
                    <div className="text-xs text-surface-500">
                      {new Date(secret.updatedAt).toLocaleDateString('en-GB', {
                        day:   '2-digit',
                        month: 'short',
                        year:  'numeric',
                      })}
                    </div>
                    <div className="text-[11px] text-surface-400 mt-0.5 font-mono truncate" title={secret.updatedBy}>
                      {secret.updatedBy.substring(0, 12)}…
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Update secret value"
                        onClick={() => setModal({ open: true, mode: 'edit', secret })}
                        className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        title="Delete secret"
                        onClick={() => setDeleteTarget(secret)}
                        className="rounded-lg p-1.5 text-surface-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Security footer */}
      {!isLoading && secrets.length > 0 && (
        <p className="text-center text-[11px] text-surface-300 pb-1">
          All secrets are encrypted with AES-256-GCM at rest · Values are never returned by the API · Tamper-sealed with HMAC-SHA256
        </p>
      )}

      {/* Modals */}
      <SecretModal
        open={modal.open}
        mode={modal.mode}
        secret={modal.secret}
        onClose={() => setModal(m => ({ ...m, open: false }))}
        onSaved={handleSaved}
      />

      {deleteTarget && (
        <DeleteConfirmModal
          secret={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}