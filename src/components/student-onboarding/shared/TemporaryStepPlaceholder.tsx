'use client';

/**
 * @file components/student-onboarding/shared/TemporaryStepPlaceholder.tsx
 *
 * TEMPORARY STEP PLACEHOLDER
 * ───────────────────────────
 * Safe rendering for onboarding steps not yet implemented in Phase 2.
 *
 * PURPOSE:
 *   Prevents frontend deadlocks when the backend advances to a step
 *   (academics, activities, cognitive, aspiration) that has no real
 *   UI implementation yet.
 *
 *   WITHOUT this component:
 *     - Backend advances to 'academics' after education save
 *     - Frontend renders academics-step.tsx stub (empty or spinner)
 *     - User has no way to proceed
 *     - Onboarding is stuck indefinitely
 *
 *   WITH this component:
 *     - Backend advances to 'academics'
 *     - Frontend renders TemporaryStepPlaceholder
 *     - User sees a clear "coming soon" message
 *     - Flow is not stuck — no false spinners, no dead-end screens
 *
 * PHASE COMPATIBILITY:
 *   This component is TEMPORARY. It will be removed step-by-step as
 *   each step gains a real implementation:
 *     Phase 2B → AcademicsStep  → remove 'academics' from PHASE2_UNIMPLEMENTED_STEPS
 *     Phase 2C → ActivitiesStep → remove 'activities'
 *     Phase 2D → CognitiveStep  → remove 'cognitive'
 *     Phase 2E → AspirationStep → remove 'aspiration'
 *
 * DESIGN CONTRACT:
 *   - Never shows a permanent spinner
 *   - Never calls onComplete automatically
 *   - Clearly labels the step as "coming soon"
 *   - Shows which phase it ships in (helps internal QA)
 */

// ─────────────────────────────────────────────────────────────────────────────
// STEP METADATA
// Maps each unimplemented step to user-facing copy and shipping phase.
// ─────────────────────────────────────────────────────────────────────────────

interface StepMeta {
  title: string;
  description: string;
  icon: string;
  phase: string;
}

const UNIMPLEMENTED_STEP_META: Record<string, StepMeta> = {
  academics: {
    title:       'Academic Profile',
    description: 'Share your subjects, marks, and academic strengths.',
    icon:        '📚',
    phase:       'Phase 2B',
  },
  activities: {
    title:       'Activities & Interests',
    description: 'Tell us about your extracurricular activities and hobbies.',
    icon:        '⚡',
    phase:       'Phase 2C',
  },
  cognitive: {
    title:       'Thinking Style',
    description: 'Answer a few questions about how you approach problems.',
    icon:        '🧠',
    phase:       'Phase 2D',
  },
  aspiration: {
    title:       'Your Aspirations',
    description: 'Tell us the kind of future you want to build.',
    icon:        '🎯',
    phase:       'Phase 2E',
  },
};

const DEFAULT_META: StepMeta = {
  title:       'Next Step',
  description: 'This step is being built and will be ready soon.',
  icon:        '🚧',
  phase:       'Upcoming phase',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface TemporaryStepPlaceholderProps {
  /** The step ID from the backend session. e.g. 'academics' */
  stepId: string;
}

/**
 * TemporaryStepPlaceholder
 *
 * Safe fallback for unimplemented onboarding steps.
 * Prevents the frontend from deadlocking on a step with no UI.
 *
 * @example
 * // In StepRouter:
 * if (PHASE2_UNIMPLEMENTED_STEPS.has(flow.currentStepId)) {
 *   return <TemporaryStepPlaceholder stepId={flow.currentStepId} />;
 * }
 */
export function TemporaryStepPlaceholder({ stepId }: TemporaryStepPlaceholderProps) {
  const meta = UNIMPLEMENTED_STEP_META[stepId] ?? DEFAULT_META;

  return (
    <div
      className="rounded-xl border border-border bg-card px-6 py-10"
      role="status"
      aria-label={`${meta.title} step — coming soon`}
    >
      {/* Icon + title */}
      <div className="flex flex-col items-center text-center">
        <span className="mb-4 text-4xl" aria-hidden="true">
          {meta.icon}
        </span>
        <h2 className="text-base font-semibold text-foreground">
          {meta.title}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
          {meta.description}
        </p>
      </div>

      {/* Status pill */}
      <div className="mt-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-primary">
            This step is being built — {meta.phase}
          </span>
        </div>
      </div>

      {/* Divider + explanation */}
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-center text-xs text-muted-foreground">
          Your progress so far has been saved. This step will be available in the next phase.
          <br className="hidden sm:block" />
          You can safely close this tab and return when it&apos;s ready.
        </p>
      </div>
    </div>
  );
}
