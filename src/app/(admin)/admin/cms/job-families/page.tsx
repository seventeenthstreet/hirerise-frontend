'use client';

// app/(admin)/admin/cms/job-families/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { JobFamiliesTable } from '@/features/admin/cms/job-families/components/JobFamiliesTable';

export default function AdminJobFamiliesPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Job Families" />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-surface-900">
            Job Families
          </h2>

          <p className="mt-1 text-sm text-surface-500">
            Job families group related roles into
            industry sectors. They drive salary
            benchmarks and career path mapping.
          </p>
        </div>

        <JobFamiliesTable />
      </div>
    </div>
  );
}