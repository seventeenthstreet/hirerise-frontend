/**
 * components/permissions/PermissionDetailCard.tsx
 *
 * Displays one Permission's Registry metadata (Detail page). Presentation
 * only — every field is rendered verbatim from the certified Registry
 * response; no derived or computed values.
 */

import { Card, CardContent, CardHeader } from '@/components/ui';
import { PermissionStatusBadge } from './PermissionStatusBadge';
import type { AdminPermission } from '@/lib/api/adminPermissions';

interface PermissionDetailCardProps {
  permission: AdminPermission;
}

export function PermissionDetailCard({ permission }: PermissionDetailCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-lg font-semibold text-foreground">{permission.identity}</h2>
          <PermissionStatusBadge status={permission.status} />
        </div>
      </CardHeader>

      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resource</dt>
            <dd className="mt-1 text-sm text-foreground">{permission.resource}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</dt>
            <dd className="mt-1 text-sm text-foreground">{permission.action}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</dt>
            <dd className="mt-1 text-sm text-foreground">{permission.category ?? 'Unavailable'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capability owner</dt>
            <dd className="mt-1 text-sm text-foreground">{permission.capabilityOwner ?? 'Unavailable'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifecycle stage</dt>
            <dd className="mt-1 text-sm text-foreground">{permission.lifecycleStage?.label ?? 'Unavailable'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</dt>
            <dd className="mt-1 text-sm text-foreground">{new Date(permission.createdAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Updated</dt>
            <dd className="mt-1 text-sm text-foreground">{new Date(permission.updatedAt).toLocaleDateString()}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</dt>
            <dd className="mt-1 text-sm text-foreground">{permission.description ?? 'Unavailable'}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}