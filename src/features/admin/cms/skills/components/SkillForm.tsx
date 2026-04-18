'use client';
// features/admin/cms/skills/components/SkillForm.tsx
//
// Shared create/edit form for Skills.
// mode="create" → calls useCreateSkill → redirects to list on success
// mode="edit"   → calls useUpdateSkill → redirects to list on success

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateSkill, useUpdateSkill } from '../hooks/useSkills';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SKILL_CATEGORIES, type Skill, type CreateSkillDto, type UpdateSkillDto } from '@/types/skills';

interface SkillFormProps {
  mode:         'create' | 'edit';
  initialData?: Skill;
}

export function SkillForm({ mode, initialData }: SkillFormProps) {
  const router = useRouter();

  const [name,        setName]        = useState(initialData?.name        ?? '');
  const [category,    setCategory]    = useState(initialData?.category    ?? 'technical');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [demandScore, setDemandScore] = useState<string>(
    initialData?.demandScore != null ? String(initialData.demandScore) : '',
  );
  const [aliasInput,  setAliasInput]  = useState('');
  const [aliases,     setAliases]     = useState<string[]>(initialData?.aliases ?? []);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const createMutation = useCreateSkill();
  const updateMutation = useUpdateSkill();
  const isMutating     = createMutation.isPending || updateMutation.isPending;

  // ── Alias management ──────────────────────────────────────────────────

  const addAlias = () => {
    const trimmed = aliasInput.trim().toLowerCase();
    if (!trimmed || aliases.includes(trimmed)) return;
    setAliases((a) => [...a, trimmed]);
    setAliasInput('');
  };

  const removeAlias = (alias: string) => {
    setAliases((a) => a.filter((x) => x !== alias));
  };

  // ── Validation ────────────────────────────────────────────────────────

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    if (!category)                               next.category = 'Category is required.';
    if (description.length > 500)                next.description = 'Max 500 characters.';
    if (demandScore !== '' && (isNaN(Number(demandScore)) || Number(demandScore) < 0 || Number(demandScore) > 100)) {
      next.demandScore = 'Demand score must be between 0 and 100.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateSkillDto = {
      name:        name.trim(),
      category:    category as Skill['category'],
      description: description.trim(),
      aliases,
      demandScore: demandScore !== '' ? Number(demandScore) : null,
    };

    if (mode === 'create') {
      await createMutation.mutateAsync(payload);
    } else {
      const diff: UpdateSkillDto = {};
      if (payload.name        !== initialData?.name)        diff.name        = payload.name;
      if (payload.category    !== initialData?.category)    diff.category    = payload.category;
      if (payload.description !== initialData?.description) diff.description = payload.description;
      if (JSON.stringify(payload.aliases) !== JSON.stringify(initialData?.aliases)) diff.aliases = payload.aliases;
      if (payload.demandScore !== initialData?.demandScore) diff.demandScore = payload.demandScore;

      await updateMutation.mutateAsync({ id: initialData!.id, data: diff });
    }

    router.push('/admin/cms/skills');
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-surface-900">
          {mode === 'create' ? 'Add new skill' : `Edit skill — ${initialData?.name}`}
        </h2>
        <p className="mt-1 text-sm text-surface-500">
          {mode === 'create'
            ? 'Skills power Skill Gap Analysis, Career Health Index, and Resume Scoring.'
            : 'Update this skill\'s details. Changes are reflected platform-wide immediately.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-surface-100 bg-white p-6 shadow-card">
        <Input
          label="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="e.g. Python, Communication, SQL"
        />

        <Select
          label="Category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as 'domain' | 'technical' | 'soft' | 'tool' | 'language' | 'framework')}
          options={SKILL_CATEGORIES}
          error={errors.category}
        />

        {/* Aliases */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-800">Aliases</label>
          <div className="flex gap-2">
            <input
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias(); } }}
              placeholder="Type an alias and press Enter"
              className="h-9 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm placeholder:text-surface-300 focus:border-hr-500 focus:outline-none focus:ring-2 focus:ring-hr-500"
            />
            <Button type="button" variant="secondary" size="sm" onClick={addAlias}>Add</Button>
          </div>
          {aliases.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {aliases.map((alias) => (
                <span
                  key={alias}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-0.5 text-xs font-medium text-surface-700"
                >
                  {alias}
                  <button
                    type="button"
                    onClick={() => removeAlias(alias)}
                    className="ml-0.5 rounded-full text-surface-400 hover:text-surface-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-surface-800">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Optional — briefly describe this skill"
            className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm placeholder:text-surface-300 focus:border-hr-500 focus:outline-none focus:ring-2 focus:ring-hr-500 resize-none"
          />
          <div className="flex justify-between">
            {errors.description
              ? <p className="text-xs text-red-500">{errors.description}</p>
              : <span />}
            <p className="text-xs text-surface-400">{description.length}/500</p>
          </div>
        </div>

        <Input
          label="Demand Score"
          type="number"
          min={0}
          max={100}
          value={demandScore}
          onChange={(e) => setDemandScore(e.target.value)}
          error={errors.demandScore}
          hint="0–100. Leave empty if unknown."
          placeholder="e.g. 85"
        />

        <div className="flex items-center justify-end gap-3 border-t border-surface-100 pt-5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/admin/cms/skills')}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isMutating}>
            {mode === 'create' ? 'Create skill' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}