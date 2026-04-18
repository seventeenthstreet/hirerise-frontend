'use client';

// app/(admin)/admin/cms/skills/[id]/edit/page.tsx

import { useParams } from 'next/navigation';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { SkillForm } from '@/features/admin/cms/skills/components/SkillForm';
import { useAdminSkill } from '@/features/admin/cms/skills/hooks/useSkills';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';

export default function AdminSkillEditPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: skill,
    isLoading,
    isError,
    refetch,
  } = useAdminSkill(id ?? null);

  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Edit Skill" />

      <div className="p-6">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-700">
              Skill not found or failed to load.
            </p>

            <div className="mt-4">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : skill ? (
          <SkillForm
            mode="edit"
            initialData={skill}
          />
        ) : (
          <div className="rounded-xl border border-surface-100 bg-surface-50 p-6 text-center">
            <p className="text-sm text-surface-500">
              No skill data available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}