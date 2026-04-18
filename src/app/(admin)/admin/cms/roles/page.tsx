'use client';

// app/(admin)/admin/cms/roles/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { RolesTable } from '@/features/admin/cms/roles/components/RolesTable';

export default function AdminRolesPage() {
  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Roles" />

      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-surface-900">
            Role Catalog
          </h2>

          <p className="mt-1 text-sm text-surface-500">
            Manage job roles by seniority level.
            Roles are linked to job families and
            power Skill Gap Analysis.
          </p>
        </div>

        <RolesTable />
      </div>
    </div>
  );
}