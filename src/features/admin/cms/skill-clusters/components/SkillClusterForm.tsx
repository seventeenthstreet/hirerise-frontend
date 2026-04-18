'use client';
// features/admin/cms/skill-clusters/components/SkillClusterForm.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateSkillCluster, useUpdateSkillCluster } from '../hooks/useSkillClusters';
import { useAdminCareerDomains } from '../../career-domains/hooks/useCareerDomains';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { SkillCluster, CreateSkillClusterDto, UpdateSkillClusterDto } from '@/types/admin';

interface SkillClusterFormProps {
  mode:         'create' | 'edit';
  initialData?: SkillCluster;
}

export function SkillClusterForm({ mode, initialData }: SkillClusterFormProps) {
  const router = useRouter();

  const [name,        setName]        = useState(initialData?.name        ?? '');
  const [domainId,    setDomainId]    = useState(initialData?.domainId    ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const createMutation = useCreateSkillCluster();
  const updateMutation = useUpdateSkillCluster();
  const isMutating     = createMutation.isPending || updateMutation.isPending;

  // Load domains for the select dropdown
  const { data: domainsData, isLoading: domainsLoading } = useAdminCareerDomains({ limit: 500 });

  const domainOptions = (domainsData?.items ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }));

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    if (!domainId) next.domainId = 'Career domain is required.';
    if (description.length > 500) next.description = 'Max 500 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateSkillClusterDto = {
      name:        name.trim(),
      domainId,
      description: description.trim(),
    };

    if (mode === 'create') {
      await createMutation.mutateAsync(payload);
      router.push('/admin/cms/skill-clusters');
    } else if (initialData?.id) {
      const updates: UpdateSkillClusterDto = {};
      if (payload.name        !== initialData.name)        updates.name        = payload.name;
      if (payload.domainId    !== initialData.domainId)    updates.domainId    = payload.domainId;
      if (payload.description !== initialData.description) updates.description = payload.description;
      await updateMutation.mutateAsync({ id: initialData.id, data: updates });
      router.push('/admin/cms/skill-clusters');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Cluster Name <span className="text-red-500">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Frontend Development"
          error={errors.name}
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* Career Domain */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Career Domain <span className="text-red-500">*</span>
        </label>
        <Select
          options={domainOptions}
          value={domainId}
          placeholder={domainsLoading ? 'Loading domains…' : 'Select a career domain'}
          onChange={(e) => setDomainId(e.target.value)}
          disabled={domainsLoading}
        />
        {errors.domainId && <p className="mt-1 text-xs text-red-500">{errors.domainId}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Description
          <span className="ml-1 text-xs text-surface-400">(optional, max 500 chars)</span>
        </label>
        <textarea
          className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder-surface-400
                     focus:outline-none focus:ring-2 focus:ring-hr-500 focus:border-transparent resize-none"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this skill cluster…"
          maxLength={500}
        />
        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
        <p className="mt-1 text-xs text-surface-400">{description.length}/500</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isMutating} disabled={isMutating}>
          {mode === 'create' ? 'Create Cluster' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/admin/cms/skill-clusters')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
