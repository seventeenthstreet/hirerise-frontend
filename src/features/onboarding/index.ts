/**
 * @file src/features/onboarding/index.ts
 * @description Public API surface for the onboarding feature domain.
 *
 * IMPORT BOUNDARY
 * ───────────────
 * External consumers (app routes, other feature domains) should import
 * from this index only — not from sub-paths within features/onboarding.
 *
 * Allowed:
 *   import { useOnboardingAnalytics } from '@/features/onboarding'
 *   import { usePostSubmitNavigation } from '@/features/onboarding'
 *
 * Discouraged for external consumers:
 *   import { useOnboardingAnalytics } from '@/features/onboarding/state/useOnboardingAnalytics'
 *
 * Exception: app/(auth)/onboarding pages import from sub-paths for clarity —
 * they are the primary consumers and sub-path imports make the dependency
 * explicit. The ESLint boundary rules permit this.
 *
 * WHAT IS NOT EXPORTED
 * ────────────────────
 * Internal implementation details (e.g. onboardingAnalytics.ts's firedStartKeys
 * Set, resolvePostOnboardingDestination's PostOnboardingUser interface) are
 * accessible via sub-path imports for tests but are not part of this public API.
 */

// ── Analytics lifecycle ───────────────────────────────────────────────────────
export { useOnboardingAnalytics, type OnboardingVariant } from './state';

// ── Navigation orchestration ─────────────────────────────────────────────────
export {
  usePostSubmitNavigation,
  resolvePostOnboardingDestination,
  type OnboardingDestination,
} from './orchestration';

// ── Query infrastructure ─────────────────────────────────────────────────────
export { onboardingQueryKeys, type OnboardingQueryKey } from './queries';