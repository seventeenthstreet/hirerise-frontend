'use client';

// app/(admin)/admin/graph/page.tsx
// Graph Data Management Console — main landing page for graph admin

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { GraphDataConsole } from '@/features/admin/graph/GraphDataConsole';

export default function GraphAdminPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Graph Data Management Console" />
      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-surface-900">Graph Data Management Console</h2>
          <p className="mt-1 text-sm text-surface-500">
            Manage Career Graph and Skill Graph datasets. Upload CSVs, validate foreign keys, preview before import, and check graph integrity.
          </p>
        </div>
        <GraphDataConsole />
      </div>
    </div>
  );
}