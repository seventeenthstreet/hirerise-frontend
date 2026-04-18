'use client';

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { GraphDataImportCenter } from '@/features/admin/import-center/GraphDataImportCenter';

export default function Page() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Salary Benchmarks" />
      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <GraphDataImportCenter initialDataset="role_salary_market" />
      </div>
    </div>
  );
}