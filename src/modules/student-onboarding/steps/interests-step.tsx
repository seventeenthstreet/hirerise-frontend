'use client';

/**
 * @file src/modules/student-onboarding/steps/interests-step.tsx
 *
 * STEP 3 — INTEREST DISCOVERY (Phase 1 MVP Implementation)
 * ═══════════════════════════════════════════════════════════
 * Captures intrinsic motivation via interactive card selection.
 *
 * UX APPROACH:
 *  - Visual emoji card grid — feels like an app, not a form
 *  - "Which activity sounds most exciting?" framing
 *  - Select 3–6 cards to build a multi-dimensional interest profile
 *  - Cards map to clusters: analytical / creative / technical / entrepreneurial / investigative / social
 *  - Dominant clusters surface automatically from selections
 *
 * DATA CONTRACT:
 *   onComplete({ selectedCards, dominantClusters })
 *   → useUpdateOnboardingStep mutation (advances to 'learning_style')
 */

import { useState, useMemo } from 'react';
import type { OnboardingStepProps } from '../constants/step-props';
import type { InterestCardId, InterestCluster } from '../api/student-onboarding.types';
import { INTEREST_CARDS } from '../api/student-onboarding.types';

const CLUSTER_LABELS: Record<InterestCluster, string> = {
  analytical: 'Analytical',
  creative: 'Creative',
  technical: 'Technical',
  entrepreneurial: 'Entrepreneurial',
  investigative: 'Investigative',
  social: 'Social',
};

const CLUSTER_COLORS: Record<InterestCluster, string> = {
  analytical: 'bg-blue-100 text-blue-700 border-blue-200',
  creative: 'bg-purple-100 text-purple-700 border-purple-200',
  technical: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  entrepreneurial: 'bg-orange-100 text-orange-700 border-orange-200',
  investigative: 'bg-green-100 text-green-700 border-green-200',
  social: 'bg-pink-100 text-pink-700 border-pink-200',
};

const MIN_SELECTIONS = 3;
const MAX_SELECTIONS = 6;

export default function InterestsStep({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [selectedCards, setSelectedCards] = useState<InterestCardId[]>(
    (initialData?.selectedCards as InterestCardId[]) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  // Derive dominant clusters from selected cards
  const dominantClusters = useMemo<InterestCluster[]>(() => {
    const clusterCount: Partial<Record<InterestCluster, number>> = {};
    for (const cardId of selectedCards) {
      const card = INTEREST_CARDS.find((c) => c.id === cardId);
      if (card) {
        clusterCount[card.cluster] = (clusterCount[card.cluster] ?? 0) + 1;
      }
    }
    // Return clusters sorted by frequency, top 3
    return (Object.entries(clusterCount) as [InterestCluster, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cluster]) => cluster);
  }, [selectedCards]);

  function toggleCard(cardId: InterestCardId) {
    setSelectedCards((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= MAX_SELECTIONS) return prev; // cap at max
      return [...prev, cardId];
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedCards.length < MIN_SELECTIONS) {
      setError(`Pick at least ${MIN_SELECTIONS} activities that excite you.`);
      return;
    }

    await onComplete({ selectedCards, dominantClusters });
  }

  const remaining = MAX_SELECTIONS - selectedCards.length;
  const canSubmit = selectedCards.length >= MIN_SELECTIONS;

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-6">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">✨</span>
          <h2 className="text-base font-semibold text-foreground">Interest Discovery</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Which of these activities sounds most exciting to you? Pick {MIN_SELECTIONS}–{MAX_SELECTIONS} that genuinely call to you.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">

        {/* Selection counter */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {selectedCards.length === 0
              ? 'Nothing selected yet'
              : `${selectedCards.length} selected`}
          </span>
          {selectedCards.length > 0 && remaining > 0 && (
            <span className="text-xs text-muted-foreground">
              Up to {remaining} more
            </span>
          )}
          {remaining === 0 && (
            <span className="text-xs text-primary font-medium">Maximum reached</span>
          )}
        </div>

        {/* Interest cards grid */}
        <div
          role="group"
          aria-label="Select activities that interest you"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
        >
          {INTEREST_CARDS.map((card) => {
            const isSelected = selectedCards.includes(card.id as InterestCardId);
            const isDisabled = !isSelected && remaining === 0;

            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={isSelected}
                disabled={isDisabled}
                onClick={() => toggleCard(card.id as InterestCardId)}
                className={`
                  flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all
                  ${isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary'
                    : isDisabled
                      ? 'cursor-not-allowed border-border bg-muted/30 opacity-40'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                  }
                `}
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {card.emoji}
                </span>
                <span className={`text-xs font-medium leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                  {card.label}
                </span>
                {isSelected && (
                  <span className="text-primary" aria-hidden="true">✓</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dominant clusters preview */}
        {dominantClusters.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Your emerging profile:</p>
            <div className="flex flex-wrap gap-1.5">
              {dominantClusters.map((cluster) => (
                <span
                  key={cluster}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CLUSTER_COLORS[cluster]}`}
                >
                  {CLUSTER_LABELS[cluster]}
                </span>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isBusy || !canSubmit}
          aria-busy={isBusy}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Saving…
            </span>
          ) : (
            'Continue to Learning Style →'
          )}
        </button>
      </form>
    </div>
  );
}
