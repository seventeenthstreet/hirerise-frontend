'use client';
// features/admin/cms/career-domains/components/CareerDomainForm.tsx
//
// Shared create/edit form for Career Domains.
// mode="create" → calls useCreateCareerDomain → redirects to list on success
// mode="edit"   → calls useUpdateCareerDomain → redirects to list on success

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateCareerDomain, useUpdateCareerDomain } from '../hooks/useCareerDomains';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { CareerDomain, CreateCareerDomainDto, UpdateCareerDomainDto } from '@/types/admin';

interface CareerDomainFormProps {
  mode:         'create' | 'edit';
  initialData?: CareerDomain;
}

export function CareerDomainForm({ mode, initialData }: CareerDomainFormProps) {
  const router = useRouter();

  const [name,        setName]        = useState(initialData?.name        ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const createMutation = useCreateCareerDomain();
  const updateMutation = useUpdateCareerDomain();
  const isMutating     = createMutation.isPending || updateMutation.isPending;

  // ── Validation ────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    if (description.length > 500) next.description = 'Max 500 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateCareerDomainDto = {
      name:        name.trim(),
      description: description.trim(),
    };

    if (mode === 'create') {
      await createMutation.mutateAsync(payload);
      router.push('/admin/cms/career-domains');
    } else if (initialData?.id) {
      const updates: UpdateCareerDomainDto = {};
      if (payload.name !== initialData.name)               updates.name        = payload.name;
      if (payload.description !== initialData.description) updates.description = payload.description;
      await updateMutation.mutateAsync({ id: initialData.id, data: updates });
      router.push('/admin/cms/career-domains');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Domain Name <span className="text-red-500">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Software Engineering"
          error={errors.name}
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
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
          placeholder="Describe the career domain…"
          maxLength={500}
        />
        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
        <p className="mt-1 text-xs text-surface-400">{description.length}/500</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isMutating} disabled={isMutating}>
          {mode === 'create' ? 'Create Domain' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/admin/cms/career-domains')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
