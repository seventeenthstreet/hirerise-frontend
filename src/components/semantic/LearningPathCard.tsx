'use client';

/**
 * LearningPathCard.tsx
 *
 * UPGRADE 4 dashboard component — Learning Path Generation.
 *
 * Displays a structured, AI-generated learning path for a missing skill.
 * Can be used standalone (for a single skill) or as part of the skill-gap
 * panel in /skill-graph.
 *
 * Usage:
 *   import { LearningPathCard } from '@/components/semantic/LearningPathCard';
 *   <LearningPathCard skill="Power BI" targetRole="Business Analyst" />
 *
 *   // Or multi-skill from skill gap:
 *   import { LearningPathsPanel } from '@/components/semantic/LearningPathCard';
 *   <LearningPathsPanel skills={skillGap.missing_high_demand.map(s => s.name)} />
 */

import { useState } from 'react';
import { useLearningPath, useMultiLearningPaths } from '@/hooks/useSemanticSkills';
import type { LearningPathResult, LearningStep } from '@/hooks/useSemanticSkills';
import { cn } from '@/utils/cn';

// ─── Difficulty badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    beginner:     'bg-emerald-100 text-emerald-700 border-emerald-200',
    intermediate: 'bg-amber-100   text-amber-700   border-amber-200',
    advanced:     'bg-rose-100    text-rose-700    border-rose-200',
  };
  return (
    <span className={cn(
      'rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
      styles[level] || styles.intermediate
    )}>
      {level}
    </span>
  );
}

// ─── Step item ────────────────────────────────────────────────────────────────

function StepItem({ step, isLast }: { step: LearningStep; isLast: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-3.5 top-7 bottom-0 w-px bg-surface-100" />
      )}

      {/* Step number circle */}
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 border border-violet-200 text-[11px] font-bold text-violet-700">
        {step.step}
      </div>

      <div className="flex-1 pb-4">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <div>
            <span className="text-sm font-semibold text-surface-900">{step.title}</span>
            <span className="ml-2 text-[11px] text-surface-400">{step.duration}</span>
          </div>
          <svg
            className={cn('h-3.5 w-3.5 text-surface-400 transition-transform', open && 'rotate-180')}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-surface-600">{step.description}</p>
            {step.resources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {step.resources.map(r => (
                  <span key={r} className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] text-blue-700">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Learning Path Card ────────────────────────────────────────────────

interface LearningPathCardProps {
  skill:       string;
  targetRole?: string;
  className?:  string;
  defaultOpen?: boolean;
}

export function LearningPathCard({
  skill,
  targetRole,
  className,
  defaultOpen = false,
}: LearningPathCardProps) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const { data, isLoading, isError } = useLearningPath(skill, targetRole);

  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white shadow-sm overflow-hidden', className)}>
      <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
      <div className="p-4">
        {/* Card header */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
              <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-surface-900">{skill}</p>
              {data && (
                <p className="text-[10px] text-surface-400">{data.estimated_duration} · {data.steps.length} steps</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && <DifficultyBadge level={data.difficulty} />}
            <svg
              className={cn('h-4 w-4 text-surface-400 transition-transform', expanded && 'rotate-180')}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {/* Loading */}
        {isLoading && (
          <div className="mt-3 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="h-7 w-7 rounded-full bg-surface-100 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="h-3 w-3/4 rounded bg-surface-100 animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-surface-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="mt-2 text-xs text-rose-500">Failed to load learning path.</p>
        )}

        {/* Steps */}
        {data && expanded && (
          <div className="mt-4">
            {data.steps.map((step, i) => (
              <StepItem key={step.step} step={step} isLast={i === data.steps.length - 1} />
            ))}

            {/* Outcome */}
            <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-100 p-2.5">
              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-0.5">Outcome</p>
              <p className="text-xs text-emerald-800">{data.outcome}</p>
            </div>

            {/* Related skills */}
            {data.related_skills.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] text-surface-400 uppercase tracking-wide mb-1.5">Related Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.related_skills.map(s => (
                    <span key={s} className="rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] text-teal-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Multi-skill panel ────────────────────────────────────────────────────────

interface LearningPathsPanelProps {
  skills:      string[];
  targetRole?: string;
  maxSkills?:  number;
  className?:  string;
}

export function LearningPathsPanel({
  skills,
  targetRole,
  maxSkills = 5,
  className,
}: LearningPathsPanelProps) {
  const trimmed = skills.slice(0, maxSkills);

  if (trimmed.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100">
          <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-surface-900">Recommended Learning Paths</h3>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          {trimmed.length} skill{trimmed.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {trimmed.map((skill, i) => (
          <LearningPathCard
            key={skill}
            skill={skill}
            targetRole={targetRole}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}