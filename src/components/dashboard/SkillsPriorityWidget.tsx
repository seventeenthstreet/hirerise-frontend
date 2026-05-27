/**
 * components/dashboard/SkillsPriorityWidget.tsx
 *
 * Displays prioritised skills from the Skills Priority Engine.
 * Shows contextual empty states when prerequisites are missing.
 */

import React from 'react';
import type { PrioritySkill } from '@/hooks/useSkillsPriority';

const PRIORITY_COLOURS: Record<PrioritySkill['priority'], string> = {
  critical: 'bg-red-500',
  high:     'bg-orange-400',
  medium:   'bg-amber-400',
  low:      'bg-green-400',
};

interface SkillsPriorityWidgetProps {
  skills: PrioritySkill[];
  isLoading: boolean;
  error: Error | null;
  hasTargetRole: boolean;
  hasSkills: boolean;
}

export const SkillsPriorityWidget = React.memo(function SkillsPriorityWidget({
  skills,
  isLoading,
  error,
  hasTargetRole,
  hasSkills,
}: SkillsPriorityWidgetProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse">
        <div className="h-4 w-36 rounded bg-muted mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <div className="h-2 w-2 rounded-full bg-muted" />
            <div className="h-3 flex-1 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 shadow-sm">
        <p className="text-sm text-destructive">Could not load skills priority.</p>
      </div>
    );
  }

  if (!hasTargetRole) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-foreground">Skill Priority</h2>
        <p className="text-sm text-muted-foreground">
          <a href="/settings" className="underline hover:text-foreground">Set your target role</a>
          {' '}to activate Skill Prioritisation.
        </p>
      </div>
    );
  }

  if (!hasSkills) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-foreground">Skill Priority</h2>
        <p className="text-sm text-muted-foreground">
          <a href="/resume" className="underline hover:text-foreground">Upload your CV</a>
          {' '}to extract skills automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-foreground">Skill Priority</h2>
      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">No priority skills found.</p>
      ) : (
        <ul className="space-y-3">
          {skills.slice(0, 6).map((skill) => (
            <li key={skill.id} className="flex items-center gap-3">
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${PRIORITY_COLOURS[skill.priority]}`}
                aria-label={skill.priority}
              />
              <span className="flex-1 text-sm text-foreground">{skill.name}</span>
              {skill.gap !== undefined && (
                <span className="text-xs text-muted-foreground">
                  Gap {skill.gap}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

SkillsPriorityWidget.displayName = 'SkillsPriorityWidget';