'use client';

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { SkillGraphExplorer } from '@/features/admin/graph-intelligence/SkillGraphExplorer';

export default function SkillGraphExplorerPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Skill Graph Explorer" />
      <div className="flex-1 overflow-hidden">
        <SkillGraphExplorer />
      </div>
    </div>
  );
}