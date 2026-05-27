/**
 * @file src/features/onboarding/mutations/index.ts
 *
 * Barrel export for all onboarding mutation hooks.
 *
 * PHASE 2 — MUTATION OWNERSHIP CONSOLIDATION
 *
 * All onboarding write operations are owned here. Consumers within
 * features/onboarding/* should import from this barrel.
 *
 * External consumers (hooks/mutations/, hooks/onboarding/, pages) continue
 * to import from their existing paths — those files are re-export bridges.
 */

export { useSetDirection, useDirection } from './useSetDirection';
export type { SetDirectionInput, SetDirectionResponse, UseDirectionReturn } from './useSetDirection';

export { useResetDirection } from './useResetDirection';
export type { ResetDirectionResponse } from './useResetDirection';

export { useSubmitStep, useSubmitOnboardingStep } from './useSubmitStep';
export type { SubmitOnboardingStepInput } from './useSubmitStep';

export { useGenerateCareerReport } from './useGenerateCareerReport';

export { useDirectionSwitch, useOnboardingDirectionSwitch } from './useDirectionSwitch';
export type { UseOnboardingDirectionSwitchReturn } from './useDirectionSwitch';
