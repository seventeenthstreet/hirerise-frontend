'use client';

// src/app/(admin)/admin/cms/career-domains/[id]/edit/page.tsx

import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { CareerDomainForm } from '@/features/admin/cms/career-domains/components/CareerDomainForm';
import { useAdminCareerDomain } from '@/features/admin/cms/career-domains/hooks/useCareerDomains';

interface EditCareerDomainPageProps {
  params: {
    id: string;
  };
}

export default function EditCareerDomainPage({
  params,
}: EditCareerDomainPageProps) {
  const id = params?.id;

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useAdminCareerDomain(id);

  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Edit Career Domain" />

      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-surface-900">
            Edit Career Domain
          </h2>
          <p className="mt-1 text-sm text-surface-500">
            Update career domain details.
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : isError || !data ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-red-600">
              Failed to load career domain
              {id ? ` (${id})` : ''}.
            </p>

            <div className="mt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <CareerDomainForm
            mode="edit"
            initialData={data}
          />
        )}
      </div>
    </div>
  );
}