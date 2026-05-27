/**
 * @file front/src/modules/student-onboarding/intelligence/components/SignalDiagnosticsPanel.tsx
 *
 * Phase 3D — Cross-Domain Intelligence Layer
 * SIGNAL DIAGNOSTICS PANEL
 *
 * PURPOSE:
 *   Internal admin/engineering diagnostic view for a student's signal vector.
 *   Shows signal weights, domain vectors, evidence summaries,
 *   confidence placeholders, and detected contradictions.
 *
 * SCOPE:
 *   Admin-only. Never render in student-facing routes.
 *   Gated by admin role check in the parent page.
 *
 * DESIGN:
 *   No external design system dependencies beyond Tailwind.
 *   Plain tabular layout — optimized for debuggability, not visual polish.
 *   Follows HireRise frontend-design token conventions.
 */

import React, { useState } from 'react';
import {
  useStudentVector,
  useStudentConfidence,
  useSignalEvidence,
  useTriggerPipeline,
} from '../hooks/use-intelligence';
import type {
  StudentSignalVector,
  SignalConfidenceModel,
  SignalEvidenceRecord,
  ContradictionEntry,
  IntelligenceDomain,
  SignalKey,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface SignalDiagnosticsPanelProps {
  /** Supabase Auth UID of the student being inspected. */
  readonly userId: string;
  /** Display name or email for the student — used in headings only. */
  readonly studentLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function SignalDiagnosticsPanel({
  userId,
  studentLabel = 'Student',
}: SignalDiagnosticsPanelProps) {
  const [activeTab,       setActiveTab]       = useState<'vector' | 'confidence' | 'evidence' | 'contradictions'>('vector');
  const [selectedSignal,  setSelectedSignal]  = useState<SignalKey | null>(null);
  const [isDryRun,        setIsDryRun]        = useState(true);

  const { data: vector,     isLoading: vectorLoading,     error: vectorError }     = useStudentVector(userId);
  const { data: confidence, isLoading: confLoading }                              = useStudentConfidence(userId);
  const { data: evidence,   isLoading: evidenceLoading }                          = useSignalEvidence(userId, selectedSignal);
  const { mutate: trigger,  isPending:  triggerPending, data: triggerResult }     = useTriggerPipeline(userId);

  return (
    <div className="bg-neutral-950 text-neutral-100 rounded-lg border border-neutral-800 p-6 font-mono text-sm">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-100">
            Signal Diagnostics
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {studentLabel} · {userId}
          </p>
        </div>

        {/* Pipeline trigger */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              className="accent-amber-500"
            />
            Dry run
          </label>
          <button
            onClick={() => trigger({ dry_run: isDryRun })}
            disabled={triggerPending}
            className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {triggerPending ? 'Running…' : 'Run Pipeline'}
          </button>
        </div>
      </div>

      {/* ── Pipeline result banner ─────────────────────────────────────────── */}
      {triggerResult && (
        <div className="mb-4 p-3 rounded border border-emerald-700 bg-emerald-950 text-emerald-300 text-xs">
          <span className="font-semibold">Pipeline complete</span>
          {' · '}run: {triggerResult.pipeline_run_id}
          {' · '}signals: {triggerResult.signal_count}
          {' · '}evidence inserted: {triggerResult.evidence_inserted}
          {' · '}complete vector: {triggerResult.is_complete ? 'yes' : 'no'}
          {triggerResult.dry_run && (
            <span className="ml-2 text-amber-400 font-semibold">[DRY RUN — not persisted]</span>
          )}
        </div>
      )}

      {/* ── Vector missing notice ──────────────────────────────────────────── */}
      {!vectorLoading && !vectorError && !vector && (
        <div className="mb-4 p-3 rounded border border-neutral-700 bg-neutral-900 text-neutral-400 text-xs">
          No signal vector found. Run the pipeline above to compute one.
        </div>
      )}

      {vectorError && (
        <div className="mb-4 p-3 rounded border border-red-800 bg-red-950 text-red-400 text-xs">
          Failed to load vector. Check admin permissions.
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      {vector && (
        <>
          <div className="flex gap-1 mb-4 border-b border-neutral-800 pb-2">
            {(['vector', 'confidence', 'evidence', 'contradictions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-t text-xs transition-colors ${
                  activeTab === tab
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'contradictions' && Object.keys(vector.contradictionMetadata).length > 0 && (
                  <span className="ml-1 px-1 rounded bg-amber-600 text-white text-xs">
                    {Object.keys(vector.contradictionMetadata).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Vector tab ────────────────────────────────────────────────── */}
          {activeTab === 'vector' && (
            <VectorTab vector={vector} onSelectSignal={setSelectedSignal} />
          )}

          {/* ── Confidence tab ────────────────────────────────────────────── */}
          {activeTab === 'confidence' && (
            <ConfidenceTab models={confidence ?? []} isLoading={confLoading} />
          )}

          {/* ── Evidence tab ──────────────────────────────────────────────── */}
          {activeTab === 'evidence' && (
            <EvidenceTab
              evidence={evidence ?? []}
              isLoading={evidenceLoading}
              selectedSignal={selectedSignal}
              allSignals={Object.keys(vector.signalWeights) as SignalKey[]}
              onSelectSignal={setSelectedSignal}
            />
          )}

          {/* ── Contradictions tab ────────────────────────────────────────── */}
          {activeTab === 'contradictions' && (
            <ContradictionsTab
              contradictions={Object.values(vector.contradictionMetadata)}
            />
          )}

          {/* Vector metadata footer */}
          <div className="mt-4 pt-3 border-t border-neutral-800 text-xs text-neutral-600 flex gap-4">
            <span>version: {vector.aggregationVersion}</span>
            <span>domains: {vector.domainsIncluded.join(', ')}</span>
            <span>complete: {vector.isCompleteVector ? '✓' : '✗'}</span>
            <span>aggregated: {new Date(vector.aggregatedAt).toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── VectorTab ─────────────────────────────────────────────────────────────────

function VectorTab({
  vector,
  onSelectSignal,
}: {
  vector: StudentSignalVector;
  onSelectSignal: (key: SignalKey) => void;
}) {
  const domainColors: Record<IntelligenceDomain | string, string> = {
    academic:     'text-blue-400',
    activity:     'text-emerald-400',
    cognitive:    'text-purple-400',
    cross_domain: 'text-amber-400',
  };

  const sortedSignals = (Object.entries(vector.signalWeights) as [SignalKey, number][])
    .sort(([, a], [, b]) => b - a);

  return (
    <div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-neutral-500 border-b border-neutral-800">
            <th className="text-left py-1 pr-4 font-normal">Signal</th>
            <th className="text-left py-1 pr-4 font-normal">Weight</th>
            <th className="text-left py-1 pr-4 font-normal">Bar</th>
            <th className="text-left py-1 pr-4 font-normal">Domain</th>
            <th className="text-left py-1 font-normal">Evidence</th>
          </tr>
        </thead>
        <tbody>
          {sortedSignals.map(([signalKey, weight]) => {
            const summary    = vector.evidenceSummary[signalKey];
            const primaryDomain = summary?.domains?.[0] ?? 'cross_domain';
            const domainColor   = domainColors[primaryDomain] ?? 'text-neutral-400';

            return (
              <tr
                key={signalKey}
                className="border-b border-neutral-900 hover:bg-neutral-900 cursor-pointer"
                onClick={() => onSelectSignal(signalKey)}
              >
                <td className="py-1.5 pr-4 text-neutral-200">{signalKey}</td>
                <td className="py-1.5 pr-4 text-neutral-300 tabular-nums">
                  {weight.toFixed(3)}
                </td>
                <td className="py-1.5 pr-4 w-24">
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.round(weight * 100)}%` }}
                    />
                  </div>
                </td>
                <td className={`py-1.5 pr-4 ${domainColor}`}>
                  {summary?.domains?.join(', ') ?? '—'}
                </td>
                <td className="py-1.5 text-neutral-500">
                  {summary?.count ?? 0} records
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── ConfidenceTab ─────────────────────────────────────────────────────────────

function ConfidenceTab({
  models,
  isLoading,
}: {
  models: SignalConfidenceModel[];
  isLoading: boolean;
}) {
  if (isLoading) return <p className="text-xs text-neutral-500 py-4">Loading…</p>;

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-neutral-500 border-b border-neutral-800">
          <th className="text-left py-1 pr-4 font-normal">Signal</th>
          <th className="text-left py-1 pr-4 font-normal">Evidence</th>
          <th className="text-left py-1 pr-4 font-normal">Diversity</th>
          <th className="text-left py-1 pr-4 font-normal">Cross-Domain</th>
          <th className="text-left py-1 pr-4 font-normal">Contradiction</th>
          <th className="text-left py-1 font-normal">Confidence</th>
        </tr>
      </thead>
      <tbody>
        {models.map((m) => (
          <tr key={m.signalKey} className="border-b border-neutral-900">
            <td className="py-1.5 pr-4 text-neutral-200">{m.signalKey}</td>
            <td className="py-1.5 pr-4 text-neutral-400 tabular-nums">{m.evidenceCount}</td>
            <td className="py-1.5 pr-4 text-neutral-400 tabular-nums">
              {(m.sourceDiversity * 100).toFixed(0)}%
            </td>
            <td className="py-1.5 pr-4">
              {m.crossDomainReinforcement
                ? <span className="text-emerald-400">✓ yes</span>
                : <span className="text-neutral-600">no</span>
              }
            </td>
            <td className="py-1.5 pr-4">
              <span className={{
                none:     'text-neutral-600',
                weak:     'text-yellow-500',
                moderate: 'text-orange-400',
                strong:   'text-red-400',
              }[m.contradictionSeverity] ?? 'text-neutral-400'}>
                {m.contradictionSeverity}
              </span>
            </td>
            <td className="py-1.5 text-neutral-600 italic">
              null (Phase 3D placeholder)
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── EvidenceTab ───────────────────────────────────────────────────────────────

function EvidenceTab({
  evidence,
  isLoading,
  selectedSignal,
  allSignals,
  onSelectSignal,
}: {
  evidence:       SignalEvidenceRecord[];
  isLoading:      boolean;
  selectedSignal: SignalKey | null;
  allSignals:     SignalKey[];
  onSelectSignal: (key: SignalKey) => void;
}) {
  return (
    <div>
      <div className="mb-3">
        <select
          value={selectedSignal ?? ''}
          onChange={(e) => onSelectSignal(e.target.value as SignalKey)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="">Select a signal…</option>
          {allSignals.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-xs text-neutral-500 py-4">Loading evidence…</p>}

      {!isLoading && selectedSignal && evidence.length === 0 && (
        <p className="text-xs text-neutral-500 py-4">No evidence records for this signal.</p>
      )}

      {!isLoading && evidence.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-neutral-500 border-b border-neutral-800">
              <th className="text-left py-1 pr-4 font-normal">Source</th>
              <th className="text-left py-1 pr-4 font-normal">Domain</th>
              <th className="text-left py-1 pr-4 font-normal">Ref ID</th>
              <th className="text-left py-1 pr-4 font-normal">Weight</th>
              <th className="text-left py-1 font-normal">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((ev) => (
              <tr key={ev.id} className="border-b border-neutral-900">
                <td className="py-1.5 pr-4 text-neutral-400">{ev.sourceType}</td>
                <td className="py-1.5 pr-4 text-neutral-400">{ev.sourceDomain}</td>
                <td className="py-1.5 pr-4 text-neutral-500 max-w-xs truncate">
                  {ev.sourceReferenceId}
                </td>
                <td className="py-1.5 pr-4 text-neutral-300 tabular-nums">
                  {ev.contributionWeight.toFixed(4)}
                </td>
                <td className="py-1.5 text-neutral-600">
                  {new Date(ev.recordedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── ContradictionsTab ─────────────────────────────────────────────────────────

function ContradictionsTab({ contradictions }: { contradictions: ContradictionEntry[] }) {
  if (contradictions.length === 0) {
    return (
      <p className="text-xs text-neutral-500 py-4">
        No contradictions detected in this signal vector.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {contradictions.map((c) => (
        <div
          key={`${c.signalA}__${c.signalB}`}
          className="p-3 rounded border border-neutral-800 bg-neutral-900"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-neutral-200 font-medium">
              {c.signalA} ↔ {c.signalB}
            </span>
            <span className={{
              none:     'text-neutral-600',
              weak:     'text-yellow-400',
              moderate: 'text-orange-400',
              strong:   'text-red-400',
            }[c.severity] ?? 'text-neutral-400'}>
              {c.severity.toUpperCase()}
            </span>
          </div>
          <div className="text-xs text-neutral-500 space-y-0.5">
            <div>Weight A ({c.signalA}): {c.weightA.toFixed(3)}</div>
            <div>Weight B ({c.signalB}): {c.weightB.toFixed(3)}</div>
            <div>Resolved: {c.resolved ? 'yes' : 'no (Phase 3D — detection only)'}</div>
            <div>Detected: {new Date(c.detectedAt).toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
