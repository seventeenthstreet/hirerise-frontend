'use client';

// features/import/components/CsvImporter.tsx
//
// Guided, step-locked CSV importer for the HireRise Admin CMS.
//
// Import order enforced:
//   Step 1 — Career Domains   (no deps)
//   Step 2 — Job Families     (requires Career Domains)
//   Step 3 — Skill Clusters   (requires Career Domains)
//   Step 4 — Skills           (requires Skill Clusters)
//   Step 5 — Roles            (requires Job Families)
//
// Education Levels and Salary Benchmarks have no dependencies and are
// available in the "Other" section at any time.

import { useRef, useState, useCallback } from 'react';
import { useAdminImport, useImportStatus } from '@/hooks/admin/useAdminImport';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/utils/cn';
import type { ImportEntity, ImportResult, ImportResultRow, ImportStepStatus } from '@/types/admin';

// ─── Step config (mirrors backend IMPORT_STEPS) ───────────────────────────────

const ORDERED_STEPS: {
  step:       number;
  entity:     ImportEntity;
  label:      string;
  hint:       string;
  deps:       string[];
}[] = [
  {
    step:   1,
    entity: 'career-domains',
    label:  'Career Domains',
    hint:   'name, description',
    deps:   [],
  },
  {
    step:   2,
    entity: 'job-families',
    label:  'Job Families',
    hint:   'name, description, icon',
    deps:   ['Career Domains'],
  },
  {
    step:   3,
    entity: 'skill-clusters',
    label:  'Skill Clusters',
    hint:   'name, domainId, description',
    deps:   ['Career Domains'],
  },
  {
    step:   4,
    entity: 'skills',
    label:  'Skills',
    hint:   'name, category, description, demandScore, aliases',
    deps:   ['Skill Clusters'],
  },
  {
    step:   5,
    entity: 'roles',
    label:  'Roles',
    hint:   'name, jobFamilyId, description, level, alternativeTitles',
    deps:   ['Job Families'],
  },
];

const OTHER_ENTITIES: { entity: ImportEntity; label: string; hint: string }[] = [
  { entity: 'education-levels',  label: 'Education Levels',  hint: 'name, description, sortOrder' },
  { entity: 'salary-benchmarks', label: 'Salary Benchmarks', hint: 'name, roleId, region, currency, minSalary, maxSalary, medianSalary, year' },
];

const ROW_STATUS_STYLE: Record<ImportResultRow['status'], string> = {
  created: 'bg-emerald-50 text-emerald-700',
  updated: 'bg-blue-50 text-blue-700',
  skipped: 'bg-amber-50 text-amber-700',
  error:   'bg-red-50 text-red-700',
};

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  activeEntity,
  statusData,
  onSelect,
}: {
  steps:        typeof ORDERED_STEPS;
  activeEntity: ImportEntity;
  statusData:   ImportStepStatus[] | undefined;
  onSelect:     (entity: ImportEntity) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {steps.map((s, i) => {
        const serverStep = statusData?.find(sd => sd.step === s.step);
        const completed  = serverStep?.completed ?? false;
        const locked     = serverStep?.depsUnmet ?? false;
        const isActive   = activeEntity === s.entity;
        const count      = serverStep?.count ?? 0;

        return (
          <button
            key={s.entity}
            disabled={locked}
            onClick={() => !locked && onSelect(s.entity)}
            className={cn(
              'group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
              isActive
                ? 'border-hr-500 bg-hr-50'
                : completed
                  ? 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
                  : locked
                    ? 'border-surface-100 bg-surface-50 opacity-50 cursor-not-allowed'
                    : 'border-surface-200 bg-white hover:border-hr-300 hover:bg-surface-50',
            )}
          >
            {/* Step badge / checkmark */}
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
              completed
                ? 'bg-emerald-500 text-white'
                : isActive
                  ? 'bg-hr-600 text-white'
                  : locked
                    ? 'bg-surface-200 text-surface-400'
                    : 'bg-surface-100 text-surface-500 group-hover:bg-hr-100 group-hover:text-hr-600',
            )}>
              {completed
                ? <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                : s.step
              }
            </div>

            {/* Label + record count */}
            <div className="min-w-0 flex-1">
              <p className={cn(
                'text-sm font-semibold truncate',
                isActive   ? 'text-hr-700'
                : completed ? 'text-emerald-700'
                : locked    ? 'text-surface-400'
                :             'text-surface-700',
              )}>
                {s.label}
              </p>
              {s.deps.length > 0 && (
                <p className="text-[10px] text-surface-400 truncate">
                  Requires: {s.deps.join(', ')}
                </p>
              )}
            </div>

            {/* Record count badge */}
            {count > 0 && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {count.toLocaleString()}
              </span>
            )}

            {/* Lock icon */}
            {locked && (
              <svg className="h-3.5 w-3.5 shrink-0 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const ref          = useRef<HTMLInputElement>(null);
  const [drag, setDrag]   = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((f: File): string | null => {
    if (!f.name.endsWith('.csv')) return 'Only CSV files are accepted.';
    if (f.size > 10 * 1024 * 1024) return 'File must be under 10 MB.';
    return null;
  }, []);

  const handle = (f: File) => {
    const e = validate(f);
    if (e) { setError(e); return; }
    setError(null);
    onFile(f);
  };

  return (
    <div
      onDragEnter={() => !disabled && setDrag(true)}
      onDragLeave={() => setDrag(false)}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) { const f = e.dataTransfer.files[0]; if (f) handle(f); } }}
      onClick={() => !disabled && ref.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all',
        drag          ? 'border-hr-400 bg-hr-50 scale-[1.01]'
          : disabled  ? 'border-surface-200 bg-surface-50 pointer-events-none opacity-50'
          :             'border-surface-200 bg-surface-50 hover:border-hr-300 hover:bg-hr-50/30',
      )}
    >
      <input ref={ref} type="file" accept=".csv" className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); e.target.value = ''; }}
      />
      <div className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors', drag ? 'bg-hr-100' : 'bg-surface-200')}>
        <svg className={cn('h-6 w-6 transition-colors', drag ? 'text-hr-600' : 'text-surface-400')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-surface-700">{drag ? 'Drop the CSV file' : 'Drop your CSV here'}</p>
      <p className="mt-1 text-xs text-surface-400">CSV format · Max 10 MB</p>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); ref.current?.click(); }}
        className="mt-4 rounded-lg border border-hr-200 bg-hr-50 px-4 py-2 text-xs font-semibold text-hr-600 hover:bg-hr-100 transition-colors"
      >
        Choose file
      </button>
      {error && <p className="mt-3 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

// ─── Result Summary ───────────────────────────────────────────────────────────

function ResultSummary({ result, onNext, onReset }: {
  result:  ImportResult;
  onNext?: () => void;
  onReset: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? result.rows : result.rows.slice(0, 20);

  return (
    <div className="space-y-4">
      {/* Success banner */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500">
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-800">Import complete</p>
          {result.nextStep && (
            <p className="mt-0.5 text-xs text-emerald-700">
              Next step: <span className="font-semibold">{result.nextStep}</span>
            </p>
          )}
        </div>
        {result.nextStep && onNext && (
          <Button size="sm" onClick={onNext}>
            Continue →
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Created', value: result.created, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Updated', value: result.updated, color: 'text-blue-600 bg-blue-50'     },
          { label: 'Skipped', value: result.skipped, color: 'text-amber-600 bg-amber-50'   },
          { label: 'Errors',  value: result.errors,  color: 'text-red-600 bg-red-50'       },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-surface-100 bg-white p-4 shadow-card text-center">
            <p className={cn('text-2xl font-bold', color.split(' ')[0])}>{value}</p>
            <p className="mt-0.5 text-xs font-medium text-surface-400">{label}</p>
          </div>
        ))}
      </div>

      {/* Row log */}
      {result.rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-surface-100 bg-white shadow-card">
          <div className="border-b border-surface-100 bg-surface-50 px-4 py-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-500">Row log</h3>
            <span className="text-xs text-surface-400">{result.total} rows total</span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-50 border-b border-surface-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 w-12">Row</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 w-20">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-surface-500 hidden md:table-cell">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {rows.map(row => (
                  <tr key={row.row} className="hover:bg-surface-50/50">
                    <td className="px-4 py-2 text-xs font-mono text-surface-400">{row.row}</td>
                    <td className="px-4 py-2">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', ROW_STATUS_STYLE[row.status])}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium text-surface-900">{row.name}</td>
                    <td className="px-4 py-2 text-xs text-surface-500 hidden md:table-cell">{row.message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > 20 && (
            <div className="border-t border-surface-100 px-4 py-3 text-center">
              <button onClick={() => setShowAll(v => !v)} className="text-xs font-semibold text-hr-600 hover:text-hr-700">
                {showAll ? 'Show fewer rows' : `Show all ${result.rows.length} rows`}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-surface-400">Imported at {new Date(result.importedAt).toLocaleString()}</p>
        <Button variant="secondary" size="sm" onClick={onReset}>New import</Button>
      </div>
    </div>
  );
}

// ─── Dependency Alert ─────────────────────────────────────────────────────────

function DependencyAlert({ deps, locked }: { deps: string[]; locked: boolean }) {
  if (!locked || deps.length === 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-amber-800">Step locked</p>
        <p className="mt-0.5 text-xs text-amber-700">
          You must import <span className="font-semibold">{deps.join(' and ')}</span> before this step.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CsvImporter() {
  const [activeEntity, setActiveEntity] = useState<ImportEntity>('career-domains');
  const [result, setResult]             = useState<ImportResult | null>(null);

  const importMutation             = useAdminImport();
  const { data: statusData, isLoading: statusLoading } = useImportStatus();

  // Find config for current selection
  const orderedStep  = ORDERED_STEPS.find(s => s.entity === activeEntity);
  const otherEntry   = OTHER_ENTITIES.find(s => s.entity === activeEntity);
  const activeConfig = orderedStep ?? otherEntry!;

  // Resolve lock state from server status
  const serverStep   = statusData?.find(sd => sd.step === orderedStep?.step);
  const isLocked     = serverStep?.depsUnmet ?? false;
  const activeDeps   = orderedStep?.deps ?? [];

  const handleSelect = (entity: ImportEntity) => {
    setActiveEntity(entity);
    setResult(null);
    importMutation.reset();
  };

  const handleFile = async (file: File) => {
    setResult(null);
    try {
      const res = await importMutation.mutateAsync({ entity: activeEntity, file });
      setResult(res);
    } catch {
      // toast shown by mutation onError
    }
  };

  // "Continue →" advances to the next ordered step
  const handleNext = () => {
    if (!result?.nextStep) return;
    const next = ORDERED_STEPS.find(s => s.label === result.nextStep);
    if (next) handleSelect(next.entity);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex gap-6">

        {/* ── Left panel: step selector ──────────────────────────────────── */}
        <div className="w-56 shrink-0 space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-surface-400">
              Import Order
            </p>
            {statusLoading ? (
              <div className="flex h-40 items-center justify-center">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <StepIndicator
                steps={ORDERED_STEPS}
                activeEntity={activeEntity}
                statusData={statusData}
                onSelect={handleSelect}
              />
            )}
          </div>

          {/* Other entities — no deps */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-surface-400">
              Other
            </p>
            <div className="flex flex-col gap-1">
              {OTHER_ENTITIES.map(s => (
                <button
                  key={s.entity}
                  onClick={() => handleSelect(s.entity)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left transition-all',
                    activeEntity === s.entity
                      ? 'border-hr-500 bg-hr-50'
                      : 'border-surface-200 bg-white hover:border-hr-300 hover:bg-surface-50',
                  )}
                >
                  <div className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    activeEntity === s.entity ? 'bg-hr-500' : 'bg-surface-300',
                  )} />
                  <span className={cn(
                    'text-sm font-medium',
                    activeEntity === s.entity ? 'text-hr-700' : 'text-surface-600',
                  )}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel: upload area ───────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Header */}
          <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                {orderedStep && (
                  <span className="mb-1 inline-flex items-center rounded-full bg-hr-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hr-700">
                    Step {orderedStep.step} of {ORDERED_STEPS.length}
                  </span>
                )}
                <h3 className="mt-1 text-base font-bold text-surface-900">{activeConfig.label}</h3>
                <p className="mt-1 text-xs text-surface-500">
                  Upload a CSV file to import {activeConfig.label.toLowerCase()} in bulk.
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-surface-50 px-3 py-2">
              <p className="text-xs font-semibold text-surface-500 mb-0.5">Expected CSV columns:</p>
              <p className="font-mono text-[11px] text-surface-600">{activeConfig.hint}</p>
            </div>
          </div>

          {/* Dependency alert */}
          <DependencyAlert deps={activeDeps} locked={isLocked} />

          {/* Upload zone / state */}
          <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card">
            {importMutation.isPending ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-hr-100 bg-hr-50 px-8 py-14 text-center">
                <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-hr-500 border-t-transparent" />
                <p className="text-sm font-semibold text-hr-700">Importing {activeConfig.label}…</p>
                <p className="mt-1 text-xs text-hr-400">This may take a few seconds</p>
              </div>
            ) : importMutation.isError ? (
              <div className="space-y-3">
                {/* Distinguish dependency errors from generic errors */}
                {(() => {
                  const err     = importMutation.error as { code?: string; message?: string } | null;
                  const isDep   = err?.code === 'DEPENDENCY_NOT_MET';
                  return (
                    <div className={cn(
                      'flex flex-col items-center justify-center rounded-2xl border px-8 py-10 text-center',
                      isDep ? 'border-amber-200 bg-amber-50' : 'border-red-100 bg-red-50',
                    )}>
                      <svg className={cn('mb-3 h-10 w-10', isDep ? 'text-amber-300' : 'text-red-300')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className={cn('text-sm font-semibold', isDep ? 'text-amber-800' : 'text-red-700')}>
                        {isDep ? 'Import order violation' : 'Import failed'}
                      </p>
                      <p className={cn('mt-1 max-w-sm text-xs', isDep ? 'text-amber-600' : 'text-red-500')}>
                        {err?.message ?? 'Unknown error'}
                      </p>
                    </div>
                  );
                })()}
                <Button variant="secondary" onClick={() => importMutation.reset()} className="w-full">
                  Try again
                </Button>
              </div>
            ) : result ? (
              <ResultSummary
                result={result}
                onNext={result.nextStep ? handleNext : undefined}
                onReset={() => { setResult(null); importMutation.reset(); }}
              />
            ) : (
              <DropZone onFile={handleFile} disabled={isLocked} />
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
