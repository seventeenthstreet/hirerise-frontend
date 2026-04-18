'use client';

/**
 * GraphDataImportCenter.tsx
 *
 * Enterprise-grade 7-stage import pipeline + enhancements:
 *   1. Upload CSV
 *   2. Dataset Preview (with Validation Summary)
 *   3. Schema Validation
 *   4. Graph Dependency Validation
 *   5. Import Confirmation
 *   6. Batch Database Writes
 *   7. Import Report
 *
 * Dashboard panels:
 *   - Dataset Status (green/yellow/red)
 *   - Graph Coverage Panel
 *   - Import Order Guide
 *   - Dataset Dependency Map
 *   - CSV Template Downloads
 */

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import type {
  GraphDatasetType, GraphPreviewResult, GraphImportResult,
  GraphImportError, ImportMode, DatasetStatusEntry, GraphHealth,
} from '@/types/admin';

// ─── Dataset registry ─────────────────────────────────────────────────────────

interface DatasetMeta {
  type:        GraphDatasetType;
  label:       string;
  description: string;
  required:    string[];
  optional:    string[];
  example:     string;
  group:       string;
  color:       'blue' | 'emerald' | 'violet' | 'amber';
  depends:     string[];
}

const DATASETS: DatasetMeta[] = [
  {
    type: 'roles', label: 'Roles', group: 'Career Graph',
    description: 'Career roles — nodes of the Career Graph.',
    required: ['role_id', 'role_name'],
    optional: ['role_family', 'seniority_level', 'description'],
    example: 'se_1,Software Engineer,Engineering,mid',
    color: 'blue', depends: [],
  },
  {
    type: 'role_transitions', label: 'Career Transitions', group: 'Career Graph',
    description: 'Directed edges between roles.',
    required: ['from_role_id', 'to_role_id'],
    optional: ['probability', 'years_required', 'transition_type'],
    example: 'se_1,se_2,0.8,2,primary',
    color: 'blue', depends: ['roles'],
  },
  {
    type: 'role_skills', label: 'Role Skills', group: 'Career Graph',
    description: 'Skill requirements per role.',
    required: ['role_id', 'skill_id'],
    optional: ['importance_weight'],
    example: 'se_1,python_basics,0.9',
    color: 'blue', depends: ['roles', 'skills'],
  },
  {
    type: 'skills', label: 'Skills', group: 'Skill Graph',
    description: 'Canonical skill registry.',
    required: ['skill_id', 'skill_name'],
    optional: ['skill_category', 'difficulty_level', 'demand_score'],
    example: 'python_basics,Python Basics,technical,2,8.5',
    color: 'emerald', depends: [],
  },
  {
    type: 'skill_relationships', label: 'Skill Relationships', group: 'Skill Graph',
    description: 'Prerequisite and related skill edges.',
    required: ['skill_id', 'related_skill_id', 'relationship_type'],
    optional: ['strength_score'],
    example: 'python_adv,python_basics,prerequisite,1.0',
    color: 'emerald', depends: ['skills'],
  },
  {
    type: 'role_education', label: 'Education Mapping', group: 'Market Intelligence',
    description: 'Education match scores per role.',
    required: ['role_id', 'education_level'],
    optional: ['match_score'],
    example: "se_1,Bachelor's Degree,90",
    color: 'violet', depends: ['roles'],
  },
  {
    type: 'role_salary_market', label: 'Salary Benchmarks', group: 'Market Intelligence',
    description: 'Market salary data by role and country.',
    required: ['role_id', 'country'],
    optional: ['median_salary', 'p25', 'p75', 'currency'],
    example: 'se_1,IN,1200000,800000,1800000,INR',
    color: 'violet', depends: ['roles'],
  },
];

const DATASET_MAP = Object.fromEntries(DATASETS.map(d => [d.type, d]));

const COLOR_MAP = {
  blue:    { badge: 'bg-blue-100 text-blue-700',     border: 'border-blue-200',    bg: 'bg-blue-50',    dot: 'bg-blue-500',    text: 'text-blue-700'    },
  emerald: { badge: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  violet:  { badge: 'bg-violet-100 text-violet-700',  border: 'border-violet-200',  bg: 'bg-violet-50',  dot: 'bg-violet-500',  text: 'text-violet-700'  },
  amber:   { badge: 'bg-amber-100 text-amber-700',    border: 'border-amber-200',   bg: 'bg-amber-50',   dot: 'bg-amber-500',   text: 'text-amber-700'   },
};

// ─── Import pipeline stage ────────────────────────────────────────────────────

type Stage =
  | 'idle'           // 1. waiting for file
  | 'uploading'      // 2. parsing + sending to preview API
  | 'preview'        // 3. schema validation results shown
  | 'confirming'     // 5. user reviews and confirms
  | 'importing'      // 6. batch writes in progress
  | 'done'           // 7. import report
  | 'error';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number | undefined | null) {
  if (n === undefined || n === null || isNaN(Number(n))) return '0';
  return Number(n).toLocaleString();
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function groupErrors(errors: GraphImportError[]) {
  return {
    field:     errors.filter(e => e.type === 'field'),
    duplicate: errors.filter(e => e.type === 'duplicate'),
    fk:        errors.filter(e => e.type === 'fk'),
    write:     errors.filter(e => e.type === 'write'),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StageIndicator({ stage }: { stage: Stage }) {
  const steps = [
    { id: 'idle',       label: 'Upload' },
    { id: 'uploading',  label: 'Preview' },
    { id: 'preview',    label: 'Validate' },
    { id: 'confirming', label: 'Confirm' },
    { id: 'importing',  label: 'Import' },
    { id: 'done',       label: 'Report' },
  ];
  const ORDER: Stage[] = ['idle', 'uploading', 'preview', 'confirming', 'importing', 'done'];
  const current = ORDER.indexOf(stage);

  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((step, i) => {
        const stepIdx = ORDER.indexOf(step.id as Stage);
        const isDone    = stepIdx < current;
        const isActive  = stepIdx === current;
        const isPending = stepIdx > current;
        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all',
                isDone   ? 'border-hr-600 bg-hr-600 text-white' :
                isActive ? 'border-hr-600 bg-white text-hr-600 ring-4 ring-hr-100' :
                           'border-surface-200 bg-white text-surface-300'
              )}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={cn(
                'text-[10px] font-medium whitespace-nowrap',
                isDone || isActive ? 'text-surface-700' : 'text-surface-300'
              )}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('flex-1 h-0.5 mb-4 mx-1', isDone ? 'bg-hr-600' : 'bg-surface-100')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ErrorGroup({ title, errors, color }: { title: string; errors: GraphImportError[]; color: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!errors.length) return null;
  return (
    <div className={cn('rounded-lg border p-3', color)}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-semibold">{title} ({errors.length} issue{errors.length > 1 ? 's' : ''})</span>
        <span className="text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
          {errors.slice(0, 50).map((e, i) => (
            <p key={i} className="font-mono text-[11px]">
              Row {e.row}: <span className="font-semibold">[{e.field}]</span> {e.message}
            </p>
          ))}
          {errors.length > 50 && <p className="text-[10px] opacity-60">…and {errors.length - 50} more</p>}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, variant }: { label: string; value: number; variant: 'neutral' | 'good' | 'warn' | 'danger' }) {
  const cls = {
    neutral: 'bg-surface-100 text-surface-700',
    good:    'bg-emerald-100 text-emerald-700',
    warn:    'bg-amber-100 text-amber-700',
    danger:  'bg-red-100 text-red-700',
  }[variant];
  return (
    <div className={cn('flex flex-col items-center rounded-lg px-4 py-2.5', cls)}>
      <span className="text-xl font-bold tabular-nums">{fmtNum(value)}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

// ─── Dataset Status Card ──────────────────────────────────────────────────────

function DatasetStatusCard({ entry, onImport }: { entry: DatasetStatusEntry; onImport: (type: GraphDatasetType) => void }) {
  const meta = DATASET_MAP[entry.dataset];
  if (!meta) return null;
  const c = COLOR_MAP[meta.color];
  const statusConfig = {
    loaded:  { dot: 'bg-emerald-500', ring: 'ring-emerald-200', label: 'Loaded',  text: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    partial: { dot: 'bg-amber-400',   ring: 'ring-amber-200',   label: 'Partial', text: 'text-amber-700',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    missing: { dot: 'bg-red-500',     ring: 'ring-red-200',     label: 'Missing', text: 'text-red-600',     badge: 'bg-red-50 text-red-600 border-red-200' },
  }[entry.status];

  return (
    <div className={cn(
      'rounded-xl border bg-white p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow',
      entry.status === 'missing' ? 'border-red-200' :
      entry.status === 'partial' ? 'border-amber-200' : 'border-surface-100'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span className={cn('h-2.5 w-2.5 rounded-full ring-4 flex-shrink-0 mt-0.5', statusConfig.dot, statusConfig.ring)} />
          <div>
            <p className="text-sm font-semibold text-surface-900">{meta.label}</p>
            <p className="text-[11px] text-surface-400 mt-0.5">{meta.group}</p>
          </div>
        </div>
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', statusConfig.badge)}>
          {statusConfig.label}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-surface-50 pt-3">
        <div>
          <p className="text-lg font-bold tabular-nums text-surface-900">{fmtNum(entry.count)}</p>
          <p className="text-[10px] text-surface-400">records</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-surface-400">Last import</p>
          <p className="text-[11px] font-medium text-surface-600">{fmtDate(entry.last_import)}</p>
        </div>
      </div>

      {meta.depends.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-surface-400">Depends on:</span>
          {meta.depends.map(d => (
            <span key={d} className="rounded-full bg-surface-100 px-1.5 py-0.5 text-[10px] font-mono text-surface-500">{d}</span>
          ))}
        </div>
      )}

      <button
        onClick={() => onImport(entry.dataset)}
        className={cn(
          'w-full rounded-lg py-1.5 text-xs font-semibold transition-colors',
          entry.status === 'missing'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'border border-surface-200 text-surface-600 hover:bg-surface-50'
        )}
      >
        {entry.status === 'missing' ? '↑ Upload Dataset' : '↑ Re-import'}
      </button>
    </div>
  );
}

// ─── Single Dataset Importer ──────────────────────────────────────────────────

function DatasetImporter({
  datasetType,
  onClose,
  onSuccess,
}: {
  datasetType: GraphDatasetType;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const meta    = DATASET_MAP[datasetType];
  const c       = COLOR_MAP[meta.color];
  const qc      = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage,   setStage]   = useState<Stage>('idle');
  const [file,    setFile]    = useState<File | null>(null);
  const [mode,    setMode]    = useState<ImportMode>('append');
  const [preview, setPreview] = useState<GraphPreviewResult | null>(null);
  const [result,  setResult]  = useState<GraphImportResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const previewMut = useMutation({
    mutationFn: (f: File) => (adminService.previewGraphCsv as any)(datasetType, f, mode),
    onSuccess: (data: GraphPreviewResult) => { setPreview(data); setStage('preview'); },
    onError:   (e: Error) => { setError(e.message); setStage('error'); },
  });

  const importMut = useMutation({
    mutationFn: (f: File) => (adminService.importGraphCsv as any)(datasetType, f, mode),
    onSuccess: (data: GraphImportResult) => {
      setResult(data);
      setStage('done');
      qc.invalidateQueries({ queryKey: ['graphMetrics'] });
      qc.invalidateQueries({ queryKey: ['datasetStatuses'] });
      qc.invalidateQueries({ queryKey: ['graphImportLogs'] });
      onSuccess();
    },
    onError: (e: Error) => { setError(e.message); setStage('error'); },
  });

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    setStage('uploading');
    previewMut.mutate(f);
  }, [previewMut]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const reset = () => {
    setStage('idle'); setFile(null); setPreview(null);
    setResult(null);  setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const grouped = preview ? groupErrors(preview.errors) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn('h-2.5 w-2.5 rounded-full', c.dot)} />
          <div>
            <h3 className="text-base font-bold text-surface-900">{meta.label}</h3>
            <p className="text-xs text-surface-500">{meta.description}</p>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-500 hover:bg-surface-50">
          ✕ Close
        </button>
      </div>

      {/* Pipeline stages */}
      <StageIndicator stage={stage === 'error' ? 'idle' : stage} />

      {/* ── Stage 1: Upload ───────────────────────────────────────────────── */}
      {stage === 'idle' && (
        <div className="space-y-4">
          {/* Schema reference */}
          <div className="rounded-xl border border-surface-100 bg-surface-50 p-4">
            <p className="mb-2 text-xs font-semibold text-surface-500 uppercase tracking-wider">Expected CSV Schema</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {meta.required.map(f => (
                <span key={f} className="rounded-md bg-surface-900 px-2 py-0.5 text-[11px] font-mono font-semibold text-white">{f}*</span>
              ))}
              {meta.optional.map(f => (
                <span key={f} className="rounded-md bg-surface-200 px-2 py-0.5 text-[11px] font-mono text-surface-500">{f}</span>
              ))}
            </div>
            <p className="text-[11px] font-mono text-surface-400">e.g. {meta.example}</p>
          </div>

          {/* Import mode */}
          <div className="flex gap-3">
            {(['append', 'replace'] as ImportMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 rounded-xl border px-4 py-3 text-left transition-all',
                  mode === m
                    ? 'border-hr-400 bg-hr-50 ring-2 ring-hr-200'
                    : 'border-surface-200 hover:border-surface-300 hover:bg-surface-50'
                )}
              >
                <p className="text-sm font-semibold text-surface-900 capitalize">{m}</p>
                <p className="mt-0.5 text-[11px] text-surface-400">
                  {m === 'append'
                    ? 'Add new rows, update existing. Safe for incremental imports.'
                    : 'Delete all existing records first, then write the full dataset. Use with caution.'}
                </p>
                {m === 'replace' && (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">⚠ Destructive — cannot be undone</p>
                )}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-surface-200 bg-surface-50 py-12 transition-all hover:border-hr-300 hover:bg-hr-50"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-surface-100">
              <svg className="h-6 w-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-surface-700">Drop CSV file here or click to browse</p>
              <p className="text-xs text-surface-400 mt-1">CSV files only · Max 10MB</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        </div>
      )}

      {/* ── Stage 2: Uploading/parsing ─────────────────────────────────────── */}
      {stage === 'uploading' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-surface-100" />
            <div className="absolute inset-0 rounded-full border-4 border-t-hr-500 animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-surface-700">Parsing & validating…</p>
            <p className="text-xs text-surface-400 mt-1 font-mono">{file?.name}</p>
          </div>
        </div>
      )}

      {/* ── Stage 3+4: Validation results ──────────────────────────────────── */}
      {stage === 'preview' && preview && grouped && (
        <div className="space-y-4">
          {/* Stat pills */}
          <div className="grid grid-cols-4 gap-2">
            <StatPill label="Total Rows"  value={preview.processed}  variant="neutral" />
            <StatPill label="Importable"  value={preview.importable} variant={preview.importable > 0 ? 'good' : 'danger'} />
            <StatPill label="Rejected"    value={preview.processed - preview.importable} variant={preview.processed - preview.importable > 0 ? 'warn' : 'neutral'} />
            <StatPill label="Errors"      value={preview.errorCount} variant={preview.errorCount > 0 ? 'danger' : 'good'} />
          </div>

          {/* Error breakdown */}
          {preview.errorCount > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Validation Issues</p>
              <ErrorGroup
                title="Schema Errors (missing required fields)"
                errors={grouped.field}
                color="border-red-200 bg-red-50 text-red-700"
              />
              <ErrorGroup
                title="Duplicate IDs (within file)"
                errors={grouped.duplicate}
                color="border-amber-200 bg-amber-50 text-amber-700"
              />
              <ErrorGroup
                title="Graph Dependency Errors (foreign keys)"
                errors={grouped.fk}
                color="border-orange-200 bg-orange-50 text-orange-700"
              />
            </div>
          )}

          {/* Validation Summary */}
          <ValidationSummary preview={preview} />

          {/* Preview table */}
          {preview.preview.length > 0 && (
            <div className="rounded-xl border border-surface-100 overflow-hidden">
              <div className="bg-surface-50 border-b border-surface-100 px-4 py-2.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-surface-600">Sample rows (first 10 importable)</p>
                <span className="text-[10px] text-surface-400">All {fmtNum(preview.importable)} rows will be written</span>
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="min-w-full text-xs">
                  <thead className="bg-surface-50 sticky top-0">
                    <tr>
                      {Object.keys(preview.preview[0]).map(k => (
                        <th key={k} className="px-3 py-2 text-left font-semibold text-surface-500 whitespace-nowrap border-b border-surface-100">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50">
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="hover:bg-surface-50">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-1.5 font-mono text-surface-600 max-w-[180px] truncate">{String(v ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dependency note */}
          {meta.depends.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <svg className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">
                This dataset depends on <strong>{meta.depends.join(', ')}</strong> being loaded first.
                FK errors indicate missing rows in those collections.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setStage('confirming')}
              disabled={preview.importable === 0}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors',
                preview.importable > 0
                  ? 'bg-hr-600 text-white hover:bg-hr-700'
                  : 'bg-surface-100 text-surface-400 cursor-not-allowed'
              )}
            >
              Continue to Confirmation →
            </button>
            <button onClick={reset} className="rounded-xl border border-surface-200 px-4 text-sm font-medium text-surface-600 hover:bg-surface-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Stage 5: Confirmation ──────────────────────────────────────────── */}
      {stage === 'confirming' && preview && (
        <div className="space-y-4">
          <div className={cn(
            'rounded-xl border p-5',
            mode === 'replace' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
          )}>
            <div className="flex items-start gap-3">
              <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg',
                mode === 'replace' ? 'bg-red-100' : 'bg-emerald-100')}>
                {mode === 'replace' ? '⚠' : '✓'}
              </div>
              <div>
                <p className={cn('font-bold text-sm', mode === 'replace' ? 'text-red-800' : 'text-emerald-800')}>
                  {mode === 'replace'
                    ? `Replace entire "${meta.label}" collection`
                    : `Append ${fmtNum(preview.importable)} rows to "${meta.label}"`}
                </p>
                <p className={cn('text-xs mt-1', mode === 'replace' ? 'text-red-600' : 'text-emerald-600')}>
                  {mode === 'replace'
                    ? `All existing ${meta.label} records will be permanently deleted before the ${fmtNum(preview.importable)} new rows are written. This cannot be undone.`
                    : `${fmtNum(preview.importable)} valid rows from "${file?.name}" will be written to Firestore using set({ merge: true }).`}
                </p>
                {preview.processed - preview.importable > 0 && (
                  <p className="text-xs mt-1 text-amber-700 font-medium">
                    {fmtNum(preview.processed - preview.importable)} rows will be skipped due to validation errors.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-surface-50 border border-surface-100 p-3">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Dataset</p>
              <p className="font-semibold text-surface-800 mt-0.5">{meta.label}</p>
            </div>
            <div className="rounded-lg bg-surface-50 border border-surface-100 p-3">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Mode</p>
              <p className={cn('font-semibold mt-0.5 capitalize', mode === 'replace' ? 'text-red-700' : 'text-emerald-700')}>{mode}</p>
            </div>
            <div className="rounded-lg bg-surface-50 border border-surface-100 p-3">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Rows to Write</p>
              <p className="font-semibold text-surface-800 mt-0.5">{fmtNum(preview.importable)}</p>
            </div>
            <div className="rounded-lg bg-surface-50 border border-surface-100 p-3">
              <p className="text-[10px] uppercase tracking-wider text-surface-400">Rows Skipped</p>
              <p className={cn('font-semibold mt-0.5', preview.errorCount > 0 ? 'text-amber-700' : 'text-surface-400')}>
                {fmtNum(preview.processed - preview.importable)}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setStage('importing'); importMut.mutate(file!); }}
              className={cn(
                'flex-1 rounded-xl py-3 text-sm font-bold transition-colors',
                mode === 'replace'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-hr-600 text-white hover:bg-hr-700'
              )}
            >
              {mode === 'replace' ? '⚠ Confirm Replace & Import' : '↑ Confirm Import'}
            </button>
            <button onClick={() => setStage('preview')} className="rounded-xl border border-surface-200 px-4 text-sm font-medium text-surface-600 hover:bg-surface-50">
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* ── Stage 6: Importing ─────────────────────────────────────────────── */}
      {stage === 'importing' && (
        <div className="flex flex-col items-center gap-5 py-12">
          <div className="relative h-16 w-16">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="4" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="#6366f1" strokeWidth="4"
                strokeDasharray="175.9" strokeDashoffset="44" strokeLinecap="round"
                className="animate-spin origin-center" style={{ animationDuration: '2s' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="h-6 w-6 text-hr-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-surface-800">Writing to Firestore…</p>
            <p className="text-xs text-surface-400 mt-1">Batch writing {fmtNum(preview?.importable ?? 0)} records</p>
            {mode === 'replace' && (
              <p className="text-xs text-red-500 mt-1 font-medium">Deleting existing records first…</p>
            )}
          </div>
        </div>
      )}

      {/* ── Stage 7: Import Report ─────────────────────────────────────────── */}
      {stage === 'done' && result && (
        <div className="space-y-4">
          {/* Success banner */}
          <div className={cn(
            'rounded-xl border p-4 flex items-start gap-3',
            result.errorCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
          )}>
            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center text-lg flex-shrink-0',
              result.errorCount > 0 ? 'bg-amber-100' : 'bg-emerald-100')}>
              {result.errorCount > 0 ? '⚠' : '✓'}
            </div>
            <div>
              <p className={cn('font-bold text-sm', result.errorCount > 0 ? 'text-amber-800' : 'text-emerald-800')}>
                {result.errorCount > 0
                  ? `Partial import completed — ${fmtNum(result.errorCount)} rows skipped`
                  : `Import successful — ${fmtNum(result.imported)} rows written`}
              </p>
              <p className={cn('text-xs mt-0.5', result.errorCount > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                Completed in {fmtDuration(result.durationMs)} · Mode: {result.mode}
                {result.mode === 'replace' && result.deleted > 0 && ` · Deleted ${fmtNum(result.deleted)} existing records`}
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Processed" value={result.processed}  variant="neutral" />
            <StatPill label="Imported"  value={result.imported}   variant="good" />
            <StatPill label="Skipped"   value={result.skipped}    variant={result.skipped > 0 ? 'warn' : 'neutral'} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatPill label="Field Err"     value={result.fieldErrors.length}     variant={result.fieldErrors.length > 0 ? 'danger' : 'neutral'} />
            <StatPill label="Duplicate Err" value={result.duplicateErrors.length} variant={result.duplicateErrors.length > 0 ? 'warn' : 'neutral'} />
            <StatPill label="FK Err"        value={result.fkErrors.length}        variant={result.fkErrors.length > 0 ? 'warn' : 'neutral'} />
          </div>

          {/* Errors in report */}
          {result.errorCount > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Skipped Rows Detail</p>
              {(() => { const g = groupErrors(result.errors); return (<>
                <ErrorGroup title="Schema Errors"       errors={g.field}     color="border-red-200 bg-red-50 text-red-700" />
                <ErrorGroup title="Duplicate IDs"       errors={g.duplicate} color="border-amber-200 bg-amber-50 text-amber-700" />
                <ErrorGroup title="FK / Dependency Err" errors={g.fk}        color="border-orange-200 bg-orange-50 text-orange-700" />
                <ErrorGroup title="Write Errors"        errors={g.write}     color="border-red-200 bg-red-50 text-red-700" />
              </>); })()}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 rounded-xl border border-surface-200 py-2.5 text-sm font-semibold text-surface-600 hover:bg-surface-50">
              Import Another File
            </button>
            <button onClick={onClose} className="rounded-xl bg-surface-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-surface-800">
              Done
            </button>
          </div>
        </div>
      )}

      {/* ── Error state ────────────────────────────────────────────────────── */}
      {stage === 'error' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-lg flex-shrink-0">✕</div>
              <div>
                <p className="font-bold text-sm text-red-800">Import failed</p>
                <p className="text-xs text-red-600 mt-0.5 font-mono">{error}</p>
              </div>
            </div>
          </div>
          <button onClick={reset} className="w-full rounded-xl border border-surface-200 py-2.5 text-sm font-semibold text-surface-600 hover:bg-surface-50">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}


// ─── CSV Template data ────────────────────────────────────────────────────────

const CSV_TEMPLATES: Record<GraphDatasetType, { headers: string[]; example: string }> = {
  roles:               { headers: ['role_id','role_name','role_family','seniority_level','description'],                  example: 'se_1,Software Engineer,Engineering,mid,Develops software' },
  skills:              { headers: ['skill_id','skill_name','skill_category','difficulty_level','demand_score'],            example: 'python_basics,Python Basics,technical,2,8.5' },
  role_skills:         { headers: ['role_id','skill_id','importance_weight'],                                             example: 'se_1,python_basics,0.9' },
  role_transitions:    { headers: ['from_role_id','to_role_id','probability','years_required','transition_type'],         example: 'se_1,se_2,0.8,2,primary' },
  skill_relationships: { headers: ['skill_id','related_skill_id','relationship_type','strength_score'],                  example: 'python_adv,python_basics,prerequisite,1.0' },
  role_education:      { headers: ['role_id','education_level','match_score'],                                            example: "se_1,Bachelor's Degree,90" },
  role_salary_market:  { headers: ['role_id','country','median_salary','p25','p75','currency'],                          example: 'se_1,IN,1200000,800000,1800000,INR' },
};

function downloadTemplate(datasetType: GraphDatasetType) {
  const tpl   = CSV_TEMPLATES[datasetType];
  const lines = [tpl.headers.join(','), tpl.example];
  const blob  = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `${datasetType}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import Order Guide ───────────────────────────────────────────────────────

const IMPORT_ORDER: { step: number; type: GraphDatasetType; reason: string }[] = [
  { step: 1, type: 'roles',               reason: 'Foundation — all other datasets depend on roles' },
  { step: 2, type: 'skills',              reason: 'Required by role_skills and skill_relationships' },
  { step: 3, type: 'role_skills',         reason: 'Links roles to their required skills' },
  { step: 4, type: 'role_transitions',    reason: 'Defines career path edges between roles' },
  { step: 5, type: 'skill_relationships', reason: 'Links prerequisite and related skills' },
  { step: 6, type: 'role_education',      reason: 'Education match scores per role' },
  { step: 7, type: 'role_salary_market',  reason: 'Market salary benchmarks per role' },
];

function ImportOrderGuide({ onSelect }: { onSelect: (t: GraphDatasetType) => void }) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden">
      <div className="border-b border-surface-100 bg-surface-50 px-5 py-3.5">
        <p className="text-sm font-bold text-surface-900">Recommended Import Order</p>
        <p className="text-[11px] text-surface-400 mt-0.5">Import in this order to avoid FK dependency errors</p>
      </div>
      <div className="divide-y divide-surface-50">
        {IMPORT_ORDER.map(({ step, type, reason }) => {
          const meta = DATASET_MAP[type];
          const c    = COLOR_MAP[meta.color];
          return (
            <div key={type} className="flex items-center gap-3 px-5 py-3 group hover:bg-surface-50">
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-surface-200 text-[11px] font-bold text-surface-400">
                {step}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', c.dot)} />
                  <span className="text-sm font-semibold text-surface-800">{meta.label}</span>
                  <span className="text-[10px] font-mono text-surface-400">{type}</span>
                </div>
                <p className="text-[11px] text-surface-400 mt-0.5 ml-3.5">{reason}</p>
              </div>
              <button
                onClick={() => onSelect(type)}
                className="flex-shrink-0 rounded-lg border border-surface-200 px-2.5 py-1 text-[11px] font-medium text-surface-600 opacity-0 group-hover:opacity-100 hover:bg-hr-50 hover:border-hr-200 hover:text-hr-700 transition-all"
              >
                Import
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dataset Dependency Map ───────────────────────────────────────────────────

function DependencyMap() {
  const TREE = [
    { root: 'roles',  children: ['role_skills', 'role_transitions', 'role_education', 'role_salary_market'] },
    { root: 'skills', children: ['skill_relationships'] },
  ];
  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden">
      <div className="border-b border-surface-100 bg-surface-50 px-5 py-3.5">
        <p className="text-sm font-bold text-surface-900">Dataset Dependency Map</p>
        <p className="text-[11px] text-surface-400 mt-0.5">Which datasets require which to exist first</p>
      </div>
      <div className="p-5 space-y-4">
        {TREE.map(({ root, children }) => {
          const rootMeta = DATASET_MAP[root as GraphDatasetType];
          return (
            <div key={root} className="font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', COLOR_MAP[rootMeta.color].dot)} />
                <span className="font-bold text-surface-900">{root}</span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', COLOR_MAP[rootMeta.color].badge)}>root</span>
              </div>
              <div className="ml-2 mt-1 space-y-1 border-l-2 border-surface-100 pl-4">
                {children.map((child, i) => {
                  const childMeta = DATASET_MAP[child as GraphDatasetType];
                  return (
                    <div key={child} className="flex items-center gap-2">
                      <span className="text-surface-300">{i === children.length - 1 ? '└─' : '├─'}</span>
                      <span className={cn('h-1.5 w-1.5 rounded-full', COLOR_MAP[childMeta.color].dot)} />
                      <span className="text-surface-700">{child}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Graph Coverage Panel (Import Center) ─────────────────────────────────────

function GraphCoveragePanel() {
  // Reuse the already-working datasetStatuses query — no extra API call needed.
  // Coverage = (count of dependent dataset / count of roles) * 100
  const { data: statuses, isLoading } = useQuery({
    queryKey: ['datasetStatuses'],
    queryFn:  () => adminService.getDatasetStatuses(),
    staleTime: 30_000,
    refetchOnMount: true,
  });

  const roleCount       = statuses?.find((s: DatasetStatusEntry) => s.dataset === 'roles')?.count ?? 0;
  const roleSkillCount  = statuses?.find((s: DatasetStatusEntry) => s.dataset === 'role_skills')?.count ?? 0;
  const transCount      = statuses?.find((s: DatasetStatusEntry) => s.dataset === 'role_transitions')?.count ?? 0;
  const eduCount        = statuses?.find((s: DatasetStatusEntry) => s.dataset === 'role_education')?.count ?? 0;
  const salaryCount     = statuses?.find((s: DatasetStatusEntry) => s.dataset === 'role_salary_market')?.count ?? 0;

  // Estimate unique roles covered: cap at roleCount
  const pct = (n: number) => roleCount > 0 ? Math.min(100, Math.round((Math.min(n, roleCount) / roleCount) * 100)) : 0;

  const rows = [
    { label: 'Roles with Skills',      pct: pct(roleSkillCount) },
    { label: 'Roles with Transitions', pct: pct(transCount) },
    { label: 'Roles with Education',   pct: pct(eduCount) },
    { label: 'Roles with Salary',      pct: pct(salaryCount) },
  ];

  const barCls = (p: number) => p >= 80 ? 'bg-emerald-500' : p >= 40 ? 'bg-amber-400' : 'bg-red-400';
  const txtCls = (p: number) => p >= 80 ? 'text-emerald-700' : p >= 40 ? 'text-amber-700' : 'text-red-600';

  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden">
      <div className="border-b border-surface-100 bg-surface-50 px-5 py-3.5">
        <p className="text-sm font-bold text-surface-900">Graph Coverage</p>
        <p className="text-[11px] text-surface-400 mt-0.5">% of roles covered by each dataset</p>
      </div>
      <div className="p-5">
        {isLoading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-6 animate-pulse rounded bg-surface-100" />)}</div>
        ) : roleCount === 0 ? (
          <p className="text-center text-sm text-surface-400 py-3">No roles dataset found.</p>
        ) : (
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-surface-700">{r.label}</span>
                  <span className={cn('text-xs font-bold', txtCls(r.pct))}>{r.pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-100">
                  <div className={cn('h-1.5 rounded-full transition-all', barCls(r.pct))} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-surface-300">Based on {roleCount} total roles</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateDownloads() {
  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden">
      <div className="border-b border-surface-100 bg-surface-50 px-5 py-3.5">
        <p className="text-sm font-bold text-surface-900">CSV Templates</p>
        <p className="text-[11px] text-surface-400 mt-0.5">Download starter templates for each dataset</p>
      </div>
      <div className="divide-y divide-surface-50">
        {DATASETS.map(meta => (
          <button
            key={meta.type}
            onClick={() => downloadTemplate(meta.type)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-50 transition-colors group"
          >
            <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg', COLOR_MAP[meta.color].bg)}>
              <svg className={cn('h-3.5 w-3.5', COLOR_MAP[meta.color].text)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-surface-800 group-hover:text-hr-700">{meta.type}.csv</p>
              <p className="text-[10px] text-surface-400 font-mono">{CSV_TEMPLATES[meta.type].headers.slice(0, 3).join(', ')}…</p>
            </div>
            <svg className="h-3.5 w-3.5 flex-shrink-0 text-surface-300 group-hover:text-hr-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Validation Summary ───────────────────────────────────────────────────────

function ValidationSummary({ preview }: { preview: GraphPreviewResult }) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden">
      <div className="border-b border-surface-50 bg-surface-50 px-4 py-3">
        <p className="text-xs font-bold text-surface-700 uppercase tracking-wider">Validation Summary</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-surface-100">
        {[
          { label: 'Rows Scanned', value: preview.processed,  color: 'text-surface-800' },
          { label: 'Valid Rows',   value: preview.importable, color: preview.importable > 0 ? 'text-emerald-600' : 'text-surface-400' },
          { label: 'Errors',       value: preview.errorCount, color: preview.errorCount > 0 ? 'text-red-600' : 'text-surface-400' },
        ].map(s => (
          <div key={s.label} className="p-4 text-center">
            <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value.toLocaleString()}</p>
            <p className="text-[10px] uppercase tracking-wider text-surface-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      {preview.errorCount > 0 && (
        <div className="border-t border-surface-50 px-4 py-2 flex flex-wrap gap-2">
          {preview.fieldErrors.length > 0    && <span className="rounded-full bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-semibold">{preview.fieldErrors.length} schema</span>}
          {preview.duplicateErrors.length > 0 && <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">{preview.duplicateErrors.length} duplicate</span>}
          {preview.fkErrors.length > 0        && <span className="rounded-full bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 text-[10px] font-semibold">{preview.fkErrors.length} FK</span>}
        </div>
      )}
    </div>
  );
}


// ─── Import Logs Table ────────────────────────────────────────────────────────

function ImportLogsTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['graphImportLogs'],
    queryFn:  () => adminService.getGraphImportLogs(30),
    staleTime: 30_000,
  });

  const STATUS = (log: any) =>
    log.errors_detected === 0 ? 'success'
    : log.rows_imported > 0   ? 'partial'
    : 'error';

  const STATUS_STYLE = {
    success: 'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
    error:   'bg-red-100 text-red-700',
  };

  return (
    <div className="rounded-xl border border-surface-100 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-100 bg-surface-50">
        <svg className="h-4 w-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="font-semibold text-sm text-surface-800">Import History</span>
        <span className="ml-auto text-xs text-surface-400">{data?.count ?? '—'} records</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-hr-500 border-t-transparent" />
        </div>
      ) : (
        <div className="divide-y divide-surface-50 max-h-72 overflow-y-auto">
          {(data?.logs ?? []).length === 0 ? (
            <p className="text-center text-sm text-surface-400 py-8">No imports yet.</p>
          ) : data!.logs.map((log: any) => {
            const st = STATUS(log);
            const meta = DATASET_MAP[(log.dataset_name ?? log.entity_type) as GraphDatasetType];
            return (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50">
                <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                  st === 'success' ? 'bg-emerald-500' : st === 'partial' ? 'bg-amber-400' : 'bg-red-500')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-surface-800">{meta?.label ?? log.dataset_name}</span>
                    <span className={cn('text-[10px] font-semibold rounded-full px-1.5 py-0.5 uppercase tracking-wider', STATUS_STYLE[st])}>{st}</span>
                    {log.import_mode && (
                      <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-surface-100 text-surface-500 uppercase">{log.import_mode}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-surface-400 mt-0.5">
                    {fmtNum(log.rows_imported ?? log.created_count)}/{fmtNum(log.rows_processed ?? log.total_rows)} rows
                    {log.duplicate_errors > 0 && ` · ${fmtNum(log.duplicate_errors)} dup`}
                    {log.fk_errors > 0 && ` · ${fmtNum(log.fk_errors)} FK err`}
                    {log.duration_ms && ` · ${fmtDuration(log.duration_ms)}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-mono text-surface-400">{(log.admin_user_id ?? log.admin_id ?? 'unknown').slice(0, 8)}…</p>
                  <p className="text-[10px] text-surface-300">{fmtDate(log.import_time ?? log.imported_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GraphDataImportCenter({ initialDataset }: { initialDataset?: GraphDatasetType } = {}) {
  const qc = useQueryClient();
  const [activeImport, setActiveImport] = useState<GraphDatasetType | null>(initialDataset ?? null);

  const { data: statuses, isLoading: statusLoading } = useQuery({
    queryKey:  ['datasetStatuses'],
    queryFn:   () => (adminService as any).getDatasetStatuses
      ? (adminService as any).getDatasetStatuses()
      : fetch('/api/v1/admin/graph/dataset-statuses', {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        }).then(r => r.json()).then(r => r.data ?? []),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: metrics } = useQuery({
    queryKey:  ['graphMetrics'],
    queryFn:   () => adminService.getGraphMetrics(),
    staleTime: 60_000,
  });

  // Summary stats from statuses
  const loaded  = statuses?.filter((s: DatasetStatusEntry) => s.status === 'loaded').length  ?? 0;
  const partial = statuses?.filter((s: DatasetStatusEntry) => s.status === 'partial').length ?? 0;
  const missing = statuses?.filter((s: DatasetStatusEntry) => s.status === 'missing').length ?? 0;

  const GROUPS = ['Career Graph', 'Skill Graph', 'Market Intelligence'];

  return (
    <div className="space-y-8">
      {/* ── Import drawer overlay ─────────────────────────────────────────── */}
      {activeImport && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl animate-slide-up">
            <div className="sticky top-0 z-10 border-b border-surface-100 bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-hr-600 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-surface-900">Data Import Pipeline</p>
                  <p className="text-xs text-surface-400">Safe enterprise ingestion workflow</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <DatasetImporter
                datasetType={activeImport}
                onClose={() => setActiveImport(null)}
                onSuccess={() => qc.invalidateQueries({ queryKey: ['datasetStatuses'] })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-surface-900">Admin Data Import Center</h2>
          <p className="mt-1 text-sm text-surface-500">
            Safe 7-stage ingestion pipeline — validate, preview, and confirm before any data is written to Firestore.
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { count: loaded,  label: 'Loaded',  color: 'bg-emerald-500' },
            { count: partial, label: 'Partial', color: 'bg-amber-400' },
            { count: missing, label: 'Missing', color: 'bg-red-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 rounded-lg border border-surface-100 bg-white px-3 py-1.5">
              <span className={cn('h-2 w-2 rounded-full', s.color)} />
              <span className="text-xs font-semibold text-surface-700">{s.count} {s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Graph metrics bar ──────────────────────────────────────────────── */}
      {metrics && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
          {[
            { label: 'Roles',        value: metrics.total_roles,               color: 'text-blue-600' },
            { label: 'Skills',       value: metrics.total_skills,              color: 'text-emerald-600' },
            { label: 'Role Skills',  value: metrics.total_role_skills,         color: 'text-blue-600' },
            { label: 'Transitions',  value: metrics.total_role_transitions,    color: 'text-blue-600' },
            { label: 'Skill Links',  value: metrics.total_skill_relationships, color: 'text-emerald-600' },
            { label: 'Education',    value: metrics.total_role_education,      color: 'text-violet-600' },
            { label: 'Salary Recs',  value: metrics.total_salary_records,      color: 'text-violet-600' },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-surface-100 bg-white p-3 text-center">
              <p className={cn('text-xl font-bold tabular-nums', m.color)}>{fmtNum(m.value)}</p>
              <p className="text-[10px] uppercase tracking-wider text-surface-400 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Dataset status cards by group ──────────────────────────────────── */}
      {statusLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-hr-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {GROUPS.map(group => {
            const groupDatasets = DATASETS.filter(d => d.group === group);
            return (
              <div key={group}>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-surface-400">{group}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {groupDatasets.map(meta => {
                    const entry = statuses?.find((s: DatasetStatusEntry) => s.dataset === meta.type);
                    if (!entry) return null;
                    return (
                      <DatasetStatusCard
                        key={meta.type}
                        entry={entry}
                        onImport={setActiveImport}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Import tools sidebar panels ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ImportOrderGuide onSelect={setActiveImport} />
        <DependencyMap />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GraphCoveragePanel />
        <TemplateDownloads />
      </div>

      {/* ── Import history ─────────────────────────────────────────────────── */}
      <ImportLogsTable />
    </div>
  );
}