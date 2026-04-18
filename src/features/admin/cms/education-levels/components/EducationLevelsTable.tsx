'use client';

// features/admin/cms/education-levels/components/EducationLevelsTable.tsx

import { useState } from 'react';
import { useAdminEducationLevels, useCreateEducationLevel, useUpdateEducationLevel, useDeleteEducationLevel } from '@/hooks/admin/useAdminEducationLevels';
import { CmsTable } from '@/features/admin/cms/components/CmsTable';
import { DeleteConfirmModal } from '@/features/admin/cms/components/DeleteConfirmModal';
import { FormField, Textarea } from '@/features/admin/cms/components/FormField';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import type { EducationLevel, CreateEducationLevelDto } from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';

const LIMIT = 20;

const RANK_LABELS: Record<number, string> = {
  1: 'High School', 2: 'Associate', 3: "Bachelor's", 4: "Master's", 5: 'Professional', 6: 'PhD',
};

function EducationFormModal({ level, onClose }: { level: EducationLevel | null; onClose: () => void }) {
  const isEdit = !!level;
  const createMutation = useCreateEducationLevel();
  const updateMutation = useUpdateEducationLevel();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name,        setName]        = useState(level?.name        ?? '');
  const [slug,        setSlug]        = useState(level?.slug        ?? '');
  const [rank,        setRank]        = useState(level?.rank ?? 3);
  const [description, setDescription] = useState(level?.description ?? '');
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!slug.trim()) e.slug = 'Slug is required.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const data: CreateEducationLevelDto = { name: name.trim(), slug: slug.trim(), rank, description };
    if (isEdit) {
      await updateMutation.mutateAsync({ id: level.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit education level' : 'New education level'} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required error={errors.name}>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Bachelor's Degree" error={errors.name} />
          </FormField>
          <FormField label="Slug" required error={errors.slug}>
            <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="bachelors-degree" error={errors.slug} />
          </FormField>
        </div>
        <FormField label="Rank (1 = lowest, 6 = highest)">
          <div className="flex gap-2">
            {[1,2,3,4,5,6].map(r => (
              <button key={r} type="button" onClick={() => setRank(r)}
                className={[
                  'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
                  rank === r ? 'border-hr-500 bg-hr-50 text-hr-700' : 'border-surface-200 text-surface-500 hover:border-hr-300',
                ].join(' ')}>
                {r}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-surface-400">{RANK_LABELS[rank]}</p>
        </FormField>
        <FormField label="Description">
          <Textarea value={description} onChange={setDescription} placeholder="Description…" />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button loading={isPending} onClick={handleSubmit}>{isEdit ? 'Save changes' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function EducationLevelsTable() {
  const [params,       setParams]       = useState<CmsQueryParams>({ page: 1, limit: LIMIT });
  const [search,       setSearch]       = useState('');
  const [editTarget,   setEditTarget]   = useState<EducationLevel | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<EducationLevel | null>(null);

  const { data, isLoading, isError } = useAdminEducationLevels(params);
  const deleteMutation = useDeleteEducationLevel();

  const handleSearch = (v: string) => { setSearch(v); setParams(p => ({ ...p, page: 1, search: v || undefined })); };

  return (
    <>
      <CmsTable
        data={data?.items}
        total={data?.total ?? 0}
        page={params.page ?? 1}
        limit={LIMIT}
        isLoading={isLoading}
        isError={isError}
        search={search}
        onSearch={handleSearch}
        onPageChange={p => setParams(prev => ({ ...prev, page: p }))}
        addLabel="Add Education Level"
        onAdd={() => setEditTarget('new')}
        emptyMessage="No education levels configured yet."
        columns={[
          { key: 'name', label: 'Name',
            render: r => <span className="font-semibold text-surface-900">{r.name}</span> },
          { key: 'rank', label: 'Rank',
            render: r => <Badge variant="info">Rank {r.rank} — {RANK_LABELS[r.rank] ?? '?'}</Badge> },
          { key: 'slug', label: 'Slug', hidden: 'md',
            render: r => <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs text-surface-600">{r.slug}</code> },
          { key: 'desc', label: 'Description', hidden: 'lg',
            render: r => <span className="line-clamp-1 text-surface-500">{r.description || '—'}</span> },
          { key: 'actions', label: '', className: 'text-right',
            render: r => (
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditTarget(r)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setDeleteTarget(r)}>Delete</Button>
              </div>
            )},
        ]}
      />

      {editTarget !== null && (
        <EducationFormModal level={editTarget === 'new' ? null : editTarget} onClose={() => setEditTarget(null)} />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ''}
        entity="education level"
        isPending={deleteMutation.isPending}
        onConfirm={async () => { if (deleteTarget) { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); } }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}