/**
 * File: src/app/(admin)/admin/import/page.tsx
 * Protected by AdminGuard via app/(admin)/layout.tsx
 */

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { CsvImporter } from '@/features/import/components/CsvImporter';

export default function AdminImportPage() {
  return (
    <main className="flex h-full flex-col">
      <AdminTopbar title="CSV Import" />

      <section className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <header className="mb-8 text-center">
          <h2 className="text-xl font-bold text-surface-900">
            Bulk Data Import
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-surface-500">
            Upload CSV files to populate the career taxonomy. Follow the guided
            steps in order — each dataset depends on the previous one being in
            place.
          </p>
        </header>

        <CsvImporter />
      </section>
    </main>
  );
}