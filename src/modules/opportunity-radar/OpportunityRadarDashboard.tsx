'use client';

/**
 * OpportunityRadarDashboard.tsx
 *
 * AI Career Opportunity Radar — main dashboard module.
 *
 * Displays:
 *   - Top personalised emerging career opportunities
 *   - Opportunity score + match score per role
 *   - Growth trend indicator
 *   - Salary potential
 *   - Skills the user already has vs skills to learn
 *   - Score breakdown breakdown (expandable)
 *
 * Usage — new page at /opportunity-radar:
 *   import { OpportunityRadarDashboard } from '@/modules/opportunity-radar/OpportunityRadarDashboard';
 *   export default function Page() { return <OpportunityRadarDashboard />; }
 *
 * Or embed in /dashboard:
 *   import { OpportunityRadarPanel } from '@/modules/opportunity-radar/OpportunityRadarDashboard';
 *   <OpportunityRadarPanel limit={3} />
 */

import { useState } from 'react';
import { useOpportunityRadar, useEmergingRoles } from '@/hooks/useOpportunityRadar';
import type { EmergingOpportunity, EmergingRole } from '@/hooks/useOpportunityRadar';
import { cn } from '@/utils/cn';

// ─── Trend badge ──────────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: string }) {
  const styles: Record<string, string> = {
    'Very High': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'High':      'bg-teal-100    text-teal-700    border-teal-200',
    'Moderate':  'bg-amber-100   text-amber-700   border-amber-200',
    'Emerging':  'bg-violet-100  text-violet-700  border-violet-200',
    'Stable':    'bg-slate-100   text-slate-600   border-slate-200',
  };
  const arrows: Record<string, string> = {
    'Very High': '↑↑', 'High': '↑', 'Moderate': '→', 'Emerging': '✦', 'Stable': '—',
  };
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
      styles[trend] || styles['Stable']
    )}>
      {arrows[trend] || '→'} {trend}
    </span>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({
  score, size = 56, label, color,
}: {
  score: number; size?: number; label: string; color: string;
}) {
  const r    = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="-rotate-90" width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
        </svg>
        <span className="absolute text-sm font-bold text-surface-900">{score}</span>
      </div>
      <span className="text-[9px] font-semibold text-surface-400 uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ─── Skill pill ───────────────────────────────────────────────────────────────

function SkillPill({ name, variant }: { name: string; variant: 'have' | 'learn' }) {
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[10px] font-medium border',
      variant === 'have'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-amber-50   text-amber-700   border-amber-200'
    )}>
      {variant === 'have' ? '✓ ' : '+ '}{name}
    </span>
  );
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

function ScoreBreakdownPanel({ breakdown }: { breakdown: EmergingOpportunity['score_breakdown'] }) {
  const rows = [
    { label: 'Job Growth',      value: breakdown.job_growth,      weight: '35%', color: 'bg-violet-400' },
    { label: 'Salary Growth',   value: breakdown.salary_growth,   weight: '25%', color: 'bg-indigo-400' },
    { label: 'Skill Demand',    value: breakdown.skill_demand,    weight: '25%', color: 'bg-blue-400'   },
    { label: 'Industry Growth', value: breakdown.industry_growth, weight: '15%', color: 'bg-teal-400'   },
  ];

  return (
    <div className="mt-3 rounded-xl bg-surface-50 p-3 space-y-2">
      <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wide">Opportunity Score Breakdown</p>
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-28 text-surface-500 shrink-0">{r.label} <span className="text-surface-400">({r.weight})</span></span>
          <div className="flex-1 h-1.5 rounded-full bg-surface-200 overflow-hidden">
            <div className={cn('h-full rounded-full', r.color)} style={{ width: `${r.value}%` }} />
          </div>
          <span className="w-6 text-right font-semibold text-surface-700">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Opportunity Card ─────────────────────────────────────────────────────────

function OpportunityCard({ opp }: { opp: EmergingOpportunity }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-surface-100 bg-white shadow-sm overflow-hidden hover:border-violet-200 transition-colors">
      {/* Top accent gradient */}
      <div className={cn(
        'h-1',
        opp.opportunity_score >= 85 ? 'bg-gradient-to-r from-violet-500 to-indigo-500' :
        opp.opportunity_score >= 70 ? 'bg-gradient-to-r from-teal-500  to-emerald-500' :
                                      'bg-gradient-to-r from-amber-400  to-orange-400'
      )} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-surface-900">{opp.role}</h3>
              {opp.is_emerging && (
                <span className="rounded-full bg-violet-100 border border-violet-200 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 uppercase tracking-wide">
                  New
                </span>
              )}
            </div>
            <p className="text-[11px] text-surface-400 mt-0.5">{opp.industry}</p>
          </div>

          {/* Score rings */}
          <div className="flex items-center gap-3 shrink-0">
            <ScoreRing score={opp.opportunity_score} label="Opportunity" color="#7c3aed" />
            <ScoreRing score={opp.match_score}       label="Match"       color="#0d9488" />
          </div>
        </div>

        {/* Salary + trend */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-bold text-emerald-700">{opp.average_salary}</span>
          <span className="text-surface-300">·</span>
          <TrendBadge trend={opp.growth_trend} />
        </div>

        {/* Skills section */}
        <div className="space-y-2">
          {opp.skills_you_have.length > 0 && (
            <div>
              <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wide mb-1">
                Skills You Have
              </p>
              <div className="flex flex-wrap gap-1">
                {opp.skills_you_have.slice(0, 4).map(s => (
                  <SkillPill key={s} name={s} variant="have" />
                ))}
              </div>
            </div>
          )}

          {opp.skills_to_learn.length > 0 && (
            <div>
              <p className="text-[10px] text-surface-400 font-semibold uppercase tracking-wide mb-1">
                Skills to Learn
              </p>
              <div className="flex flex-wrap gap-1">
                {opp.skills_to_learn.slice(0, 4).map(s => (
                  <SkillPill key={s} name={s} variant="learn" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Expand breakdown */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 text-[11px] text-violet-600 hover:underline font-medium"
        >
          {expanded ? 'Hide score breakdown ↑' : 'View score breakdown ↓'}
        </button>

        {expanded && <ScoreBreakdownPanel breakdown={opp.score_breakdown} />}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RadarSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-100 bg-white p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-40 rounded bg-surface-100 animate-pulse" />
              <div className="h-3 w-24 rounded bg-surface-100 animate-pulse" />
              <div className="h-3 w-32 rounded bg-surface-100 animate-pulse" />
            </div>
            <div className="flex gap-3">
              <div className="h-14 w-14 rounded-full bg-surface-100 animate-pulse" />
              <div className="h-14 w-14 rounded-full bg-surface-100 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatBar({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-surface-100 bg-white px-4 py-3">
      <span className="text-lg font-bold text-violet-700">{value}</span>
      <span className="text-[10px] text-surface-400 uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface OpportunityRadarDashboardProps {
  className?: string;
}

export function OpportunityRadarDashboard({ className }: OpportunityRadarDashboardProps) {
  const [activeTab, setActiveTab] = useState<'personalised' | 'explore'>('personalised');

  const { data: personalised, isLoading: loadingPersonal, isError: errPersonal } =
    useOpportunityRadar(10, 40);

  const { data: emerging, isLoading: loadingEmerging, isError: errEmerging } =
    useEmergingRoles({ limit: 20, emergingOnly: true, minScore: 60 });

  const opportunities = personalised?.emerging_opportunities || [];
  const roles         = emerging?.roles || [];

  return (
    <div className={cn('space-y-5', className)}>
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
              {/* Radar icon */}
              <svg className="h-5 w-5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900">Career Opportunity Radar</h1>
              <p className="text-xs text-surface-400">AI-detected emerging & high-growth roles</p>
            </div>
          </div>
        </div>

        {personalised && (
          <span className="text-[11px] text-surface-400">
            {personalised.total_signals_evaluated} roles analysed
          </span>
        )}
      </div>

      {/* Stats bar */}
      {personalised && !loadingPersonal && (
        <div className="grid grid-cols-3 gap-3">
          <StatBar label="Opportunities Found" value={opportunities.length} />
          <StatBar label="Your Skills"         value={personalised.user_skills_count} />
          <StatBar label="Market Signals"      value={personalised.total_signals_evaluated || '—'} />
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex gap-1 rounded-xl border border-surface-100 bg-surface-50 p-1 w-fit">
        {(['personalised', 'explore'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-xs font-semibold transition-all',
              activeTab === tab
                ? 'bg-white shadow-sm text-violet-700'
                : 'text-surface-500 hover:text-surface-700'
            )}
          >
            {tab === 'personalised' ? '✦ For You' : '🔭 Explore All'}
          </button>
        ))}
      </div>

      {/* ── Personalised tab ── */}
      {activeTab === 'personalised' && (
        <>
          {loadingPersonal && <RadarSkeleton />}

          {errPersonal && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
              Unable to load your opportunity radar. Try refreshing the page.
            </div>
          )}

          {personalised?.message && opportunities.length === 0 && (
            <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 p-6 text-center">
              <p className="text-sm text-surface-500">{personalised.message}</p>
            </div>
          )}

          {opportunities.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-surface-500">
                Ranked by opportunity score weighted with your skill match
              </p>
              {opportunities.map(opp => (
                <OpportunityCard key={`${opp.role}-${opp.industry}`} opp={opp} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Explore tab ── */}
      {activeTab === 'explore' && (
        <>
          {loadingEmerging && <RadarSkeleton />}

          {errEmerging && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
              Unable to load emerging roles.
            </div>
          )}

          {roles.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {roles.map(role => (
                <ExploreRoleCard key={`${role.role}-${role.industry}`} role={role} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── ExploreRoleCard (non-personalised) ──────────────────────────────────────

function ExploreRoleCard({ role }: { role: EmergingRole }) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white shadow-sm p-4 hover:border-violet-200 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-surface-900">{role.role}</h4>
            {role.is_emerging && (
              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">NEW</span>
            )}
          </div>
          <p className="text-[11px] text-surface-400">{role.industry}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-violet-700">{role.opportunity_score}</p>
          <p className="text-[9px] text-surface-400 uppercase">Opp. Score</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-emerald-700">{role.average_salary}</span>
        <TrendBadge trend={role.growth_trend} />
      </div>

      <div className="flex flex-wrap gap-1">
        {(Array.isArray(role.required_skills) ? role.required_skills : []).slice(0, 4).map((s: string) => (
          <span key={s} className="rounded-full bg-surface-50 border border-surface-200 px-2 py-0.5 text-[10px] text-surface-600">
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Compact panel for /dashboard embed ──────────────────────────────────────

interface OpportunityRadarPanelProps {
  limit?:    number;
  className?: string;
}

/**
 * Compact version for embedding in the main /dashboard page.
 * Shows top 3 opportunities with a link to the full radar page.
 */
export function OpportunityRadarPanel({ limit = 3, className }: OpportunityRadarPanelProps) {
  const { data, isLoading, isError } = useOpportunityRadar(limit, 50);
  const opportunities = data?.emerging_opportunities || [];

  return (
    <div className={cn('rounded-2xl border border-surface-100 bg-white shadow-sm overflow-hidden', className)}>
      <div className="h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-teal-500" />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
              <svg className="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-900">Opportunity Radar</p>
              <p className="text-[10px] text-surface-400 uppercase tracking-wide">Top Emerging Roles For You</p>
            </div>
          </div>
          <a href="/opportunity-radar" className="text-[11px] text-violet-600 hover:underline font-medium">
            View all →
          </a>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-surface-50 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm text-rose-500 text-center py-3">Could not load opportunities</p>
        )}

        {opportunities.length > 0 && (
          <div className="space-y-2">
            {opportunities.map(opp => (
              <div
                key={`${opp.role}-${opp.industry}`}
                className="flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50 px-3 py-2.5 hover:border-violet-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-surface-900 truncate">{opp.role}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <TrendBadge trend={opp.growth_trend} />
                    <span className="text-[11px] text-emerald-700 font-semibold">{opp.average_salary}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  <div className="text-center">
                    <p className="text-base font-bold text-violet-700">{opp.opportunity_score}</p>
                    <p className="text-[9px] text-surface-400">Opp.</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-teal-600">{opp.match_score}</p>
                    <p className="text-[9px] text-surface-400">Match</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && opportunities.length === 0 && (
          <p className="text-sm text-surface-400 text-center py-4">
            Complete your profile to see personalised opportunities
          </p>
        )}
      </div>
    </div>
  );
}
