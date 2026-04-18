'use client';

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { RoleImpactAnalyzer } from '@/features/admin/graph-intelligence/RoleImpactAnalyzer';

export default function RoleImpactAnalyzerPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Role Impact Analyzer" />
      <div className="flex-1 overflow-hidden flex flex-col">
        <RoleImpactAnalyzer />
      </div>
    </div>
  );
}