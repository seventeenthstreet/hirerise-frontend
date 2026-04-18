'use client';

/**
 * SemanticSkillCard.tsx
 *
 * UPGRADE 1 dashboard component — "AI Detected Related Skills"
 *
 * Displays semantically similar skills for each of the user's existing skills.
 * Designed to slot into the existing /skill-graph page alongside SectionCard.
 *
 * Props:
 *   skill      — the seed skill to expand (typically from existing_skills[])
 *   compact    — smaller variant for inline use
 *
 * Usage in skill-graph/page.tsx:
 *   import { SemanticSkillCard } from '@/components/semantic/SemanticSkillCard';
 *   <SemanticSkillCard skill="Excel" />
 */

import { useSimilarSkills } from '@/hooks/useSemanticSkills';
import { cn } from '@/utils/cn';

// ─── Similarity badge ─────────────────────────────────────────────────────────

function SimBadge({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color =
    pct >= 85 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
    pct >= 70 ? 'bg-violet-100  text-violet-700  border-violet-200'  :
                'bg-slate-100   text-slate-600    border-slate-200';
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', color)}>
      {pct}%
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SemanticSkillCardProps {
  skill:    string;
  compact?: boolean;
  className?: string;
}

export function SemanticSkillCard({ skill, compact = false, className }: SemanticSkillCardProps) {
  const { data, isLoading, isError } = useSimilarSkills(skill, 5);

  if (isLoading) {
    return (
      <div className={cn('rounded-xl border border-surface-100 bg-white p-4 shadow-sm', className)}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 rounded bg-surface-100 animate-pulse" />
          <div className="h-3 w-32 rounded bg-surface-100 animate-pulse" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 w-20 rounded-full bg-surface-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data || data.similar_skills.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-violet-100 bg-white shadow-sm overflow-hidden', className)}>
      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
      <div className={cn('p-4', compact && 'p-3')}>
        <div className="flex items-center gap-2 mb-3">
          {/* AI sparkle icon */}
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
            <svg className="h-4 w-4 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.3L12 17l-6.2 4.2 2.4-7.3L2 9.4h7.6z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900">
              AI-related to <span className="text-violet-700">{skill}</span>
            </p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wide">
              Semantic Intelligence
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.scores.map(({ skill: s, similarity }) => (
            <div
              key={s}
              className="flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-100 px-2.5 py-1"
            >
              <span className="text-xs font-medium text-violet-700">{s}</span>
              <SimBadge score={similarity} />
            </div>
          ))}
        </div>

        {!compact && (
          <p className="mt-3 text-[11px] text-surface-400">
            Skills above are semantically related — adding them strengthens your profile
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Multi-skill variant ──────────────────────────────────────────────────────

interface SemanticSkillPanelProps {
  existingSkills: string[];
  maxSeeds?:      number;
}

/**
 * Shows AI-related skills for up to maxSeeds of the user's skills.
 * Drop into skill-graph page to replace or extend the SectionCard grid.
 */
export function SemanticSkillPanel({ existingSkills, maxSeeds = 3 }: SemanticSkillPanelProps) {
  const seeds = existingSkills.slice(0, maxSeeds);
  if (seeds.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100">
          <svg className="h-3.5 w-3.5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-surface-900">AI Skill Intelligence</h3>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 uppercase tracking-wide">
          Semantic
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {seeds.map(skill => (
          <SemanticSkillCard key={skill} skill={skill} compact />
        ))}
      </div>
    </div>
  );
}