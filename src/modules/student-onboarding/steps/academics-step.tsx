

/**
 * @file src/modules/student-onboarding/steps/academics-step.tsx
 *
 * STEP 2 — ACADEMIC SNAPSHOT (Phase 1 MVP Implementation)
 * ════════════════════════════════════════════════════════
 * Collects subject strength patterns WITHOUT asking for individual marks.
 *
 * UX APPROACH:
 *  - Strength band selector per subject (Weak / Average / Strong / Excellent)
 *  - Favourite and challenging subjects (multi-select chips)
 *  - Previous year comparison (optional)
 *  - Feels like self-reflection, NOT an exam form
 *
 * DATA CONTRACT:
 *   onComplete({ subjects, favouriteSubjects, challengingSubjects })
 *   → useUpdateOnboardingStep mutation (advances to 'interests')
 */

import { useState } from 'react';
import type { OnboardingStepProps } from '../constants/step-props';
import type {
  CoreSubject,
  SubjectPerformanceBand,
  SubjectSnapshot,
} from '../api/student-onboarding.types';
import {
  CORE_SUBJECTS,
  SUBJECT_LABELS,
  SUBJECT_PERFORMANCE_BANDS,
} from '../api/student-onboarding.types';

const BAND_CONFIG: Record<SubjectPerformanceBand, { label: string; color: string; bg: string }> = {
  weak:      { label: 'Needs work',  color: 'text-red-600',    bg: 'bg-red-50 border-red-200 hover:bg-red-100' },
  average:   { label: 'Average',     color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100' },
  strong:    { label: 'Strong',      color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
  excellent: { label: 'Excellent',   color: 'text-green-600',  bg: 'bg-green-50 border-green-200 hover:bg-green-100' },
};

const SELECTED_BAND_CONFIG: Record<SubjectPerformanceBand, { ring: string; bg: string }> = {
  weak:      { ring: 'ring-red-400',   bg: 'bg-red-100 border-red-400' },
  average:   { ring: 'ring-amber-400', bg: 'bg-amber-100 border-amber-400' },
  strong:    { ring: 'ring-blue-400',  bg: 'bg-blue-100 border-blue-400' },
  excellent: { ring: 'ring-green-400', bg: 'bg-green-100 border-green-400' },
};

export default function AcademicsStep({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [subjects, setSubjects] = useState<Partial<Record<CoreSubject, SubjectSnapshot>>>(
    (initialData?.subjects as Partial<Record<CoreSubject, SubjectSnapshot>>) ?? {},
  );
  const [favouriteSubjects, setFavouriteSubjects] = useState<CoreSubject[]>(
    (initialData?.favouriteSubjects as CoreSubject[]) ?? [],
  );
  const [challengingSubjects, setChallengingSubjects] = useState<CoreSubject[]>(
    (initialData?.challengingSubjects as CoreSubject[]) ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  function setSubjectBand(subject: CoreSubject, band: SubjectPerformanceBand) {
    setSubjects((prev) => ({
      ...prev,
      [subject]: {
        current: band,
        previous: prev[subject]?.previous ?? null,
        confidence: prev[subject]?.confidence ?? 'average',
      },
    }));
  }

  function toggleFavourite(subject: CoreSubject) {
    setFavouriteSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  }

  function toggleChallenging(subject: CoreSubject) {
    setChallengingSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  }

  const completedSubjectsCount = Object.keys(subjects).length;
  const canSubmit = completedSubjectsCount >= 3;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (completedSubjectsCount < 3) {
      setError('Please rate at least 3 subjects to continue.');
      return;
    }

    await onComplete({ subjects, favouriteSubjects, challengingSubjects });
  }

  return (
    <div className="rounded-xl border border-border bg-card px-6 py-6">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">📚</span>
          <h2 className="text-base font-semibold text-foreground">Academic Snapshot</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Rate how you feel about each subject — no marks needed. Just your honest sense of where you stand.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-7">

        {/* Subject strength grid */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            How are you doing in each subject?
          </p>
          <div className="space-y-3">
            {CORE_SUBJECTS.map((subject) => {
              const selected = subjects[subject]?.current;
              return (
                <div key={subject} className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {SUBJECT_LABELS[subject]}
                  </span>
                  <div
                    role="group"
                    aria-label={`${SUBJECT_LABELS[subject]} performance`}
                    className="grid grid-cols-4 gap-1.5"
                  >
                    {SUBJECT_PERFORMANCE_BANDS.map((band) => {
                      const isSelected = selected === band;
                      const cfg = BAND_CONFIG[band];
                      const selCfg = SELECTED_BAND_CONFIG[band];
                      return (
                        <button
                          key={band}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSubjectBand(subject, band)}
                          className={`
                            rounded-lg border px-2 py-2 text-xs font-medium transition-all
                            ${isSelected
                              ? `${selCfg.bg} ring-2 ${selCfg.ring} ${cfg.color}`
                              : `${cfg.bg} ${cfg.color} border`
                            }
                          `}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Rated {completedSubjectsCount} of {CORE_SUBJECTS.length} subjects
            {completedSubjectsCount < 3 && ' · Rate at least 3 to continue'}
          </p>
        </div>

        {/* Favourite subjects */}
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Which subjects do you genuinely enjoy? <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {CORE_SUBJECTS.map((subject) => {
              const isFav = favouriteSubjects.includes(subject);
              return (
                <button
                  key={subject}
                  type="button"
                  aria-pressed={isFav}
                  onClick={() => toggleFavourite(subject)}
                  className={`
                    rounded-full border px-3 py-1 text-xs font-medium transition-all
                    ${isFav
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    }
                  `}
                >
                  {isFav && '★ '}{SUBJECT_LABELS[subject]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Challenging subjects */}
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Any subjects you find particularly challenging? <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {CORE_SUBJECTS.map((subject) => {
              const isHard = challengingSubjects.includes(subject);
              return (
                <button
                  key={subject}
                  type="button"
                  aria-pressed={isHard}
                  onClick={() => toggleChallenging(subject)}
                  className={`
                    rounded-full border px-3 py-1 text-xs font-medium transition-all
                    ${isHard
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-border bg-card text-muted-foreground hover:border-amber-300 hover:text-foreground'
                    }
                  `}
                >
                  {isHard && '⚡ '}{SUBJECT_LABELS[subject]}
                </button>
              );
            })}
          </div>
        </div>

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
            'Continue to Interests →'
          )}
        </button>
      </form>
    </div>
  );
}
