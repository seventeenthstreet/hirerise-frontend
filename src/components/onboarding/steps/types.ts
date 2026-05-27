/**
 * components/onboarding/steps/types.ts
 *
 * Normalized onboarding step model.
 *
 * Defines the canonical OnboardingStepDef type used by the onboarding
 * orchestration system. This is the architectural type that describes
 * a step in terms the shell and hooks understand.
 *
 * It is distinct from:
 *   - OnboardingStep (lib/api/onboarding.ts) — the backend wire type
 *   - StepConfig (career/onboarding/page.tsx) — the current inline type
 *
 * DESIGN INTENT:
 *   Explicit, readable, and incremental. Steps are not config-driven yet —
 *   each flow defines its own STEPS array typed as OnboardingStepDef[].
 *   This type is the shared contract.
 *
 * FUTURE:
 *   - component field enables dynamic step rendering
 *   - validate field enables step-level validation gating
 *   - role field enables role-based step inclusion
 */

import type { ComponentType } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// STEP PROPS CONTRACT
// Props that every onboarding step component receives from the orchestrator.
// ─────────────────────────────────────────────────────────────────────────────

export interface OnboardingStepProps {
  /** Called when the user completes this step. */
  onComplete: (data: Record<string, unknown>) => Promise<void>;
  /** Whether a save/submit operation is in flight. Disables step actions. */
  isBusy: boolean;
  /** Previously accumulated form data across all steps. */
  initialData?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

export interface OnboardingStepDef {
  /**
   * Unique step identifier. Maps to the backend :stepId route segment.
   * e.g. 'consent' | 'personal-details' | 'career-intent' | 'skills' | 'complete'
   */
  id: string;

  /** Display label shown in progress rail / step list. */
  label: string;

  /** Optional subtitle shown below the label in multi-step rails. */
  subtitle?: string;

  /**
   * Step form component. Receives OnboardingStepProps.
   * Optional — steps defined without a component are orchestration-only
   * and are not rendered directly (e.g. server-side-only steps).
   */
  component?: ComponentType<OnboardingStepProps>;

  /**
   * Optional client-side gate. Return false to block navigation to this step.
   * The shell calls this before advancing — it does NOT replace server validation.
   */
  validate?: (accumulatedData: Record<string, unknown>) => boolean;

  /**
   * Whether this step is the terminal submit step.
   * When true, the shell calls onSubmit instead of onStepChange.
   */
  isTerminal?: boolean;

  /**
   * Required roles for this step to appear.
   * If empty or undefined, the step is shown to all roles.
   * Future: enables role-based step inclusion.
   */
  roles?: Array<'student' | 'professional'>;
}