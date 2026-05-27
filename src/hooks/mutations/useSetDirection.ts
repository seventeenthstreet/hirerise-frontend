/**
 * @file src/hooks/mutations/useSetDirection.ts
 * PHASE 2 — Compatibility bridge.
 * Canonical implementation: src/features/onboarding/mutations/useSetDirection.ts
 */
// TODO(phase3-cleanup): Remove this compatibility bridge once all consumers
// import from the canonical path documented in the @file comment above.

export {
  useSetDirection,
} from '@/features/onboarding/mutations/useSetDirection';
export type {
  SetDirectionInput,
  SetDirectionResponse,
} from '@/features/onboarding/mutations/useSetDirection';

export type Direction = import('@/features/onboarding/types').OnboardingDirection;