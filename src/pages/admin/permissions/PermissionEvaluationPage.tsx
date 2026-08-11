/**
 * @file src/pages/admin/permissions/PermissionEvaluationPage.tsx
 * @description WP-ADMIN-04F-09 — Enterprise Permission Management UI.
 *
 * Route: /admin/permissions/evaluate
 *
 * Lets an administrator ask "what would happen if principal X attempted
 * action Y on resource Z" and see the Authorization Decision + explanation
 * the certified Evaluation Engine actually returns. The Allow/Deny
 * decision, its reason, and every metadata field displayed by
 * EvaluationResultCard come verbatim from POST /evaluate — this page
 * computes nothing and reproduces no Evaluation Engine logic.
 */

import { useState } from 'react';
import { Card, CardContent, PageShell } from '@/components/ui';
import { MasterDataErrorState } from '@/components/master-data';
import { PrincipalPicker, EvaluationResultCard } from '@/components/permissions';
import { useEvaluateAdminPermission, useAdminPermissionVocabulary } from '@/hooks/admin/usePermissionsAdmin';
import type { AdminUserListItem } from '@/lib/api/adminUsers';

const selectClassName = [
  'h-10 rounded-lg border border-border bg-background px-3 text-sm',
  'text-foreground',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
].join(' ');

const inputClassName = [
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm',
  'text-foreground placeholder:text-muted-foreground',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
].join(' ');

export default function PermissionEvaluationPage() {
  const [principal, setPrincipal] = useState<AdminUserListItem | null>(null);
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [resourceId, setResourceId] = useState('');

  const evaluateMutation = useEvaluateAdminPermission();

  // WP-ADMIN-04F-13B — Registry-driven vocabulary, not narrowed to
  // "assignable" (unlike the Assignment page): Evaluation is meant to
  // answer "what would happen" for any Permission the Registry knows
  // about, including a Deprecated one still resolving to Allow — see
  // this page's own header on why nothing here duplicates that logic.
  const {
    vocabulary: permissionVocabulary,
    isLoading: isLoadingVocabulary,
  } = useAdminPermissionVocabulary();

  const availableResources = permissionVocabulary.resources;
  const availableActions = resource ? permissionVocabulary.actionsForResource(resource) : [];

  function handleResourceChange(nextResource: string) {
    setResource(nextResource);
    setAction('');
  }

  const canEvaluate = Boolean(principal && resource && action) && !evaluateMutation.isPending;

  function handleEvaluate() {
    if (!principal || !resource || !action) return;
    evaluateMutation.mutate({
      principalId: principal.id,
      resource,
      action,
      resourceId: resourceId.trim() || undefined,
    });
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Evaluate a Permission</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask the certified Evaluation Engine what would happen for a given principal, resource, and action.
            The Allow/Deny decision and its explanation come directly from that engine — nothing here is
            computed client-side.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <PrincipalPicker
              value={principal?.id ?? null}
              onChange={(_id, user) => setPrincipal(user)}
            />

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="eval-resource" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Resource
                </label>
                <select
                  id="eval-resource"
                  className={selectClassName}
                  value={resource}
                  onChange={(e) => handleResourceChange(e.target.value)}
                  disabled={isLoadingVocabulary}
                >
                  <option value="">{isLoadingVocabulary ? 'Loading resources…' : 'Select a resource'}</option>
                  {availableResources.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="eval-action" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Action
                </label>
                <select
                  id="eval-action"
                  className={selectClassName}
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  disabled={!resource}
                >
                  <option value="">{resource ? 'Select an action' : 'Select a resource first'}</option>
                  {availableActions.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="eval-resource-id" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Resource ID <span className="font-normal normal-case text-muted-foreground/70">(optional)</span>
                </label>
                <input
                  id="eval-resource-id"
                  type="text"
                  className={inputClassName}
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  placeholder="e.g. a specific record's id"
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleEvaluate}
                disabled={!canEvaluate}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {evaluateMutation.isPending ? 'Evaluating…' : 'Evaluate'}
              </button>
            </div>
          </CardContent>
        </Card>

        {evaluateMutation.isError && (
          <MasterDataErrorState error={evaluateMutation.error} onRetry={handleEvaluate} entityLabelPlural="evaluation results" />
        )}

        {evaluateMutation.isSuccess && evaluateMutation.data && (
          <EvaluationResultCard result={evaluateMutation.data} />
        )}
      </div>
    </PageShell>
  );
}
