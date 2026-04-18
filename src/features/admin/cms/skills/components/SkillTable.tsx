'use client';
// features/admin/cms/skills/components/SkillTable.tsx
//
// Paginated, searchable table of skills for the Admin CMS.
// Create / Edit routes to dedicated pages; Delete uses inline confirmation.

import { useState } from 'react';
import Link from 'next/link';
import { useAdminSkills, useDeleteSkill } from '../hooks/useSkills';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { SKILL_CATEGORIES, type Skill } from '@/types/skills';
import type { CmsQueryParams } from '@/types/api';

const CATEGORY_BADGE_VARIANT: Record<string, 'info' | 'success' | 'warning' | 'neutral' | 'default'> = {
  technical:  'info',
  soft:       'success',
  domain:     'warning',
  tool:       'neutral',
  language:   'info',
  framework:  'neutral',
};

const LIMIT = 20;

export function SkillTable() {
  const [params, setParams] = useState<CmsQueryParams>({ page: 1, limit: LIMIT });
  const [search, setSearch]             = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  const { data, isLoading, isError, error } = useAdminSkills(params);
  const deleteMutation                       = useDeleteSkill();

  // Debounced search — update params after user stops typing
  const handleSearch = (value: string) => {
    setSearch(value);
    setParams((p) => ({ ...p, page: 1, search: value || undefined }));
  };

  const handleCategoryFilter = (value: string) => {
    setParams((p) => ({ ...p, page: 1, category: value || undefined }));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search skills…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            options={SKILL_CATEGORIES}
            placeholder="All categories"
            onChange={(e) => handleCategoryFilter(e.target.value)}
          />
        </div>
        <Link href="/admin/cms/skills/new">
          <Button size="sm" leftIcon={
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }>
            Add Skill
          </Button>
        </Link>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-surface-100 bg-white overflow-hidden shadow-card">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : isError ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-red-500">
            <p className="text-sm font-medium">Failed to load skills</p>
            <p className="text-xs text-surface-400">{(error as Error)?.message}</p>
          </div>
        ) : !data?.items?.length ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium text-surface-700">No skills found</p>
            <p className="text-xs text-surface-400">
              {search ? 'Try adjusting your search.' : 'Add your first skill to get started.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 hidden md:table-cell">Demand Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 hidden lg:table-cell">Aliases</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 hidden lg:table-cell">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-surface-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data.items.map((skill) => (
                <tr key={skill.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-surface-900">{skill.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={CATEGORY_BADGE_VARIANT[skill.category] ?? 'default'}>
                      {skill.category}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-surface-600 hidden md:table-cell">
                    {skill.demandScore != null ? (
                      <span className="font-medium">{skill.demandScore}</span>
                    ) : (
                      <span className="text-surface-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-surface-500 hidden lg:table-cell">
                    {skill.aliases.length > 0
                      ? skill.aliases.slice(0, 3).join(', ')
                      : <span className="text-surface-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-surface-400 text-xs hidden lg:table-cell">
                    {new Date(skill.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/cms/skills/${skill.id}/edit`}>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteTarget(skill)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && (
        <Pagination
          page={params.page ?? 1}
          total={data.total}
          limit={LIMIT}
          onChange={(p) => setParams((prev) => ({ ...prev, page: p }))}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete skill"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This is a soft delete — the record will be hidden from the platform.`}
        size="sm"
      >
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}