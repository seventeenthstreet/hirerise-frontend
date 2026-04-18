'use client';

// features/admin/cms/roles/components/RolesTable.tsx
// Full CRUD table for Roles — create/edit via inline modal, delete via confirm modal.

import { useState } from 'react';
import { useAdminRoles, useCreateRole, useUpdateRole, useDeleteRole } from '@/hooks/admin/useAdminRoles';
import { CmsTable } from '@/features/admin/cms/components/CmsTable';
import { DeleteConfirmModal } from '@/features/admin/cms/components/DeleteConfirmModal';
import { FormField, Textarea } from '@/features/admin/cms/components/FormField';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import type { Role, CreateRoleDto } from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';

const LIMIT = 20;

const LEVEL_LABELS: Record<number, string> = { 1: 'Junior', 2: 'Mid', 3: 'Senior', 4: 'Lead', 5: 'Principal' };
const LEVEL_BADGE:  Record<number, 'default' | 'info' | 'success' | 'warning' | 'neutral'> =
  { 1: 'default', 2: 'info', 3: 'success', 4: 'warning', 5: 'neutral' };

// ─── Role form modal ──────────────────────────────────────────────────────────

function RoleFormModal({ role, onClose }: { role: Role | null; onClose: () => void }) {
  const isEdit = !!role;
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [name,        setName]        = useState(role?.name        ?? '');
  const [slug,        setSlug]        = useState(role?.slug        ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [level,       setLevel]       = useState(role?.level ?? 1);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!slug.trim()) e.slug = 'Slug is required.';
    if (!/^[a-z0-9-]+$/.test(slug)) e.slug = 'Slug: lowercase letters, numbers, hyphens only.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const data: CreateRoleDto = { name: name.trim(), slug: slug.trim(), description, level, jobFamilyId: null, requiredSkillIds: [], domainId: null, skillClusters: [], marketDemand: null, nextRoles: [] };
    if (isEdit) {
      await updateMutation.mutateAsync({ id: role.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit role' : 'New role'} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Name" required error={errors.name}>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Senior Engineer" error={errors.name} />
          </FormField>
          <FormField label="Slug" required error={errors.slug}>
            <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} placeholder="senior-engineer" error={errors.slug} />
          </FormField>
        </div>
        <FormField label="Seniority level">
          <div className="flex gap-2">
            {[1,2,3,4,5].map(l => (
              <button key={l} type="button" onClick={() => setLevel(l)}
                className={[
                  'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
                  level === l
                    ? 'border-hr-500 bg-hr-50 text-hr-700'
                    : 'border-surface-200 text-surface-500 hover:border-hr-300',
                ].join(' ')}>
                {LEVEL_LABELS[l]}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label="Description">
          <Textarea value={description} onChange={setDescription} placeholder="Brief description of this role…" />
        </FormField>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button loading={isPending} onClick={handleSubmit}>{isEdit ? 'Save changes' : 'Create role'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── RolesTable ───────────────────────────────────────────────────────────────

export function RolesTable() {
  const [params,       setParams]       = useState<CmsQueryParams>({ page: 1, limit: LIMIT });
  const [search,       setSearch]       = useState('');
  const [editTarget,   setEditTarget]   = useState<Role | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const { data, isLoading, isError } = useAdminRoles(params);
  const deleteMutation = useDeleteRole();

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
        addLabel="Add Role"
        onAdd={() => setEditTarget('new')}
        emptyMessage="No roles configured yet."
        columns={[
          { key: 'name',  label: 'Name',
            render: r => <span className="font-semibold text-surface-900">{r.name}</span> },
          { key: 'level', label: 'Level',
            render: r => <Badge variant={LEVEL_BADGE[r.level] ?? 'default'}>{LEVEL_LABELS[r.level] ?? r.level}</Badge> },
          { key: 'slug',  label: 'Slug', hidden: 'md',
            render: r => <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs text-surface-600">{r.slug}</code> },
          { key: 'desc',  label: 'Description', hidden: 'lg',
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
        <RoleFormModal
          role={editTarget === 'new' ? null : editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ''}
        entity="role"
        isPending={deleteMutation.isPending}
        onConfirm={async () => { if (deleteTarget) { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); } }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}