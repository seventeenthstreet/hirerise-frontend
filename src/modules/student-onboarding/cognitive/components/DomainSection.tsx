'use client';

/**
 * @file front/src/modules/student-onboarding/cognitive/components/DomainSection.tsx
 *
 * DOMAIN SECTION — Groups all scenario cards for a single cognitive domain.
 *
 * Renders a collapsible domain section header followed by its ScenarioCards.
 * Progressive disclosure: sections expand automatically when needed,
 * but the student can collapse completed sections to reduce visual noise.
 */

import { useState } from 'react';
import ScenarioCard from './ScenarioCard';
import type { CognitiveDomainGroup } from '../types';
import { COGNITIVE_DOMAIN_ICONS, COGNITIVE_DOMAIN_LABELS } from '../types';

interface DomainSectionProps {
  readonly group:       CognitiveDomainGroup;
  readonly responseMap: Record<string, string[]>;
  readonly onSelect:    (questionId: string, selectedKeys: string[]) => void;
  readonly isSaving:    boolean;
  /** If true, render expanded by default */
  readonly defaultOpen?: boolean;
}

export default function DomainSection({
  group,
  responseMap,
  onSelect,
  isSaving,
  defaultOpen = true,
}: DomainSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const answeredCount = group.questions.filter(
    (q) => (responseMap[q.id]?.length ?? 0) > 0,
  ).length;
  const totalCount    = group.questions.length;
  const isComplete    = answeredCount === totalCount && totalCount > 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Section header — always visible, clickable to collapse */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">
            {COGNITIVE_DOMAIN_ICONS[group.domain]}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {COGNITIVE_DOMAIN_LABELS[group.domain]}
            </p>
            {group.description && (
              <p className="text-xs text-muted-foreground">{group.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Answer count badge */}
          <span
            className={[
              'rounded-full px-2.5 py-0.5 text-xs font-medium',
              isComplete
                ? 'bg-primary/10 text-primary'
                : answeredCount > 0
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-muted text-muted-foreground',
            ].join(' ')}
          >
            {answeredCount}/{totalCount}
          </span>

          {/* Chevron */}
          <svg
            className={[
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen ? 'rotate-180' : '',
            ].join(' ')}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Collapsible scenario cards */}
      {isOpen && (
        <div className="space-y-3 border-t border-border p-4">
          {group.questions.map((question) => (
            <ScenarioCard
              key={question.id}
              question={question}
              selectedKeys={responseMap[question.id] ?? []}
              onSelect={onSelect}
              isSaving={isSaving}
            />
          ))}
        </div>
      )}
    </div>
  );
}
