/** 
 * File: src/app/admin/education-mapping/page.tsx
 */

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { GraphDataImportCenter } from '@/features/admin/import-center/GraphDataImportCenter';

export default function EducationMappingPage() {
  return (
    <main className="flex h-full flex-col">
      <AdminTopbar title="Education Mapping" />
      <section className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <GraphDataImportCenter initialDataset="role_education" />
      </section>
    </main>
  );
}