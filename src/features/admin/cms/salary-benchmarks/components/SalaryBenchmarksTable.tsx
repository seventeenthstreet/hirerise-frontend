'use client';

// features/admin/cms/salary-benchmarks/components/SalaryBenchmarksTable.tsx

import { useState } from 'react';
import {
  useAdminSalaryBenchmarks, useCreateSalaryBenchmark,
  useUpdateSalaryBenchmark, useDeleteSalaryBenchmark,
} from '@/hooks/admin/useAdminSalaryBenchmarks';
import { CmsTable } from '@/features/admin/cms/components/CmsTable';
import { DeleteConfirmModal } from '@/features/admin/cms/components/DeleteConfirmModal';
import { FormField } from '@/features/admin/cms/components/FormField';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import type { SalaryBenchmark, CreateSalaryBenchmarkDto } from '@/types/admin';
import type { CmsQueryParams } from '@/types/api';

const LIMIT = 20;



const fmt = (n: number, currency: string) => {
  const safeCurrency = currency && /^[A-Z]{3}$/.test(currency.trim().toUpperCase())
    ? currency.trim().toUpperCase()
    : 'INR';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: safeCurrency, maximumFractionDigits: 0 }).format(n);
};

// ─── Form modal ───────────────────────────────────────────────────────────────

function BenchmarkFormModal({ benchmark, onClose }: { benchmark: SalaryBenchmark | null; onClose: () => void }) {
  const isEdit = !!benchmark;
  const createMutation = useCreateSalaryBenchmark();
  const updateMutation = useUpdateSalaryBenchmark();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [roleId,    setRoleId]    = useState(benchmark?.roleId          ?? '');
  const [currency,  setCurrency]  = useState(benchmark?.currency        ?? 'INR');
  const [p25,       setP25]       = useState(String(benchmark?.minSalary      ?? ''));
  const [median,    setMedian]    = useState(String(benchmark?.medianSalary   ?? ''));
  const [p75,       setP75]       = useState(String(benchmark?.maxSalary      ?? ''));
  const [location,  setLocation]  = useState(benchmark?.region        ?? 'Global');
  const [sourceYear,setSourceYear]= useState(String(benchmark?.year ?? new Date().getFullYear()));
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!roleId.trim())          e.roleId = 'Role ID is required.';
    if (isNaN(Number(p25)))      e.p25    = 'Must be a number.';
    if (isNaN(Number(median)))   e.median = 'Must be a number.';
    if (isNaN(Number(p75)))      e.p75    = 'Must be a number.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const data: CreateSalaryBenchmarkDto = {
      name: roleId.trim(), roleId: roleId.trim(),
      currency, minSalary: Number(p25), medianSalary: Number(median), maxSalary: Number(p75),
      region: location.trim(), year: Number(sourceYear),
    };
    if (isEdit) {
      await updateMutation.mutateAsync({ id: benchmark.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit benchmark' : 'New salary benchmark'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Role ID" required error={errors.roleId}>
            <Input value={roleId} onChange={e => setRoleId(e.target.value)} placeholder="role-firestore-id" error={errors.roleId} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Currency">
            <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} placeholder="INR" />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="P25 salary" error={errors.p25}>
            <Input type="number" value={p25} onChange={e => setP25(e.target.value)} placeholder="60000" error={errors.p25} />
          </FormField>
          <FormField label="Median salary" error={errors.median}>
            <Input type="number" value={median} onChange={e => setMedian(e.target.value)} placeholder="80000" error={errors.median} />
          </FormField>
          <FormField label="P75 salary" error={errors.p75}>
            <Input type="number" value={p75} onChange={e => setP75(e.target.value)} placeholder="105000" error={errors.p75} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Region">
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Global, US, UK…" />
          </FormField>
          <FormField label="Source year">
            <Input type="number" value={sourceYear} onChange={e => setSourceYear(e.target.value)} placeholder="2024" />
          </FormField>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button loading={isPending} onClick={handleSubmit}>{isEdit ? 'Save changes' : 'Create'}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function SalaryBenchmarksTable() {
  const [params,       setParams]       = useState<CmsQueryParams>({ page: 1, limit: LIMIT });
  const [search,       setSearch]       = useState('');
  const [editTarget,   setEditTarget]   = useState<SalaryBenchmark | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalaryBenchmark | null>(null);

  const { data, isLoading, isError } = useAdminSalaryBenchmarks(params);
  const deleteMutation = useDeleteSalaryBenchmark();

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
        addLabel="Add Benchmark"
        onAdd={() => setEditTarget('new')}
        emptyMessage="No salary benchmarks yet."
        columns={[
          { key: 'role', label: 'Role',
            render: r => <span className="font-semibold text-surface-900">{r.name || r.roleId}</span> },
          { key: 'median', label: 'Median',
            render: r => <span className="font-semibold text-surface-900">{fmt(r.medianSalary, r.currency)}</span> },
          { key: 'range', label: 'P25–P75', hidden: 'md',
            render: r => <span className="text-xs text-surface-500">{fmt(r.minSalary, r.currency)} – {fmt(r.maxSalary, r.currency)}</span> },
          { key: 'location', label: 'Location', hidden: 'lg',
            render: r => <span className="text-surface-500">{r.region}</span> },
          { key: 'year', label: 'Year', hidden: 'lg',
            render: r => <span className="text-xs text-surface-400">{r.year}</span> },
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
        <BenchmarkFormModal benchmark={editTarget === 'new' ? null : editTarget} onClose={() => setEditTarget(null)} />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        name={deleteTarget ? `${deleteTarget.name || deleteTarget.roleId}` : ''}
        entity="salary benchmark"
        isPending={deleteMutation.isPending}
        onConfirm={async () => { if (deleteTarget) { await deleteMutation.mutateAsync(deleteTarget.id); setDeleteTarget(null); } }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}