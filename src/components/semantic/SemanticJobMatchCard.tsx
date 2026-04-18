'use client';

/**
 * SemanticJobMatchCard.tsx
 *
 * UPGRADE 2 dashboard component — Semantic Job Match panel.
 *
 * Shows the semantically matched job list with:
 *   - Final weighted match score (ring)
 *   - Semantic vs keyword breakdown
 *   - Missing skills
 *   - Scoring weight legend
 *
 * Integrates into /job-matches page alongside existing JobMatch cards.
 *
 * Usage:
 *   import { SemanticJobMatchPanel } from '@/components/semantic/SemanticJobMatchCard';
 *   <SemanticJobMatchPanel />
 */

import { useState } from 'react';
import { useSemanticJobMatches } from '@/hooks/useSemanticSkills';
import type { SemanticJobMatch } from '@/hooks/useSemanticSkills';
import { cn } from '@/utils/cn';

// ─── Score ring (reuses existing pattern from job-matches/page.tsx) ───────────

function ScoreRing({ score }: { score: number }) {
  const r    = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 75 ? '#8b5cf6' :   // violet — semantic match
    score >= 50 ? '#f59e0b' :
    score >= 35 ? '#3b82f6' : '#f87171';

  return (
    <div className="relative flex-shrink-0 flex items-center justify-center h-14 w-14">
      <svg className="-rotate-90 h-14 w-14 absolute" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <span className="relative text-sm font-bold text-surface-900">{score}</span>
    </div>
  );
}

// ─── Breakdown bar ────────────────────────────────────────────────────────────

function BreakdownRow({
  label, score, weight, highlight,
}: {
  label: string; score: number; weight: string; highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn('w-24 shrink-0', highlight ? 'text-violet-700 font-semibold' : 'text-surface-500')}>
        {label} <span className="text-surface-400">({weight})</span>
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full', highlight ? 'bg-violet-500' : 'bg-blue-400')}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="w-8 text-right font-medium text-surface-700">{score}</span>
    </div>
  );
}

// ─── Single job card ──────────────────────────────────────────────────────────

function SemanticJobCard({ job }: { job: SemanticJobMatch }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-surface-100 bg-white shadow-sm p-4 hover:border-violet-200 transition-colors">
      <div className="flex items-start gap-3">
        <ScoreRing score={job.match_score} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-surface-900 truncate">{job.title}</h4>
              {job.company && (
                <p className="text-xs text-surface-500">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 uppercase tracking-wide whitespace-nowrap">
              {job.semantic_score}% semantic
            </span>
          </div>

          {/* Missing skills */}
          {job.missing_skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {job.missing_skills.slice(0, 4).map(s => (
                <span key={s} className="rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-600">
                  {s}
                </span>
              ))}
              {job.missing_skills.length > 4 && (
                <span className="text-[10px] text-surface-400 self-center">
                  +{job.missing_skills.length - 4} more
                </span>
              )}
            </div>
          )}

          {/* Breakdown toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 text-[11px] text-violet-600 hover:underline"
          >
            {expanded ? 'Hide breakdown' : 'Show score breakdown'}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5 p-2 rounded-lg bg-surface-50">
              <BreakdownRow label="Semantic"   score={job.breakdown.semantic}   weight="60%" highlight />
              <BreakdownRow label="Experience" score={job.breakdown.experience} weight="20%" />
              <BreakdownRow label="Industry"   score={job.breakdown.industry}   weight="10%" />
              <BreakdownRow label="Location"   score={job.breakdown.location}   weight="10%" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface SemanticJobMatchPanelProps {
  limit?:    number;
  minScore?: number;
  className?: string;
}

export function SemanticJobMatchPanel({
  limit    = 10,
  minScore = 30,
  className,
}: SemanticJobMatchPanelProps) {
  const { data, isLoading, isError } = useSemanticJobMatches(limit, minScore);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
            <svg className="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-900">Semantic Job Matches</h3>
            <p className="text-[10px] text-surface-400 uppercase tracking-wide">AI-Powered · Vector Similarity</p>
          </div>
        </div>
        {data && (
          <span className="text-xs text-surface-400">
            {data.recommended_jobs.length} of {data.total_evaluated} roles
          </span>
        )}
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-surface-100 bg-surface-50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
          Unable to load semantic matches. Try refreshing.
        </div>
      )}

      {/* Results */}
      {data && data.recommended_jobs.length === 0 && (
        <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 p-6 text-center">
          <p className="text-sm text-surface-500">No semantic matches found yet.</p>
          <p className="text-xs text-surface-400 mt-1">Add more skills to your profile to improve matching.</p>
        </div>
      )}

      {data && data.recommended_jobs.length > 0 && (
        <div className="space-y-2">
          {data.recommended_jobs.map(job => (
            <SemanticJobCard key={job.job_id} job={job} />
          ))}
        </div>
      )}

      {/* Scoring legend */}
      {data && (
        <div className="rounded-xl border border-surface-100 bg-surface-50 p-3">
          <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wide mb-2">Scoring Formula</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(data.scoring_weights).map(([key, w]) => (
              <span key={key} className={cn(
                'text-[11px]',
                key === 'semantic' ? 'text-violet-700 font-semibold' : 'text-surface-500'
              )}>
                {key.charAt(0).toUpperCase() + key.slice(1)} {Math.round(w * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}