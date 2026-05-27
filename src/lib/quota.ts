/**
 * @file lib/quota.ts
 * @description Centralized upgrade URL factory for quota-exhausted flows.
 *
 * MICRO-TWEAK #4: Centralized Upgrade URL Mapping
 *  Previously each page hardcoded '/pricing' or '/upgrade' inline.
 *  All quota modal calls now route through getUpgradeUrl() so the destination
 *  can be changed in one place without hunting across pages.
 *
 * Usage:
 *   import { getUpgradeUrl } from '@/lib/quota';
 *   <QuotaExhaustedModal upgradeUrl={getUpgradeUrl('resume')} ... />
 */

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE KEYS
// ─────────────────────────────────────────────────────────────────────────────

export type QuotaFeature =
  | 'resume'
  | 'onboarding'
  | 'direction'
  | 'rescore'
  | 'dashboard';

// ─────────────────────────────────────────────────────────────────────────────
// URL FACTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the upgrade destination URL for a quota-exhausted feature.
 * Falls back to '/upgrade' for any unrecognised feature key.
 *
 * @param feature - The feature that triggered quota exhaustion.
 */
export function getUpgradeUrl(feature: QuotaFeature | string): string {
  switch (feature) {
    case 'resume':
      return '/upgrade?feature=resume';
    case 'onboarding':
      return '/upgrade?feature=onboarding';
    case 'direction':
      return '/upgrade?feature=direction';
    case 'rescore':
      return '/upgrade?feature=rescore';
    case 'dashboard':
      return '/upgrade?feature=dashboard';
    default:
      return '/upgrade';
  }
}
