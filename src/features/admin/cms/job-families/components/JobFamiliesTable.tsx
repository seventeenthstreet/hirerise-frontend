'use client';

// features/admin/cms/job-families/components/JobFamiliesTable.tsx

import { useState } from 'react';
import { useAdminJobFamilies, useCreateJobFamily, useUpdateJobFamily, useDeleteJobFamily } from '@/hooks/admin/useAdminJobFamilies';
import { CmsTable } from '@/features/admin/cms/components/CmsTable';
import { DeleteConfirmModal } from '@/features/admin/cms/components/DeleteConfirmModal';
import { FormField, Textarea } from '@/features/admin/cms/components/FormField';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { JobFamily, CreateJobFamilyDto } from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';

const LIMIT = 20;

function JobFamilyFormModal({ jf, onClose }: { jf: JobFamily | null; onClose: () => void }) {
  const isEdit = !!jf;
  const createMutation = useCreateJobFamily();
  const updateMutation = useUpdateJobFamily();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name,        setName]        = useState(jf?.name        ?? '');
  const [slug,        setSlug]        = useState(jf?.slug        ?? '');
  const [sector,      setSector]      = useState(jf?.sector      ?? '');
  const [description, setDescription] = useState(jf?.description ?? '');
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!slug.trim()) e.slug = 'Slug is required.';
    if (!/^[a-z0-9-]+$/.test(slug)) e.slug = 'Slug: lowercase, numbers, hyphens only.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const data: CreateJobFamilyDto = { name: name.trim(), slug: slug.trim(), sector: sector.trim(), description, domainId: null };
    if (isEdit) {
      await updateMutation.mutateAsync({ id: jf.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit job family' : 'New job family'} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required error={errors.name}>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Software Engineering" error={errors.name} />
          </FormField>
          <FormField label="Slug" required error={errors.slug}>
            <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="software-engineering" error={errors.slug} />
          </FormField>
        </div>
        <FormField label="Sector">
          <Input value={sector} onChange={e => setSector(e.target.value)} placeholder="Technology, Finance, Healthcare…" />
        </FormField>
        <FormField label="Description">
          <Textarea value={description} onChange={setDescription} placeholder="Brief description of this job family…" />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button loading={isPending} onClick={handleSubmit}>{isEdit ? 'Save changes' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}

export function JobFamiliesTable() {
  const [params,       setParams]       = useState<CmsQueryParams>({ page: 1, limit: LIMIT });
  const [search,       setSearch]       = useState('');
  const [editTarget,   setEditTarget]   = useState<JobFamily | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<JobFamily | null>(null);

  const { data, isLoading, isError } = useAdminJobFamilies(params);
  const deleteMutation = useDeleteJobFamily();

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
        addLabel="Add Job Family"
        onAdd={() => setEditTarget('new')}
        emptyMessage="No job families configured yet."
        columns={[
          { key: 'name',   label: 'Name',
            render: r => <span className="font-semibold text-surface-900">{r.name}</span> },
          { key: 'sector', label: 'Sector', hidden: 'md',
            render: r => <span className="text-surface-600">{r.sector || '—'}</span> },
          { key: 'slug',   label: 'Slug', hidden: 'lg',
            render: r => <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs text-surface-600">{r.slug}</code> },
          { key: 'desc',   label: 'Description', hidden: 'lg',
            render: r => <span className="line-clamp-1 text-surface-500">{r.description || '—'}</span> },
          { key: 'updated', label: 'Updated', hidden: 'lg',
            render: r => <span className="text-xs text-surface-400">{new Date(r.updatedAt).toLocaleDateString()}</span> },
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
        <JobFamilyFormModal jf={editTarget === 'new' ? null : editTarget} onClose={() => setEditTarget(null)} />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ''}
        entity="job family"
        isPending={deleteMutation.isPending}
        onConfirm={async () => { if (deleteTarget) { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); } }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}