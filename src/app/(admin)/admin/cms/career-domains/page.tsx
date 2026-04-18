'use client';

// app/(admin)/admin/cms/career-domains/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { CareerDomainTable } from '@/features/admin/cms/career-domains/components/CareerDomainTable';

export default function AdminCareerDomainsPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Career Domains" />

      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-surface-900">
            Career Domains
          </h2>

          <p className="mt-1 text-sm text-surface-500">
            Manage top-level career domains. Domains are the
            root of the Global Career Taxonomy and power
            Career Domain Detection, Role Matching, and the
            CHI Engine.
          </p>
        </div>

        <CareerDomainTable />
      </div>
    </div>
  );
}