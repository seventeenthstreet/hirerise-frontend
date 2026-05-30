/**
 * @file lib/api/core/api-parser-observation.ts
 *
 * POST-PHASE-2 HARDENING — Risk 6: Parser Observation Instrumentation
 *
 * PURPOSE:
 *   Track hits to legacy / transitional parser branches during the observation
 *   window before Phase 3 cleanup. Provides actionable diagnostics without
 *   introducing production noise.
 *
 * DESIGN PRINCIPLES:
 *   - Never throws, never blocks
 *   - Dev: console.warn with structured payload
 *   - Production: structured JSON log via window.__HIRERISE_LOG (if present)
 *   - Zero impact on response parsing pipeline
 *
 * USAGE:
 *   Import and call in api-parser.ts at each branch that needs observation:
 *
 *   ```ts
 *   import { observeLegacyBranch, observeTransitionalBranch } from './api-parser-observation';
 *
 *   // Branch 2 (legacy error shape):
 *   observeLegacyBranch({ code, raw, url: requestContext?.url });
 *
 *   // Branch 3 (transitional shape):
 *   observeTransitionalBranch({ code, raw, url: requestContext?.url });
 *   ```
 *
 * REMOVAL:
 *   Remove this file and its call sites in Phase 3 after observation window closes.
 *   TODO(phase3-cleanup): Remove this file.
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _isDev(): boolean {
  return (
    typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'development' || process.env?.NODE_ENV === 'test')
  );
}

/**
 * In-memory hit counter for the observation window.
 * Resets on page reload — used for dev diagnostics only.
 */
const _branchHits: Record<string, number> = {
  legacy:       0,
  transitional: 0,
  malformed:    0,
};

/**
 * Deduplication set for the current session/runtime.
 *
 * Purpose: prevent flooding logs with the same malformed endpoint repeatedly.
 * Key format: `${branch}:${url}:${code}` — unique per branch + endpoint + code combo.
 *
 * Resets on page reload (in-memory only). This is intentional — we want one
 * log entry per unique problem per session, not one per request.
 */
const _seenKeys = new Set<string>();

/**
 * Emits a low-noise structured observation log.
 *
 * Dev: console.warn — visible in browser DevTools, easy to filter on '[PARSER OBS]'
 * Prod: structured event to window.__HIRERISE_LOG if present (monitoring hook)
 *       Uses 'info' level — these are diagnostics, not errors.
 */
function _emit(
  branch: 'legacy' | 'transitional' | 'malformed',
  context: { code?: string; url?: string; raw?: unknown },
): void {
  try {
    _branchHits[branch] = (_branchHits[branch] ?? 0) + 1;

    // Deduplication: skip repeat observations for the same branch+url+code combo
    // within the same session/runtime to avoid flooding logs.
    const dedupeKey = `${branch}:${context.url ?? 'unknown'}:${context.code ?? 'none'}`;
    const isFirstHit = !_seenKeys.has(dedupeKey);
    _seenKeys.add(dedupeKey);

    const payload = {
      type:    'PARSER_BRANCH_HIT',
      branch,
      count:   _branchHits[branch],
      code:    context.code ?? 'none',
      url:     context.url  ?? 'unknown',
      // NOTE: raw is intentionally omitted from the payload in production
      // to prevent PII leakage. In dev, a truncated shape is included.
    };

    // Only emit the first hit per unique key to avoid log flooding.
    // Subsequent hits increment the counter but do not re-emit.
    if (!isFirstHit) return;

    if (_isDev()) {
      // Include truncated raw shape in dev for easier debugging.
      // Keys only — values may contain tokens/PII.
      const rawKeys = context.raw !== null && typeof context.raw === 'object'
        ? Object.keys(context.raw as object).slice(0, 8)
        : [];

      console.warn(
        `[PARSER OBS] ${branch.toUpperCase()} branch hit #${payload.count}`,
        `url=${payload.url}`,
        `code=${payload.code}`,
        rawKeys.length ? `raw_keys=[${rawKeys.join(', ')}]` : '',
        '\n⚠️  This indicates an unpatched backend endpoint. Investigate before Phase 3.',
      );
    } else {
      // Production: emit structured event to monitoring hook if present.
      // This hook is expected to be installed by ObservabilityProvider.
      const logHook = (window as unknown as Record<string, unknown>).__HIRERISE_LOG;
      if (typeof logHook === 'function') {
        const { type: _type, ...payloadRest } = payload;
        (logHook as (e: unknown) => void)({
          level:   'info',
          type:    'parser_observation',
          ...payloadRest,
        });
      }
    }
  } catch {
    // Never surface — observation must not affect the parse pipeline.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call when Branch 2 (legacy error shape) fires.
 *
 * Legacy shape: { error: 'CODE_STRING', message, requestId }
 * Indicates a backend endpoint still returning legacy error format.
 */
export function observeLegacyBranch(context: {
  code?: string;
  url?: string;
  raw?: unknown;
}): void {
  _emit('legacy', context);
}

/**
 * Call when Branch 3 (transitional error shape) fires.
 *
 * Transitional shape: { code: string, message } or { errorCode: string, message }
 * Post-Phase-2 this should never fire. A hit means an undiscovered legacy endpoint.
 */
export function observeTransitionalBranch(context: {
  code?: string;
  url?: string;
  raw?: unknown;
}): void {
  _emit('transitional', context);
}

/**
 * Call when a malformed response is detected (no `success` field, non-object body, etc.)
 *
 * Provides visibility into backend endpoints that completely bypass the contract.
 */
export function observeMalformedResponse(context: {
  stage: string;
  url?: string;
  raw?: unknown;
}): void {
  _emit('malformed', { url: context.url, raw: context.raw });
}

/**
 * Returns a snapshot of branch hit counts for the current session.
 * Use in dev tools or diagnostics panels.
 */
export function getParserObservationSnapshot(): Readonly<typeof _branchHits> {
  return Object.freeze({ ..._branchHits });
}