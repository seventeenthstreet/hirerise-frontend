'use client';

// app/(admin)/admin/cms/skill-clusters/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { SkillClusterTable } from '@/features/admin/cms/skill-clusters/components/SkillClusterTable';

export default function AdminSkillClustersPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Skill Clusters" />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-surface-900">
            Skill Clusters
          </h2>

          <p className="mt-1 text-sm text-surface-500">
            Manage skill clusters grouped under
            career domains. Skill clusters power
            skill grouping, career matching, and
            the CHI Engine.
          </p>
        </div>

        <SkillClusterTable />
      </div>
    </div>
  );
}