'use client';

/**
 * app/(dashboard)/skill-graph/page.tsx
 * Route: /skill-graph
 *
 * Skill Graph Insights — Job Seeker path
 *
 * Displays:
 *   - User's existing skills (from CV)
 *   - Adjacent skills (next logical step)
 *   - Missing high-demand skills
 *   - Role gap analysis if target role is set
 *   - Learning path recommendations
 */

import { useSkillGraph, useSkillGap } from '@/hooks/useSkillGraph';
import { cn } from '@/utils/cn';
import Link from 'next/link';

// ─── Skill pill ───────────────────────────────────────────────────────────────

function SkillPill({
  name,
  variant = 'default',
}: {
  name: string;
  variant?: 'default' | 'adjacent' | 'missing' | 'role';
}) {
  const styles = {
    default:  'bg-blue-50 text-blue-700 border border-blue-100',
    adjacent: 'bg-violet-50 text-violet-700 border border-violet-100',
    missing:  'bg-rose-50 text-rose-700 border border-rose-100',
    role:     'bg-amber-50 text-amber-700 border border-amber-100',
  };
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
      styles[variant]
    )}>
      {name}
    </span>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  icon,
  accentColor,
  children,
  count,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white shadow-sm overflow-hidden">
      <div className={cn('h-1 w-full', accentColor)} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-50">
              {icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-900">{title}</p>
              <p className="text-xs text-surface-400">{subtitle}</p>
            </div>
          </div>
          {count !== undefined && (
            <span className="rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-surface-600">
              {count}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 rounded bg-surface-100" />
      <div className="h-4 w-64 rounded bg-surface-100" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-surface-100 bg-white p-5">
            <div className="h-4 w-32 rounded bg-surface-100 mb-4" />
            <div className="flex flex-wrap gap-2">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-6 w-20 rounded-full bg-surface-100" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Demand bar ───────────────────────────────────────────────────────────────

function DemandBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-red-500' :
    score >= 60 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-surface-100">
        <div
          className={cn('h-1.5 rounded-full transition-all', color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-surface-500 w-6 text-right">{score}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkillGraphPage() {
  const { data: graph, isLoading: graphLoading, isError: graphError } = useSkillGraph();
  const { data: gap,   isLoading: gapLoading,   isError: gapError   } = useSkillGap();

  const isLoading = graphLoading || gapLoading;

  if (isLoading) return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageSkeleton />
    </div>
  );

  if (graphError || gapError) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-700">Failed to load skill graph</p>
        <p className="mt-1 text-xs text-red-500">Check your connection and try refreshing.</p>
      </div>
    </div>
  );

  // No skills yet
  if (!graph?.existing_skills?.length) return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="rounded-2xl border-2 border-dashed border-surface-200 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-100">
          <svg className="h-7 w-7 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-surface-700">No skill data yet</p>
        <p className="mt-1.5 text-xs text-surface-400 max-w-xs mx-auto">
          {graph?.message || 'Complete your career onboarding and upload your CV to see your personalised skill graph.'}
        </p>
        <Link href="/onboarding"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-hr-600 px-4 py-2 text-sm font-semibold text-white hover:bg-hr-700 transition-colors">
          Start Onboarding
        </Link>
      </div>
    </div>
  );

  const matchPct = gap?.role_gap?.match_percentage ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-surface-900">Skill Graph Insights</h1>
        <p className="mt-1 text-sm text-surface-500">
          {graph.target_role
            ? `Personalised for your path to ${graph.target_role}`
            : 'Your personalised skill intelligence'
          }
          {graph.industry && ` · ${graph.industry}`}
        </p>
      </div>

      {/* Role gap progress banner */}
      {gap?.role_gap && (
        <div className="rounded-xl border border-surface-100 bg-white p-4 flex items-center gap-4 shadow-sm">
          <div className="relative flex-shrink-0">
            <svg className="-rotate-90 h-16 w-16" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#f1f5f9" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none"
                stroke={matchPct >= 70 ? '#22c55e' : matchPct >= 40 ? '#f59e0b' : '#f87171'}
                strokeWidth="4"
                strokeDasharray={`${(matchPct / 100) * 113} 113`}
                strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-surface-900">
              {matchPct}%
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900">
              {matchPct}% match for <span className="text-hr-600">{gap.role_gap.target_role}</span>
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              {gap.role_gap.missing_required.length > 0
                ? `${gap.role_gap.missing_required.length} required skills to acquire`
                : 'You meet all requirements for this role'}
            </p>
          </div>
        </div>
      )}

      {/* 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Existing skills */}
        <SectionCard
          title="Your Skills"
          subtitle="Extracted from your CV"
          count={graph.existing_skills.length}
          accentColor="bg-blue-500"
          icon={
            <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {graph.existing_skills.map(s => (
              <SkillPill key={s} name={s} variant="default" />
            ))}
          </div>
        </SectionCard>

        {/* Adjacent skills */}
        <SectionCard
          title="Adjacent Skills"
          subtitle="Natural next steps from your current skills"
          count={graph.adjacent_skills.length}
          accentColor="bg-violet-500"
          icon={
            <svg className="h-4 w-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          }
        >
          {graph.adjacent_skills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {graph.adjacent_skills.map(s => (
                <SkillPill key={s} name={s} variant="adjacent" />
              ))}
            </div>
          ) : (
            <p className="text-xs text-surface-400 italic">No adjacent skills found — add more skills to expand the graph.</p>
          )}
        </SectionCard>

        {/* Missing high-demand skills */}
        <SectionCard
          title="Missing High-Demand Skills"
          subtitle="Skills with strong market demand you don't have"
          count={gap?.missing_high_demand?.length ?? 0}
          accentColor="bg-rose-500"
          icon={
            <svg className="h-4 w-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        >
          {gap?.missing_high_demand && gap.missing_high_demand.length > 0 ? (
            <div className="space-y-2">
              {gap.missing_high_demand.slice(0, 8).map(skill => (
                <div key={skill.name} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-surface-700 w-28 shrink-0 truncate">
                    {skill.name}
                  </span>
                  <DemandBar score={skill.demand_score} />
                  {skill.category && (
                    <span className="text-[10px] text-surface-400 shrink-0 hidden sm:block">
                      {skill.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-surface-400 italic">You have all the high-demand skills for your industry.</p>
          )}
        </SectionCard>

        {/* Role-specific or next-level skills */}
        <SectionCard
          title={graph.role_specific_skills.length > 0 ? 'Role-Specific Skills' : 'Next Level Skills'}
          subtitle={
            graph.role_specific_skills.length > 0
              ? `Required for ${graph.target_role ?? 'your target role'}`
              : 'Skills to advance beyond your current level'
          }
          count={(graph.role_specific_skills.length || graph.next_level_skills.length)}
          accentColor="bg-amber-500"
          icon={
            <svg className="h-4 w-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }
        >
          {(() => {
            const skills = graph.role_specific_skills.length > 0
              ? graph.role_specific_skills
              : graph.next_level_skills;
            return skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.map(s => <SkillPill key={s} name={s} variant="role" />)}
              </div>
            ) : (
              <p className="text-xs text-surface-400 italic">Set a target role to see role-specific recommendations.</p>
            );
          })()}
        </SectionCard>
      </div>

      {/* Learning paths */}
      {gap?.learning_paths && gap.learning_paths.length > 0 && (
        <div className="rounded-xl border border-surface-100 bg-white shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="h-4 w-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <p className="text-sm font-semibold text-surface-900">Recommended Learning Paths</p>
          </div>
          <div className="space-y-3">
            {gap.learning_paths.map((lp, i) => (
              <div key={i} className="rounded-lg border border-surface-100 bg-surface-50 p-3">
                <p className="text-xs font-semibold text-surface-800 mb-1">
                  Learn: <span className="text-hr-600">{lp.skill}</span>
                </p>
                <p className="text-[11px] text-surface-500">
                  Follow the structured learning path to acquire this high-demand skill.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}