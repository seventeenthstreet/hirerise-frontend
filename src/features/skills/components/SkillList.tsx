'use client';

// features/skills/components/SkillList.tsx
//
// Renders a responsive grid of skill cards.
// Handles loading skeletons, empty state, and error state internally.

import type { Skill, SkillCategory } from '@/types/skills';
import { cn } from '@/utils/cn';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<SkillCategory, { colour: string; dot: string }> = {
  technical: { colour: 'bg-blue-50 text-blue-700 border-blue-100',   dot: 'bg-blue-400' },
  soft:      { colour: 'bg-violet-50 text-violet-700 border-violet-100', dot: 'bg-violet-400' },
  domain:    { colour: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-400' },
  tool:      { colour: 'bg-rose-50 text-rose-700 border-rose-100',    dot: 'bg-rose-400' },
  language:  { colour: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-400' },
  framework: { colour: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-400' },
};

const DEMAND_LABEL: Array<{ min: number; label: string; colour: string }> = [
  { min: 80, label: 'High demand',   colour: 'text-green-600' },
  { min: 50, label: 'Medium demand', colour: 'text-amber-500' },
  { min:  0, label: 'Low demand',    colour: 'text-surface-400' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: SkillCategory }) {
  const cfg = CATEGORY_CONFIG[category] ?? { colour: 'bg-surface-50 text-surface-600 border-surface-200', dot: 'bg-surface-400' };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', cfg.colour)}>
      <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
      {category}
    </span>
  );
}

function DemandBar({ score }: { score: number }) {
  const { label, colour } = DEMAND_LABEL.find((d) => score >= d.min) ?? DEMAND_LABEL[2];
  const pct = Math.min(100, Math.max(0, score));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={cn('text-[10px] font-semibold', colour)}>{label}</span>
        <span className="text-[10px] font-mono text-surface-400">{score}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-surface-100">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            score >= 80 ? 'bg-green-400' : score >= 50 ? 'bg-amber-400' : 'bg-surface-300',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Skill card ───────────────────────────────────────────────────────────────

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <article className={cn(
      'group flex flex-col rounded-xl border border-surface-100 bg-white p-4 shadow-card',
      'transition-all duration-200 hover:shadow-card-md hover:-translate-y-0.5',
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold leading-snug text-surface-900 group-hover:text-hr-700 transition-colors">
          {skill.name}
        </h3>
        <CategoryBadge category={skill.category} />
      </div>

      {/* Description */}
      {skill.description && (
        <p className="flex-1 text-xs leading-relaxed text-surface-400 line-clamp-2 mb-3">
          {skill.description}
        </p>
      )}

      {/* Aliases */}
      {skill.aliases?.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {skill.aliases.slice(0, 3).map((alias) => (
            <span key={alias} className="rounded-md bg-surface-50 px-1.5 py-0.5 text-[10px] text-surface-400">
              {alias}
            </span>
          ))}
          {skill.aliases.length > 3 && (
            <span className="rounded-md bg-surface-50 px-1.5 py-0.5 text-[10px] text-surface-300">
              +{skill.aliases.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Demand score */}
      {skill.demandScore != null && (
        <div className="mt-auto pt-2 border-t border-surface-50">
          <DemandBar score={skill.demandScore} />
        </div>
      )}
    </article>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkillCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-100 bg-white p-4 shadow-card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-32 animate-skeleton rounded bg-surface-100" />
        <div className="h-4 w-18 animate-skeleton rounded-full bg-surface-100" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full animate-skeleton rounded bg-surface-100" />
        <div className="h-3 w-3/4 animate-skeleton rounded bg-surface-100" />
      </div>
      <div className="h-3 w-full animate-skeleton rounded-full bg-surface-100" />
    </div>
  );
}

// ─── SkillList ────────────────────────────────────────────────────────────────

interface SkillListProps {
  skills:    Skill[];
  isLoading: boolean;
  isError:   boolean;
  skeletons?: number;
}

export function SkillList({ skills, isLoading, isError, skeletons = 12 }: SkillListProps) {
  if (isError) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50 text-center">
        <svg className="mb-2 h-7 w-7 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-sm font-medium text-red-500">Failed to load skills</p>
        <p className="mt-0.5 text-xs text-red-400">Check your connection and try again</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: skeletons }).map((_, i) => (
          <SkillCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-surface-200 bg-white text-center">
        <svg className="mb-3 h-9 w-9 text-surface-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-sm font-semibold text-surface-400">No skills found</p>
        <p className="mt-1 text-xs text-surface-300">Try a different search term or clear filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} />
      ))}
    </div>
  );
}