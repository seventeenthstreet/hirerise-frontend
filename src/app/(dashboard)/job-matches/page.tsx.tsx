'use client';

/**
 * app/(dashboard)/job-matches/page.tsx
 * Route: /job-matches
 *
 * Job Matches — Job Seeker path
 *
 * Displays top matched roles from the platform database with:
 *   - Match score (composite 0–100)
 *   - Score breakdown (skill / experience / industry / role similarity)
 *   - Missing skills per role
 *   - Salary range
 */

import { useState } from 'react';
import { useJobMatches } from '@/hooks/useJobMatches';
import type { JobMatch } from '@/hooks/useJobMatches';
import { cn } from '@/utils/cn';
import Link from 'next/link';
import { JobMatchChecker } from '@/components/JobMatchCard';
import { AutoApplyButton } from '@/components/AutoApply';
import { useResumes } from '@/hooks/useResumes';

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r    = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color =
    score >= 75 ? '#22c55e' :
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

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreLabel({ score }: { score: number }) {
  const { label, cls } =
    score >= 75 ? { label: 'Strong match',   cls: 'bg-green-100 text-green-700'  } :
    score >= 50 ? { label: 'Good match',      cls: 'bg-amber-100 text-amber-700'  } :
    score >= 35 ? { label: 'Moderate match',  cls: 'bg-blue-100 text-blue-700'    } :
                  { label: 'Weak match',      cls: 'bg-surface-100 text-surface-500' };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', cls)}>
      {label}
    </span>
  );
}

// ─── Score breakdown bar ──────────────────────────────────────────────────────

function BreakdownBar({
  label, score, weight, color,
}: {
  label: string; score: number; weight: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-surface-500 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-100">
        <div className={cn('h-1.5 rounded-full', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="w-6 text-right font-mono text-surface-600 shrink-0">{score}</span>
      <span className="w-6 text-[10px] text-surface-400 shrink-0">{weight}</span>
    </div>
  );
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, rank, resumeContent }: { job: JobMatch; rank: number; resumeContent: any }) {
  const [expanded, setExpanded] = useState(false);

  const salaryText = job.salary?.min != null && job.salary?.max != null
    ? `₹${job.salary.min}–${job.salary.max} LPA`
    : null;

  return (
    <div className={cn(
      'rounded-xl border bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md',
      rank === 1 ? 'border-green-200' : 'border-surface-100'
    )}>
      {rank === 1 && (
        <div className="h-1 w-full bg-gradient-to-r from-green-400 to-emerald-500" />
      )}

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5',
            rank === 1 ? 'bg-amber-100 text-amber-700' :
            rank === 2 ? 'bg-surface-100 text-surface-600' :
            rank === 3 ? 'bg-orange-50 text-orange-600' :
                         'bg-surface-50 text-surface-400'
          )}>
            {rank}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-surface-900 truncate">{job.title}</p>
                {job.sector && (
                  <p className="text-xs text-surface-400 mt-0.5">{job.sector}</p>
                )}
              </div>
              <ScoreRing score={job.match_score} />
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <ScoreLabel score={job.match_score} />
              {salaryText && (
                <span className="text-[10px] text-surface-500 font-mono">{salaryText}</span>
              )}
            </div>

            {/* Missing skills */}
            {job.missing_skills.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-400 mb-1.5">
                  Missing skills
                </p>
                <div className="flex flex-wrap gap-1">
                  {job.missing_skills.map(s => (
                    <span key={s}
                      className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 border border-rose-100">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTA — context-sensitive */}
            <div className="mt-3">
              {job.match_score >= 75 ? (
                <Link href={`/job-matches?role=${encodeURIComponent(job.title)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 transition-colors">
                  🚀 Apply Now
                </Link>
              ) : job.match_score >= 45 ? (
                <Link href={`/resume-builder?source=job-match&role=${encodeURIComponent(job.title)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-hr-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-hr-700 transition-colors">
                  🎯 Improve Match
                </Link>
              ) : (
                <Link href={`/resume-builder?source=job-match&role=${encodeURIComponent(job.title)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition-colors">
                  ⚡ Fix Resume
                </Link>
              )}
              <AutoApplyButton
                job={{ title: job.title, description: job.description ?? undefined }}
                resumeData={resumeContent}
                size="sm"
              />
            </div>

            {/* Expand button */}
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-3 text-[11px] font-medium text-hr-600 hover:text-hr-700 flex items-center gap-1"
            >
              {expanded ? 'Hide' : 'Show'} score breakdown
              <svg className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Breakdown */}
            {expanded && (
              <div className="mt-3 space-y-2 rounded-lg bg-surface-50 p-3">
                <BreakdownBar label="Skill match"   score={job.skill_score}      weight="40%" color="bg-blue-500" />
                <BreakdownBar label="Experience"    score={job.experience_score} weight="30%" color="bg-violet-500" />
                <BreakdownBar label="Industry fit"  score={job.industry_score}   weight="20%" color="bg-amber-500" />
                <BreakdownBar label="Role similar." score={job.role_score}       weight="10%" color="bg-green-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-100 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-surface-100 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-surface-100" />
              <div className="h-3 w-24 rounded bg-surface-100" />
            </div>
            <div className="h-14 w-14 rounded-full bg-surface-100 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobMatchesPage() {
  const [limit,       setLimit]       = useState(10);
  const [minScore,    setMinScore]    = useState(30);
  const [showChecker, setShowChecker] = useState(false);

  const { data, isLoading, isError } = useJobMatches(limit, minScore);
  const { data: resumesData } = useResumes();
  const resumeContent = (resumesData as any)?.items?.[0]?.content ?? null;

  if (isLoading) return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="h-6 w-36 rounded bg-surface-100 animate-pulse mb-6" />
      <PageSkeleton />
    </div>
  );

  if (isError) return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-700">Failed to load job matches</p>
        <p className="mt-1 text-xs text-red-500">Check your connection and try refreshing.</p>
      </div>
    </div>
  );

  const jobs = data?.recommended_jobs ?? [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Job Matches</h1>
          <p className="mt-1 text-sm text-surface-500">
            {data?.total_roles_evaluated
              ? `Scored ${data.total_roles_evaluated} roles from the platform database`
              : 'Personalised role recommendations based on your profile'
            }
            {data?.user_skills_count ? ` · ${data.user_skills_count} skills matched` : ''}
          </p>
        </div>

        {/* Filters + Check a Job */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowChecker(v => !v)}
            className="rounded-lg bg-hr-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-hr-700 transition-colors"
          >
            🎯 Check a Job
          </button>
          <select
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            className="rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs font-medium text-surface-700 focus:outline-none focus:ring-2 focus:ring-hr-500"
          >
            <option value={20}>Min 20%</option>
            <option value={30}>Min 30%</option>
            <option value={50}>Min 50%</option>
            <option value={70}>Min 70%</option>
          </select>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs font-medium text-surface-700 focus:outline-none focus:ring-2 focus:ring-hr-500"
          >
            <option value={5}>Top 5</option>
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
          </select>
        </div>
      </div>

      {/* Job Match Checker panel */}
      {showChecker && (
        <div className="rounded-2xl border border-surface-200 overflow-hidden shadow-sm">
          <JobMatchChecker resumeData={resumeContent} />
        </div>
      )}

      {/* No data state */}
      {jobs.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-surface-200 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100">
            <svg className="h-7 w-7 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-surface-700">No matches found</p>
          <p className="mt-1.5 text-xs text-surface-400 max-w-xs mx-auto">
            {data?.message || 'Try lowering the minimum score filter, or complete your onboarding to improve matches.'}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => setMinScore(20)}
              className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50 transition-colors"
            >
              Lower threshold
            </button>
            <Link href="/onboarding"
              className="rounded-lg bg-hr-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-hr-700 transition-colors">
              Complete onboarding
            </Link>
          </div>
        </div>
      )}

      {/* Job list */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <JobCard key={job.id} job={job} rank={i + 1} resumeContent={resumeContent} />
          ))}
        </div>
      )}

      {/* Tip */}
      {jobs.length > 0 && (
        <p className="text-center text-[11px] text-surface-400 pb-2">
          Match score = 40% skill overlap + 30% experience + 20% industry + 10% role similarity.
          Add missing skills via <Link href="/skill-graph" className="underline text-hr-600">Skill Graph</Link>.
        </p>
      )}

    </div>
  );
}