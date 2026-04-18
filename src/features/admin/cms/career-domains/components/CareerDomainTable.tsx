'use client';
// features/admin/cms/career-domains/components/CareerDomainTable.tsx
//
// Paginated, searchable table of career domains for the Admin CMS.

import { useState } from 'react';
import Link from 'next/link';
import { useAdminCareerDomains, useDeleteCareerDomain } from '../hooks/useCareerDomains';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import type { CareerDomain } from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';

const LIMIT = 20;

export function CareerDomainTable() {
  const [params, setParams] = useState<CmsQueryParams>({ page: 1, limit: LIMIT });
  const [search, setSearch]             = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CareerDomain | null>(null);

  const { data, isLoading, isError, error } = useAdminCareerDomains(params);
  const deleteMutation                       = useDeleteCareerDomain();

  const handleSearch = (value: string) => {
    setSearch(value);
    setParams((p) => ({ ...p, page: 1, search: value || undefined }));
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
            placeholder="Search career domains…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Link href="/admin/cms/career-domains/new">
          <Button size="sm" leftIcon={
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }>
            Add Domain
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
            <p className="text-sm font-medium">Failed to load career domains</p>
            <p className="text-xs text-surface-400">{(error as Error)?.message}</p>
          </div>
        ) : !data?.items?.length ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium text-surface-700">No career domains found</p>
            <p className="text-xs text-surface-400">
              {search ? 'Try adjusting your search.' : 'Add your first career domain to get started.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 bg-surface-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 hidden md:table-cell">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 hidden lg:table-cell">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-surface-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {data.items.map((domain) => (
                <tr key={domain.id} className="hover:bg-surface-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-surface-900">{domain.name}</td>
                  <td className="px-4 py-3 text-surface-500 hidden md:table-cell max-w-xs truncate">
                    {domain.description || <span className="text-surface-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={domain.status === 'active' ? 'success' : 'default'}>
                      {domain.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-surface-400 text-xs hidden lg:table-cell">
                    {new Date(domain.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/admin/cms/career-domains/${domain.id}/edit`}>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteTarget(domain)}
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
        title="Delete career domain"
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