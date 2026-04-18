'use client';

// app/(admin)/admin/cms/salary-benchmarks/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { SalaryBenchmarksTable } from '@/features/admin/cms/salary-benchmarks/components/SalaryBenchmarksTable';

export default function AdminSalaryBenchmarksPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Salary Benchmarks" />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-surface-900">
            Salary Benchmarks
          </h2>

          <p className="mt-1 text-sm text-surface-500">
            Market compensation data by role,
            experience band, and location.
            Benchmarks power the Salary
            Intelligence card in user dashboards.
          </p>
        </div>

        <SalaryBenchmarksTable />
      </div>
    </div>
  );
}