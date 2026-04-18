'use client';

// app/(admin)/admin/cms/education-levels/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { EducationLevelsTable } from '@/features/admin/cms/education-levels/components/EducationLevelsTable';

export default function AdminEducationLevelsPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Education Levels" />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-surface-900">
            Education Levels
          </h2>

          <p className="mt-1 text-sm text-surface-500">
            Define qualification tiers used in CHI scoring
            and salary benchmark filtering. Ranked from 1
            (High School) to 6 (PhD).
          </p>
        </div>

        <EducationLevelsTable />
      </div>
    </div>
  );
}