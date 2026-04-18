// app/(admin)/admin/cms/skills/new/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { SkillForm } from '@/features/admin/cms/skills/components/SkillForm';

export default function AdminSkillNewPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Add Skill" />
      <div className="p-6">
        <SkillForm mode="create" />
      </div>
    </div>
  );
}