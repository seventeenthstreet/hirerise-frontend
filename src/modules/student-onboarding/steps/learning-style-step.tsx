'use client';

/**
 * @file src/modules/student-onboarding/steps/learning-style-step.tsx
 *
 * STEP 4 — LEARNING & WORKING STYLE (Phase 1 MVP Implementation)
 * ════════════════════════════════════════════════════════════════
 * Assesses thinking style without labelling it as "personality testing."
 *
 * UX APPROACH:
 *  - Scenario-based questions ("When you face a hard problem…")
 *  - Modern card/chip selection — feels lightweight and quick
 *  - 5 short scenarios, each with 4 response options
 *  - Progress indicator within the step
 *  - NOT labelled as MBTI / personality assessment
 *
 * DATA CONTRACT:
 *   onComplete({ responses, thinkingStyle })
 *   → useUpdateOnboardingStep mutation (advances to 'exposure')
 */

import { useState } from 'react';
import type { OnboardingStepProps } from '../constants/step-props';
import type { LearningStyleResponse } from '../api/student-onboarding.types';
import { LEARNING_STYLE_SCENARIOS } from '../api/student-onboarding.types';

export default function LearningStyleStep({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [responses, setResponses] = useState<Record<string, string>>(
    () => {
      const existing = (initialData?.responses as LearningStyleResponse[]) ?? [];
      return Object.fromEntries(existing.map((r) => [r.scenarioId, r.response]));
    },
  );
  const [error, setError] = useState<string | null>(null);

  function selectResponse(scenarioId: string, value: string) {
    setResponses((prev) => ({ ...prev, [scenarioId]: value }));
    setError(null);
  }

  const answeredCount = Object.keys(responses).length;
  const totalCount = LEARNING_STYLE_SCENARIOS.length;
  const allAnswered = answeredCount === totalCount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const unanswered = LEARNING_STYLE_SCENARIOS.filter((s) => !responses[s.id]);
    if (unanswered.length > 0) {
      setError('Please answer all the questions to continue.');
      return;
    }

    const responseList: LearningStyleResponse[] = LEARNING_STYLE_SCENARIOS.map((s) => ({
      scenarioId: s.id,
      response: responses[s.id],
    }));

    // Derive a dominant thinking style from responses
    const thinkingStyleMap: Record<string, 'analytical' | 'creative' | 'practical' | 'empathetic'> = {
      research_first: 'analytical', structured_plan: 'analytical', presenting: 'analytical',
      try_and_learn: 'creative', open_creative: 'creative', showing: 'creative',
      keep_going: 'practical', change_approach: 'practical', loose_guidelines: 'practical',
      ask_for_help: 'empathetic', one_on_one: 'empathetic', seek_guidance: 'empathetic',
    };

    const styleCounts: Record<string, number> = {};
    for (const r of responseList) {
      const style = thinkingStyleMap[r.response];
      if (style) styleCounts[style] = (styleCounts[style] ?? 0) + 1;
    }
    const thinkingStyle = (Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as
      'analytical' | 'creative' | 'practical' | 'empathetic' | null;

    await onComplete({ responses: responseList, thinkingStyle });
  }

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-6">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <h2 className="text-base font-semibold text-foreground">Learning & Working Style</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          A few quick scenarios to understand how you think and work best. No right or wrong answers.
        </p>
      </div>

      {/* Inline progress */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 overflow-hidden rounded-full bg-muted h-1.5">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(answeredCount / totalCount) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {answeredCount}/{totalCount} answered
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {LEARNING_STYLE_SCENARIOS.map((scenario, idx) => {
          const selected = responses[scenario.id];
          return (
            <div
              key={scenario.id}
              className={`rounded-xl border p-4 transition-colors ${selected ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'}`}
            >
              <p className="mb-3 text-sm font-medium text-foreground">
                <span className="mr-2 text-xs font-normal text-muted-foreground">Q{idx + 1}</span>
                {scenario.question}
              </p>
              <div
                role="group"
                aria-label={scenario.question}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                {scenario.options.map((option) => {
                  const isSelected = selected === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => selectResponse(scenario.id, option.value)}
                      className={`
                        rounded-lg border px-3 py-2.5 text-left text-sm transition-all
                        ${isSelected
                          ? 'border-primary bg-primary text-primary-foreground font-medium'
                          : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/30'
                        }
                      `}
                    >
                      {isSelected && <span className="mr-1.5" aria-hidden="true">✓</span>}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isBusy || !allAnswered}
          aria-busy={isBusy}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Saving…
            </span>
          ) : (
            'Continue to Activities →'
          )}
        </button>
      </form>
    </div>
  );
}
