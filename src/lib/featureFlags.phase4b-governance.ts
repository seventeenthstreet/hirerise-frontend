/**
 * @file src/lib/featureFlags.phase4b-governance.ts
 *
 * Phase 4B Governance Hardening Feature Flags
 *
 * PURPOSE:
 *   Declares feature flags for Phase 4B validator and observability hardening.
 *   These are ADDITIVE — they extend featureFlags.phase4b.ts without modifying it.
 *
 * FLAGS INTRODUCED:
 *   ai_provenance_tracking_enabled  — phrase match provenance capture
 *   ai_suppression_metrics_enabled  — narrative suppression metric recording
 *   ai_prompt_validation_enabled    — prompt registry governance validation
 *
 * GOVERNANCE:
 *   All flags default false (fail-closed).
 *   Observability failure is always silent — flags off = zero telemetry, no errors.
 *   Prompt validation flag off = validation skipped at runtime (deployment gate still runs).
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXTENSION
// Merge into the main FeatureFlags interface.
// ─────────────────────────────────────────────────────────────────────────────

export interface Phase4BGovernanceFlags {
  /**
   * Enables phrase match provenance payload capture on validator rule triggers.
   * When false: provenance payloads are not built or emitted (zero overhead).
   * Default: false.
   */
  ai_provenance_tracking_enabled: boolean;

  /**
   * Enables narrative suppression metric recording in the in-process metrics store.
   * When false: no counters are incremented (zero overhead).
   * Default: false.
   */
  ai_suppression_metrics_enabled: boolean;

  /**
   * Enables runtime prompt registry validation enforcement.
   * NOTE: The deployment-time gate (CI/CD) always runs regardless of this flag.
   * This flag gates runtime re-validation of prompts loaded from config.
   * Default: false.
   */
  ai_prompt_validation_enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES (all false — fail-closed governance)
// ─────────────────────────────────────────────────────────────────────────────

export const FLAG_DEFAULTS_4B_GOVERNANCE: Phase4BGovernanceFlags = {
  ai_provenance_tracking_enabled: false,
  ai_suppression_metrics_enabled: false,
  ai_prompt_validation_enabled:   false,
};

// ─────────────────────────────────────────────────────────────────────────────
// SAFE GOVERNANCE FLAG HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if phrase match provenance capture is enabled.
 * Fail-closed: errors always return false.
 */
export function isProvenanceTrackingEnabled(): boolean {
  try {
    return process.env.AI_PROVENANCE_TRACKING_ENABLED === 'true';
  } catch {
    return false;
  }
}

/**
 * Returns true if suppression metric recording is enabled.
 * Fail-closed: errors always return false.
 */
export function isSuppressionMetricsEnabled(): boolean {
  try {
    return process.env.AI_SUPPRESSION_METRICS_ENABLED === 'true';
  } catch {
    return false;
  }
}

/**
 * Returns true if runtime prompt validation is enabled.
 * Fail-closed: errors always return false.
 */
export function isPromptValidationEnabled(): boolean {
  try {
    return process.env.AI_PROMPT_VALIDATION_ENABLED === 'true';
  } catch {
    return false;
  }
}
