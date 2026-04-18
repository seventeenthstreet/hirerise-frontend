/**
 * File: src/app/(admin)/admin/import-center/page.tsx
 */

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { GraphDataImportCenter } from '@/features/admin/import-center/GraphDataImportCenter';

export default function AdminImportCenterPage() {
  return (
    <main className="flex h-full flex-col">
      <AdminTopbar title="Data Import Center" />
      <section className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <GraphDataImportCenter />
      </section>
    </main>
  );
}