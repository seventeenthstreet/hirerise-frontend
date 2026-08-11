/**
 * @file src/pages/admin/SettingsPage.tsx
 * @description WP-ADMIN-03 Phase 2 — Settings placeholder landing page.
 *
 * Route: /admin/settings
 *
 * SCOPE: placeholder landing page only, per spec — no implementation.
 * Reuses PageShell + Card, same as every other admin page.
 */

import { PageShell, Card } from '@/components/ui';
import { StatusBadge } from '@/components/admin-dashboard';

export default function SettingsPage() {
  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Platform configuration.</p>
      </div>

      <Card className="p-6">
        <div className="mb-2">
          <StatusBadge variant="coming-soon" />
        </div>
        <p className="text-sm text-muted-foreground">
          Settings are not implemented yet. This page is a placeholder landing page only.
        </p>
      </Card>
    </PageShell>
  );
}
