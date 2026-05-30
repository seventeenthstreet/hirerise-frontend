

/**
 * @file front/src/modules/student-onboarding/cognitive/components/CognitiveProgress.tsx
 *
 * Shows a lightweight domain-level progress indicator for the cognitive step.
 * Renders five domain pills — each fills when at least one question in that
 * domain has been answered.
 *
 * Props are pure — no hook calls inside. The parent provides domain groups
 * and the current responseMap.
 */

import type { CognitiveDomainGroup } from '../types';
import { COGNITIVE_DOMAIN_ICONS, COGNITIVE_DOMAIN_LABELS } from '../types';

interface CognitiveProgressProps {
  readonly domainGroups:  CognitiveDomainGroup[];
  readonly responseMap:   Record<string, string[]>;
  readonly requiredTotal: number;
  readonly requiredAnswered: number;
}

export default function CognitiveProgress({
  domainGroups,
  responseMap,
  requiredTotal,
  requiredAnswered,
}: CognitiveProgressProps) {
  const percent = requiredTotal > 0
    ? Math.round((requiredAnswered / requiredTotal) * 100)
    : 0;

  return (
    <div className="mb-6">
      {/* Overall progress bar */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {requiredAnswered} of {requiredTotal} required questions answered
        </span>
        <span className="text-xs font-semibold text-primary">{percent}%</span>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Domain pills */}
      <div className="flex flex-wrap gap-2">
        {domainGroups.map((group) => {
          const answeredCount = group.questions.filter(
            (q) => (responseMap[q.id]?.length ?? 0) > 0,
          ).length;
          const isStarted  = answeredCount > 0;
          const isComplete = answeredCount >= group.questions.length;

          return (
            <div
              key={group.domain}
              className={[
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                isComplete
                  ? 'border-primary bg-primary/10 text-primary'
                  : isStarted
                    ? 'border-primary/30 bg-primary/5 text-primary/70'
                    : 'border-border bg-background text-muted-foreground',
              ].join(' ')}
            >
              <span>{COGNITIVE_DOMAIN_ICONS[group.domain]}</span>
              <span>{COGNITIVE_DOMAIN_LABELS[group.domain]}</span>
              {isComplete && (
                <span className="ml-0.5 text-primary">✓</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
