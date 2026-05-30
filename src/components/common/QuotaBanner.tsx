

/**
 * @file components/common/QuotaBanner.tsx
 * @description Quota warning banner — displays remaining usage and upgrade CTA.
 *
 * Two modes:
 *  - Soft warning  (isNearLimit = true, isExhausted = false): amber banner
 *  - Hard limit    (isExhausted = true):                       red banner with upgrade CTA
 *
 * ARCHITECTURE: Pure display component — no API calls, no state.
 * Quota data flows in from the page via useQuota(user).
 *
 * Usage:
 *   <QuotaBanner quota={quota} upgradeUrl="/pricing" />
 */

import type { QuotaSummary } from '@/hooks/useQuota';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface QuotaBannerProps {
  /** Quota summary from useQuota() — null means quota not yet loaded. */
  quota:       QuotaSummary | null;
  /** Override the upgrade URL (defaults to /pricing). */
  upgradeUrl?: string;
  /** Additional class names for layout control. */
  className?:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function QuotaBanner({ quota, upgradeUrl, className = '' }: QuotaBannerProps) {
  if (!quota) return null;

  // Don't show banner unless quota is near-limit or exhausted
  if (!quota.isExhausted && !quota.isNearLimit) return null;

  const href = upgradeUrl ?? quota.upgradeUrl ?? '/pricing';

  // ── Hard limit (exhausted) ────────────────────────────────────────────────
  if (quota.isExhausted) {
    return (
      <div
        role="alert"
        className={`flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 ${className}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg" aria-hidden="true">🚫</span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              Usage limit reached
            </p>
            <p className="text-xs text-red-600">
              You've used all available actions on your current plan.
              Upgrade to continue.
            </p>
          </div>
        </div>
        <a
          href={href}
          className="shrink-0 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        >
          Upgrade plan
        </a>
      </div>
    );
  }

  // ── Soft warning (near limit) ─────────────────────────────────────────────
  const remaining = quota.remaining;

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg" aria-hidden="true">⚡</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Running low on usage
          </p>
          <p className="text-xs text-amber-700">
            {remaining !== null
              ? `${remaining} action${remaining === 1 ? '' : 's'} remaining on your plan.`
              : 'Limited actions remaining on your plan.'}
            {quota.resetDate
              ? ` Resets ${new Date(quota.resetDate).toLocaleDateString()}.`
              : ''}
          </p>
        </div>
      </div>
      <a
        href={href}
        className="shrink-0 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
      >
        Upgrade
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE VARIANT — accepts raw props (for backward compat with UpgradeBanner)
// ─────────────────────────────────────────────────────────────────────────────

export interface QuotaBannerSimpleProps {
  remaining:   number;
  upgradeUrl?: string;
  className?:  string;
}

/**
 * Simplified variant that accepts raw remaining count.
 * Drop-in replacement for the existing UpgradeBanner component.
 */
export function QuotaBannerSimple({ remaining, upgradeUrl, className }: QuotaBannerSimpleProps) {
  const syntheticQuota: QuotaSummary = {
    remaining,
    features:    [],
    resetDate:   null,
    isExhausted: remaining === 0,
    isNearLimit: remaining > 0 && remaining < 5,
    upgradeUrl:  upgradeUrl ?? null,
  };

  return <QuotaBanner quota={syntheticQuota} upgradeUrl={upgradeUrl} className={className} />;
}