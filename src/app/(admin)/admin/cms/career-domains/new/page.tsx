'use client';

// app/(admin)/admin/cms/career-domains/new/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { CareerDomainForm } from '@/features/admin/cms/career-domains/components/CareerDomainForm';

export default function NewCareerDomainPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="New Career Domain" />

      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-surface-900">
            Create Career Domain
          </h2>

          <p className="mt-1 text-sm text-surface-500">
            Add a new top-level career domain to the taxonomy.
          </p>
        </div>

        <CareerDomainForm mode="create" />
      </div>
    </div>
  );
}