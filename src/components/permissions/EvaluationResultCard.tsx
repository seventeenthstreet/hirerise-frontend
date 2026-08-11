/**
 * components/permissions/EvaluationResultCard.tsx
 *
 * Displays the Authorization Decision + explanation returned verbatim by
 * POST /evaluate (permission.evaluation.engine.js's EvaluationResult).
 * Presentation only — the allow/deny outcome, reason text, and every
 * metadata field come straight from the backend response; this component
 * makes no authorization decision and derives nothing.
 */

import { Card, CardContent, CardHeader } from '@/components/ui';
import { PermissionStatusBadge } from './PermissionStatusBadge';
import type { EvaluationResult } from '@/lib/api/adminPermissions';

interface EvaluationResultCardProps {
  result: EvaluationResult;
}

export function EvaluationResultCard({ result }: EvaluationResultCardProps) {
  const { decision, explanation } = result;
  const isAllow = decision.outcome === 'allow';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span
            className={[
              'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
              isAllow
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive',
            ].join(' ')}
          >
            {isAllow ? 'Allow' : 'Deny'}
          </span>
          <span className="font-mono text-sm text-muted-foreground">{explanation.permission}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reason</dt>
          <dd className="mt-1 text-sm text-foreground">{decision.reason ?? '—'}</dd>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resource</dt>
            <dd className="mt-1 text-sm text-foreground">{explanation.resource}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</dt>
            <dd className="mt-1 text-sm text-foreground">{explanation.action}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Permission status</dt>
            <dd className="mt-1">
              <PermissionStatusBadge status={explanation.metadata.permissionStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifecycle stage</dt>
            <dd className="mt-1 text-sm text-foreground">{explanation.metadata.lifecycleStage?.label ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</dt>
            <dd className="mt-1 text-sm text-foreground">{explanation.metadata.category ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deprecated</dt>
            <dd className="mt-1 text-sm text-foreground">{explanation.metadata.deprecated ? 'Yes' : 'No'}</dd>
          </div>
        </dl>

        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decided at</dt>
          <dd className="mt-1 text-sm text-foreground">{new Date(decision.decidedAt).toLocaleString()}</dd>
        </div>
      </CardContent>
    </Card>
  );
}