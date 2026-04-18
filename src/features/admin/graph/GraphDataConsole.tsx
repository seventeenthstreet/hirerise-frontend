'use client';

/**
 * GraphDataConsole.tsx
 *
 * Graph Data Management Console — unified view for:
 *   - Career Graph (roles, transitions, role-skills)
 *   - Skill Graph (skills, relationships)
 *   - Market Intelligence (education, salary)
 *   - Data Tools (validator, import logs)
 *
 * Each section supports: CSV upload → preview → validate → import confirmation
 */

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import type {
  GraphDatasetType, GraphMetrics, GraphImportResult,
  GraphPreviewResult, GraphValidationReport, GraphImportLog,
} from '@/types/admin';

// ─── Dataset registry ─────────────────────────────────────────────────────────

interface DatasetConfig {
  type:         GraphDatasetType;
  label:        string;
  section:      string;
  description:  string;
  required:     string[];
  optional:     string[];
  example:      string;
  color:        string;
}

const DATASETS: DatasetConfig[] = [
  {
    type: 'roles', label: 'Roles', section: 'career',
    description: 'Career roles with family and seniority classification.',
    required: ['role_id', 'role_name'],
    optional: ['role_family', 'seniority_level', 'description'],
    example: 'se_1,Software Engineer,Software Engineering,junior,Entry-level SWE role',
    color: 'blue',
  },
  {
    type: 'role_transitions', label: 'Career Transitions', section: 'career',
    description: 'Directed edges between roles in the career graph.',
    required: ['from_role_id', 'to_role_id'],
    optional: ['probability', 'years_required', 'transition_type'],
    example: 'se_1,se_2,0.8,2,primary',
    color: 'blue',
  },
  {
    type: 'role_skills', label: 'Role Skills', section: 'career',
    description: 'Mapping of required and preferred skills to each role.',
    required: ['role_id', 'skill_id'],
    optional: ['importance_weight'],
    example: 'se_1,python_basics,1.0',
    color: 'blue',
  },
  {
    type: 'skills', label: 'Skills', section: 'skill',
    description: 'Canonical skill registry with category and difficulty.',
    required: ['skill_id', 'skill_name'],
    optional: ['skill_category', 'difficulty_level', 'demand_score'],
    example: 'python_basics,Python (Basics),technical,1,8',
    color: 'emerald',
  },
  {
    type: 'skill_relationships', label: 'Skill Relationships', section: 'skill',
    description: 'Prerequisite and related edges between skills.',
    required: ['skill_id', 'related_skill_id', 'relationship_type'],
    optional: ['strength_score'],
    example: 'python_advanced,python_basics,prerequisite,1.0',
    color: 'emerald',
  },
  {
    type: 'role_education', label: 'Education Mapping', section: 'market',
    description: 'Education level match scores per role.',
    required: ['role_id', 'education_level'],
    optional: ['match_score'],
    example: 'se_1,Bachelor\'s Degree,90',
    color: 'violet',
  },
  {
    type: 'role_salary_market', label: 'Salary Benchmarks', section: 'market',
    description: 'Market salary data by role and country.',
    required: ['role_id', 'country'],
    optional: ['median_salary', 'p25', 'p75', 'currency'],
    example: 'se_1,IN,1200000,800000,1800000,INR',
    color: 'violet',
  },
];

const SECTION_META = {
  career: { label: 'Career Graph',        color: 'blue',   icon: NodeIcon    },
  skill:  { label: 'Skill Graph',         color: 'emerald', icon: GraphIcon   },
  market: { label: 'Market Intelligence', color: 'violet',  icon: ChartIcon   },
};

// ─── Color maps ───────────────────────────────────────────────────────────────

const COLOR = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'   },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700',badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500'  },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-500'   },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500'     },
} as const;

// ─── Icons ────────────────────────────────────────────────────────────────────

function NodeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
}
function GraphIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
}
function ChartIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
function UploadIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
}
function ShieldIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
}
function ClockIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function CheckCircleIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function XCircleIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, color = 'blue' }: { label: string; value: number | undefined; color?: keyof typeof COLOR }) {
  const c = COLOR[color];
  return (
    <div className={cn('rounded-xl border p-4', c.bg, c.border)}>
      <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', c.text)}>
        {value == null
          ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-surface-100" />
          : value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── Import Panel (per dataset) ───────────────────────────────────────────────

type ImportPhase = 'idle' | 'previewing' | 'preview_done' | 'importing' | 'done' | 'error';

function DatasetImportPanel({ config }: { config: DatasetConfig }) {
  const qc         = useQueryClient();
  const fileRef    = useRef<HTMLInputElement>(null);
  const [phase, setPhase]   = useState<ImportPhase>('idle');
  const [file, setFile]     = useState<File | null>(null);
  const [preview, setPreview] = useState<GraphPreviewResult | null>(null);
  const [result, setResult]   = useState<GraphImportResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const c = COLOR[config.color as keyof typeof COLOR] ?? COLOR.blue;

  const previewMut = useMutation({
    mutationFn: (f: File) => adminService.previewGraphCsv(config.type, f),
    onSuccess: (data) => { setPreview(data); setPhase('preview_done'); },
    onError:   (e: Error) => { setError(e.message); setPhase('error'); },
  });

  const importMut = useMutation({
    mutationFn: (f: File) => adminService.importGraphCsv(config.type, f),
    onSuccess: (data) => {
      setResult(data);
      setPhase('done');
      qc.invalidateQueries({ queryKey: ['graphMetrics'] });
      qc.invalidateQueries({ queryKey: ['graphImportLogs'] });
    },
    onError: (e: Error) => { setError(e.message); setPhase('error'); },
  });

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPhase('previewing');
    setError(null);
    setPreview(null);
    setResult(null);
    previewMut.mutate(f);
  }, [previewMut]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const reset = () => {
    setPhase('idle'); setFile(null); setPreview(null);
    setResult(null); setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className={cn('rounded-xl border', c.border, 'bg-white overflow-hidden')}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-5 py-3.5', c.bg)}>
        <div className="flex items-center gap-2.5">
          <span className={cn('h-2 w-2 rounded-full', c.dot)} />
          <span className={cn('font-semibold text-sm', c.text)}>{config.label}</span>
          <span className="text-xs text-surface-400">{config.description}</span>
        </div>
        {phase !== 'idle' && (
          <button onClick={reset} className="text-xs text-surface-400 hover:text-surface-600 transition-colors">
            Reset
          </button>
        )}
      </div>

      <div className="p-5">
        {/* Schema hint */}
        <div className="mb-4 rounded-lg bg-surface-50 border border-surface-100 px-3.5 py-2.5">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {config.required.map(f => (
              <span key={f} className="rounded-md bg-surface-900 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-white">{f}</span>
            ))}
            {config.optional.map(f => (
              <span key={f} className="rounded-md bg-surface-200 px-1.5 py-0.5 text-[10px] font-mono text-surface-600">{f}</span>
            ))}
          </div>
          <p className="text-[10px] text-surface-400 font-mono truncate">e.g. {config.example}</p>
        </div>

        {/* Upload zone */}
        {(phase === 'idle') && (
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-surface-200 bg-surface-50 py-8 cursor-pointer hover:border-surface-300 hover:bg-surface-100 transition-all"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <UploadIcon className="h-7 w-7 text-surface-300 mb-2" />
            <p className="text-sm font-medium text-surface-500">Drop CSV file or click to browse</p>
            <p className="text-xs text-surface-400 mt-1">Max 10MB</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {/* Previewing */}
        {phase === 'previewing' && (
          <div className="flex items-center gap-3 rounded-xl border border-surface-100 bg-surface-50 px-5 py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-hr-500 border-t-transparent" />
            <span className="text-sm text-surface-600">Validating <span className="font-mono font-semibold">{file?.name}</span>…</span>
          </div>
        )}

        {/* Preview done */}
        {phase === 'preview_done' && preview && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Rows',      val: preview.processed,  color: 'surface-900' },
                { label: 'Importable',val: preview.importable, color: 'emerald-700' },
                { label: 'FK Errors', val: preview.fkErrors.length, color: preview.fkErrors.length > 0 ? 'red-600' : 'surface-400' },
                { label: 'Field Err', val: preview.fieldErrors.length, color: preview.fieldErrors.length > 0 ? 'amber-600' : 'surface-400' },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-surface-100 bg-surface-50 p-3 text-center">
                  <p className={`text-xl font-bold tabular-nums text-${s.color}`}>{s.val}</p>
                  <p className="text-[10px] uppercase tracking-widest text-surface-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Preview table */}
            {preview.preview.length > 0 && (
              <div className="rounded-lg border border-surface-100 overflow-auto max-h-48">
                <table className="min-w-full text-xs">
                  <thead className="bg-surface-50 border-b border-surface-100">
                    <tr>
                      {Object.keys(preview.preview[0]).map(k => (
                        <th key={k} className="px-3 py-2 text-left font-semibold text-surface-500 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-50">
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="hover:bg-surface-50">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-1.5 font-mono text-surface-600 max-w-[160px] truncate">{String(v ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Errors */}
            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-amber-700 mb-2">⚠ {preview.errors.length} issue{preview.errors.length > 1 ? 's' : ''} detected — affected rows will be skipped</p>
                {preview.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs font-mono text-amber-600">Row {e.row}: [{e.field}] {e.message}</p>
                ))}
                {preview.errors.length > 5 && <p className="text-xs text-amber-500 mt-1">…and {preview.errors.length - 5} more</p>}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { setPhase('importing'); importMut.mutate(file!); }}
                disabled={preview.importable === 0}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                  preview.importable > 0
                    ? 'bg-hr-600 text-white hover:bg-hr-700'
                    : 'bg-surface-100 text-surface-400 cursor-not-allowed'
                )}
              >
                <UploadIcon className="h-4 w-4" />
                Import {preview.importable} rows
              </button>
              <button onClick={reset} className="rounded-lg border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Importing */}
        {phase === 'importing' && (
          <div className="flex items-center gap-3 rounded-xl border border-hr-100 bg-hr-50 px-5 py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-hr-500 border-t-transparent" />
            <span className="text-sm text-hr-700 font-medium">Importing to Firestore…</span>
          </div>
        )}

        {/* Done */}
        {phase === 'done' && result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-emerald-700">Import complete</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xl font-bold text-emerald-700">{result.imported}</p><p className="text-[10px] text-emerald-600 uppercase tracking-wider">Imported</p></div>
              <div><p className="text-xl font-bold text-surface-500">{result.skipped}</p><p className="text-[10px] text-surface-400 uppercase tracking-wider">Skipped</p></div>
              <div><p className={cn('text-xl font-bold', result.errorCount > 0 ? 'text-red-600' : 'text-surface-400')}>{result.errorCount}</p><p className="text-[10px] text-surface-400 uppercase tracking-wider">Errors</p></div>
            </div>
            <button onClick={reset} className="mt-3 w-full rounded-lg border border-emerald-200 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 transition-colors">
              Import another file
            </button>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircleIcon className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-700">Import failed</span>
            </div>
            <p className="text-xs font-mono text-red-600">{error}</p>
            <button onClick={reset} className="mt-3 w-full rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors">Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Graph Validator Panel ────────────────────────────────────────────────────

export function GraphValidatorPanel() {
  const [report, setReport] = useState<GraphValidationReport | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () => adminService.validateGraph(),
    onSuccess:  (d) => setReport(d),
  });

  const ISSUE_LABELS: Record<string, string> = {
    orphan_roles:               'Orphan Roles',
    orphan_skills:              'Orphan Skills',
    broken_role_transitions:    'Broken Transitions',
    role_skills_missing_skills: 'Role Skills → Missing Skills',
    skill_rels_missing_skills:  'Skill Rels → Missing Skills',
    role_edu_missing_roles:     'Education → Missing Roles',
    salary_missing_roles:       'Salary → Missing Roles',
  };

  return (
    <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-surface-50 border-b border-surface-100">
        <div className="flex items-center gap-2.5">
          <ShieldIcon className="h-4 w-4 text-surface-500" />
          <span className="font-semibold text-sm text-surface-800">Graph Integrity Validator</span>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-hr-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-hr-700 disabled:opacity-60 transition-colors"
        >
          {isPending && <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />}
          {isPending ? 'Running…' : 'Run Validation'}
        </button>
      </div>

      <div className="p-5">
        {!report && !isPending && (
          <p className="text-center text-sm text-surface-400 py-8">
            Click "Run Validation" to check graph integrity across all collections.
          </p>
        )}

        {isPending && (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-hr-500 border-t-transparent" />
            <span className="text-sm text-surface-500">Checking Firestore collections…</span>
          </div>
        )}

        {report && (
          <div className="space-y-4">
            {/* Summary */}
            <div className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3',
              report.valid ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
            )}>
              {report.valid
                ? <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                : <XCircleIcon     className="h-5 w-5 text-red-500"     />}
              <div>
                <p className={cn('font-semibold text-sm', report.valid ? 'text-emerald-700' : 'text-red-700')}>
                  {report.valid ? 'Graph is valid — no integrity issues found' : `${report.total_issues} integrity issue${report.total_issues > 1 ? 's' : ''} detected`}
                </p>
                <p className="text-xs text-surface-400 mt-0.5">Checked at {new Date(report.checked_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Collection counts */}
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(report.counts).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-surface-100 bg-surface-50 px-3 py-2">
                  <p className="text-sm font-bold text-surface-800 tabular-nums">{v.toLocaleString()}</p>
                  <p className="text-[10px] font-mono text-surface-400">{k}</p>
                </div>
              ))}
            </div>

            {/* Issues */}
            {!report.valid && (
              <div className="space-y-2">
                {Object.entries(report.issues).map(([key, items]) => {
                  if (!items.length) return null;
                  return (
                    <div key={key} className="rounded-lg border border-red-100 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-700 mb-1.5">
                        {ISSUE_LABELS[key] ?? key} ({items.length})
                      </p>
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {(items as any[]).slice(0, 10).map((item, i) => (
                          <p key={i} className="text-xs font-mono text-red-600">
                            {typeof item === 'string' ? item : item.id ?? JSON.stringify(item)}
                            {item.reason && <span className="text-red-400 ml-2">— {item.reason}</span>}
                          </p>
                        ))}
                        {items.length > 10 && <p className="text-xs text-red-400">…and {items.length - 10} more</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Import Logs Panel ────────────────────────────────────────────────────────

export function ImportLogsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['graphImportLogs'],
    queryFn:  () => adminService.getGraphImportLogs(30),
    staleTime: 30_000,
  });

  const STATUS_COLOR = {
    success: 'text-emerald-700 bg-emerald-50',
    partial: 'text-amber-700  bg-amber-50',
    error:   'text-red-700    bg-red-50',
  };

  const getStatus = (log: GraphImportLog) =>
    log.errors_detected === 0       ? 'success'
    : log.rows_imported > 0         ? 'partial'
    : 'error';

  return (
    <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-surface-50 border-b border-surface-100">
        <ClockIcon className="h-4 w-4 text-surface-500" />
        <span className="font-semibold text-sm text-surface-800">Import History</span>
        <span className="ml-auto text-xs text-surface-400">{data?.count ?? '—'} records</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-hr-500 border-t-transparent" />
        </div>
      ) : (
        <div className="divide-y divide-surface-50 max-h-80 overflow-y-auto">
          {(data?.logs ?? []).length === 0 ? (
            <p className="text-center text-sm text-surface-400 py-8">No imports yet.</p>
          ) : (
            data!.logs.map((log) => {
              const status = getStatus(log);
              return (
                <div key={log.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-50">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                    background: status === 'success' ? '#10b981' : status === 'partial' ? '#f59e0b' : '#ef4444'
                  }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold font-mono text-surface-800">{log.dataset_name}</span>
                      <span className={cn('text-[10px] font-semibold rounded-full px-1.5 py-0.5 uppercase tracking-wider', STATUS_COLOR[status])}>
                        {status}
                      </span>
                    </div>
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      {log.rows_imported}/{log.rows_processed} rows imported
                      {log.errors_detected > 0 && ` · ${log.errors_detected} errors`}
                      {log.duration_ms && ` · ${(log.duration_ms / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-surface-400">{log.admin_user_id.slice(0, 8)}…</p>
                    <p className="text-[10px] text-surface-300">{new Date(log.import_time).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Console ─────────────────────────────────────────────────────────────

type Tab = 'career' | 'skill' | 'market' | 'tools';

export function GraphDataConsole({ defaultTab = 'career', singleDataset }: {
  defaultTab?: Tab;
  singleDataset?: GraphDatasetType;
}) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['graphMetrics'],
    queryFn:  () => adminService.getGraphMetrics(),
    staleTime: 60_000,
  });

  const TABS: { id: Tab; label: string; icon: React.FC<{className?: string}> }[] = [
    { id: 'career', label: 'Career Graph',        icon: NodeIcon  },
    { id: 'skill',  label: 'Skill Graph',          icon: GraphIcon },
    { id: 'market', label: 'Market Intelligence',  icon: ChartIcon },
    { id: 'tools',  label: 'Data Tools',           icon: ShieldIcon },
  ];

  const sectionDatasets = DATASETS.filter(d =>
    singleDataset ? d.type === singleDataset : d.section === activeTab
  );

  return (
    <div className="space-y-6">
      {/* Graph Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <MetricCard label="Roles"        value={metrics?.total_roles}               color="blue"    />
        <MetricCard label="Skills"       value={metrics?.total_skills}              color="emerald" />
        <MetricCard label="Role Skills"  value={metrics?.total_role_skills}         color="blue"    />
        <MetricCard label="Transitions"  value={metrics?.total_role_transitions}    color="blue"    />
        <MetricCard label="Skill Links"  value={metrics?.total_skill_relationships} color="emerald" />
        <MetricCard label="Education"    value={metrics?.total_role_education}      color="violet"  />
        <MetricCard label="Salary Recs"  value={metrics?.total_salary_records}      color="violet"  />
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 rounded-xl bg-surface-100 p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Dataset panels */}
      {activeTab !== 'tools' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sectionDatasets.map(ds => (
            <DatasetImportPanel key={ds.type} config={ds} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <GraphValidatorPanel />
          <ImportLogsPanel />
        </div>
      )}
    </div>
  );
}