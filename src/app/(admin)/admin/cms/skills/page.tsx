// app/(admin)/admin/cms/skills/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { SkillTable } from '@/features/admin/cms/skills/components/SkillTable';

export default function AdminSkillsPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Skills" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-surface-900">
            Skill Catalog
          </h2>
          <p className="mt-1 text-sm text-surface-500">
            Manage the skill catalog. Skills power Skill Gap Analysis, Career
            Health Index, and Resume Scoring.
          </p>
        </div>

        <SkillTable />
      </div>
    </div>
  );
}