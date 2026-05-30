/**
 * @file src/modules/student-onboarding/constants/step-props.ts
 *
 * STEP COMPONENT CONTRACT
 * ════════════════════════
 * Every student onboarding step component MUST accept these props.
 *
 * This type is the interface between the OnboardingStepRenderer
 * (which resolves which component to show) and the step components
 * themselves (which render the actual UI).
 *
 * DESIGN PRINCIPLES:
 *   - Minimal surface: steps receive only what they need.
 *   - No prop drilling: steps do NOT receive the full session object.
 *   - Typed completion: onComplete is typed as async — all steps are
 *     treated as potentially async operations.
 *
 * FUTURE EXTENSION:
 *   If a step needs additional context (e.g. user metadata, feature flags),
 *   add it here as an optional field. Steps that don't use it ignore it.
 *   Never add step-specific fields to this shared contract.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STEP PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface OnboardingStepProps {
  /**
   * Called when the user successfully completes this step.
   *
   * The step component is responsible for:
   *   1. Collecting and validating its own form data.
   *   2. Calling onComplete(data) with the collected data.
   *   3. NOT managing loading state — isBusy handles that.
   *
   * The renderer/page is responsible for:
   *   1. Calling the appropriate mutation (save profile or advance step).
   *   2. Handling errors and quota exhaustion.
   *   3. Advancing session state after a successful save.
   */
  onComplete: (data: Record<string, unknown>) => Promise<void>;

  /**
   * True while a save or submit operation is in flight.
   * Steps MUST disable their submit button when isBusy is true.
   */
  isBusy: boolean;

  /**
   * Pre-filled data from a restored session or previous navigation.
   * Steps should use this to pre-populate their form fields.
   * May be undefined for a fresh session with no prior data.
   */
  initialData?: Record<string, unknown>;
}