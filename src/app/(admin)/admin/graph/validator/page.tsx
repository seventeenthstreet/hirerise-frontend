'use client';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { GraphValidatorPanel } from '@/features/admin/graph/GraphDataConsole';
export default function Page() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Graph Validator" />
      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-surface-900">Graph Validator</h2>
          <p className="mt-1 text-sm text-surface-500">Run integrity checks across all graph collections. Detects orphan nodes, broken foreign keys, and missing relationships.</p>
        </div>
        <GraphValidatorPanel />
      </div>
    </div>
  );
}