/**
 * @file lib/featureFlags.ts
 * @description Scalable feature flag system for the HireRise SaaS platform.
 *
 * ARCHITECTURE:
 *  - Pure lib module — no React, no hooks. Consumed via useFeatureFlag hook.
 *  - Flags are evaluated from a layered config: defaults → remote → targeting.
 *  - Remote config is optional: falls back to safe defaults with zero backend
 *    dependency. Fully operational on day one with no infra.
 *  - User-based targeting (tier, direction, onboarding state) is built-in.
 *
 * FLAG RESOLUTION ORDER (highest wins):
 *  1. URL override (?flags=flag_name:true) — dev/QA only, no-op in production
 *  2. User-level targeting rules (tier, user_type, etc.)
 *  3. Remote config (fetched once at boot, cached in memory)
 *  4. Static defaults (hardcoded safe fallback — always present)
 *
 * IMPROVEMENTS OVER PRIOR VERSION:
 *  1. Evaluation Timing Safety
 *     - evaluateFlag is called only AFTER AppContext hydration (enforced in
 *       useFeatureFlag). Returns the static default before user loads,
 *       preventing a false→true flicker on mount.
 *     - Remote flag load is gated: loadRemoteFlags must complete before the
 *       hook re-evaluates (via the _remoteReady promise).
 *
 *  2. Deterministic Targeting
 *     - Targeting rules are pure functions of user context — no random().
 *     - The same userId always maps to the same flag variant.
 *     - Percentage-based rollouts use a stable hash of userId (see
 *       stableHashPercent), making assignments reproducible across sessions.
 *
 *  3. Experimentation Support (scaffolded, ready to activate)
 *     - Flags can carry a `variants` array and `assignVariant` function.
 *     - evaluateFlagVariant returns the assigned variant key for A/B tests.
 *     - Variant assignment is deterministic (hash-based, not random).
 *     - Exposure tracking: evaluateFlagVariant fires an exposure event via
 *       an optional onExposure callback, wired to analytics at the hook layer.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of the user context used for flag targeting. */
export interface FlagUserContext {
  userId?:             string;
  userType?:           string | null;  // 'student' | 'professional' | null
  onboardingComplete?: boolean;
  resumeUploaded?:     boolean;
  /** Tier / plan. Use 'free' until billing tiers are implemented. */
  tier?:               string;
  /** Internal Anthropic/HireRise team member. Gates ai_experimental_mode. */
  isInternal?:         boolean;
  /** Engineering team member. Gates ai_research_mode. */
  isEngineeringTeam?:  boolean;
}

/** All supported feature flags and their value types. */
export interface FeatureFlags {
  // ── UI / UX experiments ────────────────────────────────────────────────────
  new_dashboard:          boolean;
  chi_score_v2:           boolean;
  resume_upload_v2:       boolean;
  // ── Rollouts ───────────────────────────────────────────────────────────────
  background_polling:     boolean;
  quota_modal_v2:         boolean;
  skills_priority_widget: boolean;
  // ── Observability ─────────────────────────────────────────────────────────
  enable_performance_tracking: boolean;
  enable_error_reporting:      boolean;
  // ── XAI / AI Augmentation (R2 — XAI-1 Sprint 0) ──────────────────────────
  /**
   * Master switch for all XAI augmentation capabilities.
   *
   * Setting this false instantly disables all AI narrative rendering,
   * explanation generation, and capability adapter activity. This is the
   * primary kill-switch for dark launch and controlled rollout (Sprint 2).
   *
   * Default: false (fail-closed).
   * Owner:   XAI Programme Lead
   * Change authority: Engineering Director + XAI Programme Lead
   *
   * Consumers: WP-7 (Dashboard & Reporting), WP-13, useAIExplanation hook,
   * and all future XAI capability adapters (WP-2/WP-3/WP-4).
   *
   * GOVERNANCE: No consumer may reimplement this check inline. All XAI
   * capability gating must read this flag via evaluateFlag().
   */
  ai_augmentation_enabled: boolean;
}

export type FlagKey = keyof FeatureFlags;

// ── Variant type for A/B experimentation support ─────────────────────────────

export interface FlagVariant {
  /** Stable identifier — used in analytics exposure events. */
  key:    string;
  /** Human label (for debugging / admin UI). */
  label?: string;
  /** Percentage weight [0–100]. Weights must sum to 100 across all variants. */
  weight: number;
}

/**
 * Optional experiment definition attached to a flag.
 * When present, evaluateFlagVariant resolves which variant the user is in.
 */
export interface FlagExperiment {
  flagKey:  FlagKey;
  variants: FlagVariant[];
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DEFAULTS — safe, production-conservative fallbacks
// ─────────────────────────────────────────────────────────────────────────────

const FLAG_DEFAULTS: FeatureFlags = {
  new_dashboard:               false,
  chi_score_v2:                false,
  resume_upload_v2:            false,
  background_polling:          true,
  quota_modal_v2:              true,
  skills_priority_widget:      true,
  enable_performance_tracking: true,
  enable_error_reporting:      true,
  // XAI / AI Augmentation — fail-closed, default disabled (R2 — XAI-1 Sprint 0)
  ai_augmentation_enabled:     false,
};

// ─────────────────────────────────────────────────────────────────────────────
// USER TARGETING RULES
// Each rule overrides the default for matching users.
// Applied after defaults and before remote config values.
// Rules are PURE functions of user context — no randomness, fully deterministic.
// ─────────────────────────────────────────────────────────────────────────────

type TargetingRule = {
  flag:      FlagKey;
  value:     boolean;
  condition: (ctx: FlagUserContext) => boolean;
};

const USER_TARGETING_RULES: TargetingRule[] = [
  // chi_score_v2: only for users who completed onboarding
  {
    flag:      'chi_score_v2',
    value:     true,
    condition: (ctx) => ctx.onboardingComplete === true,
  },
  // new_dashboard: only for professional track users
  {
    flag:      'new_dashboard',
    value:     true,
    condition: (ctx) => ctx.userType === 'professional',
  },
  // resume_upload_v2: only for users who haven't uploaded yet (new upload flow)
  {
    flag:      'resume_upload_v2',
    value:     true,
    condition: (ctx) => ctx.resumeUploaded === false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// REMOTE CONFIG (optional, async)
// ─────────────────────────────────────────────────────────────────────────────

/** In-memory remote flag cache. Populated by loadRemoteFlags(). */
let _remoteFlags: Partial<FeatureFlags> | null = null;

/**
 * Promise that resolves when remote flags have settled (success or failure).
 * useFeatureFlag awaits this before returning evaluated values, eliminating
 * the default→remote flicker on first render.
 */
let _remoteReady: Promise<void> | null = null;

/**
 * Load feature flags from a remote config service.
 * Call once at app boot (e.g. AppContext hydration sequence).
 *
 * SAFE DEFAULT: if this throws or is never called, FLAG_DEFAULTS and
 * user targeting rules still apply correctly.
 *
 * TO WIRE: replace the fetch() placeholder with your provider's SDK.
 * LaunchDarkly: ldClient.allFlagsState(user)
 * GrowthBook:   gb.loadFeatures()
 * Custom API:   GET /api/v1/feature-flags?userId=xxx
 */
export async function loadRemoteFlags(userContext?: FlagUserContext): Promise<void> {
  if (typeof window === 'undefined') return; // SSR guard

  if (_remoteReady) return _remoteReady; // already loading or loaded

  _remoteReady = (async () => {
    try {
      // ── Placeholder: replace with real provider call ───────────────────────
      // const res = await fetch(`/api/v1/feature-flags?userId=${userContext?.userId}`);
      // const data = await res.json();
      // _remoteFlags = data.flags as Partial<FeatureFlags>;
      //
      // Until wired, remote flags are empty (safe fallback to defaults):
      _remoteFlags = {};
      void userContext;
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[FeatureFlags] Failed to load remote flags — using defaults.');
      }
      _remoteFlags = {};
    }
  })();

  return _remoteReady;
}

/**
 * Returns a promise that resolves when remote flags are ready.
 * useFeatureFlag subscribes to this to block rendering until stable.
 */
export function whenRemoteFlagsReady(): Promise<void> {
  return _remoteReady ?? Promise.resolve();
}

// ─────────────────────────────────────────────────────────────────────────────
// URL OVERRIDE (dev / QA only)
// ?flags=new_dashboard:true,chi_score_v2:false
// Stripped in production via the guard below.
// ─────────────────────────────────────────────────────────────────────────────

function getUrlOverrides(): Partial<FeatureFlags> {
  if (
    process.env.NODE_ENV === 'production' ||
    typeof window === 'undefined'
  ) return {};

  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('flags');
    if (!raw) return {};

    const overrides: Partial<FeatureFlags> = {};
    for (const pair of raw.split(',')) {
      const [key, val] = pair.split(':');
      // Only accept exact 'true' or 'false' — reject any other string to
      // prevent accidental coercion (e.g. '1', 'yes', 'TRUE' → silent false).
      // Use Object.prototype.hasOwnProperty for safe key membership check —
      // avoids false positives if FLAG_DEFAULTS ever has a 'constructor' key.
      if (
        key &&
        (val === 'true' || val === 'false') &&
        Object.prototype.hasOwnProperty.call(FLAG_DEFAULTS, key)
      ) {
        (overrides as Record<string, boolean>)[key] = val === 'true';
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC HASH — stable percentage-based rollout
// Maps a userId to a [0, 100) bucket. The same userId always maps to the same
// bucket, making rollouts reproducible across reloads and devices.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a stable integer in [0, 100) for a given seed string.
 * Combines flagKey with userId so the same user can be in different buckets
 * for different flags (avoids correlated rollout clustering).
 */
export function stableHashPercent(flagKey: string, userId: string): number {
  const seed = `${flagKey}:${userId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0; // unsigned 32-bit
  }
  return hash % 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate a single feature flag for the given user context.
 *
 * Resolution order:
 *  URL override > User targeting rule > Remote config > Static default
 *
 * NOTE: This is synchronous and safe to call before remote flags are ready —
 * it will use defaults. For flicker-free evaluation, await whenRemoteFlagsReady()
 * before calling (handled automatically in useFeatureFlag).
 */
export function evaluateFlag<K extends FlagKey>(
  flag: K,
  userContext?: FlagUserContext,
): FeatureFlags[K] {
  // 1. URL override (dev/QA only)
  const urlOverrides = getUrlOverrides();
  if (flag in urlOverrides) {
    return urlOverrides[flag] as FeatureFlags[K];
  }

  // 2. User targeting rules (first matching rule wins)
  if (userContext) {
    for (const rule of USER_TARGETING_RULES) {
      if (rule.flag === flag && rule.condition(userContext)) {
        return rule.value as FeatureFlags[K];
      }
    }
  }

  // 3. Remote config
  if (_remoteFlags && flag in _remoteFlags) {
    return _remoteFlags[flag] as FeatureFlags[K];
  }

  // 4. Static default
  return FLAG_DEFAULTS[flag];
}

/**
 * Evaluate all flags at once. Useful for debugging or snapshotting the full
 * flag state into an analytics exposure event.
 */
export function evaluateAllFlags(userContext?: FlagUserContext): FeatureFlags {
  const entries = (Object.keys(FLAG_DEFAULTS) as FlagKey[]).map((flag) => [
    flag,
    evaluateFlag(flag, userContext),
  ]);
  return Object.fromEntries(entries) as FeatureFlags;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPERIMENTATION — variant assignment (A/B test scaffolding)
//
// This is production-ready scaffolding. To activate an experiment:
//  1. Define an entry in EXPERIMENTS below.
//  2. Call evaluateFlagVariant(flagKey, userContext, onExposure) in the hook.
//  3. Wire onExposure to trackEvent('flag_exposure', ...) in useFeatureFlag.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active experiments. Each entry maps a flag key to its variant definition.
 * Only populate this when you're actively running an experiment — it overrides
 * the normal boolean evaluation for the named flag.
 */
export const EXPERIMENTS: Partial<Record<FlagKey, FlagExperiment>> = {
  // Example (activate when ready):
  // new_dashboard: {
  //   flagKey: 'new_dashboard',
  //   variants: [
  //     { key: 'control', label: 'Legacy dashboard', weight: 50 },
  //     { key: 'treatment', label: 'New dashboard',  weight: 50 },
  //   ],
  // },
};

/**
 * Resolve the variant key for an A/B experiment.
 *
 * - Uses stableHashPercent for deterministic bucket assignment.
 * - Fires onExposure callback for exposure tracking (wire to analytics).
 * - Falls back to null (no experiment active or user not bucketed).
 *
 * @example
 * const variant = evaluateFlagVariant('new_dashboard', userContext, (flag, variant) => {
 *   trackEvent('flag_exposure', { flag, variant });
 * });
 * if (variant === 'treatment') return <NewDashboard />;
 * return <LegacyDashboard />;
 */
export function evaluateFlagVariant(
  flagKey: FlagKey,
  userContext?: FlagUserContext,
  onExposure?: (flagKey: FlagKey, variantKey: string) => void,
): string | null {
  const experiment = EXPERIMENTS[flagKey];
  if (!experiment || !userContext?.userId) return null;

  const bucket = stableHashPercent(flagKey, userContext.userId);

  let cumulative = 0;
  for (const variant of experiment.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      // Fire exposure callback — analytics layer records this as an impression
      onExposure?.(flagKey, variant.key);
      return variant.key;
    }
  }

  return null; // weights don't sum to 100 — safe fallback
}