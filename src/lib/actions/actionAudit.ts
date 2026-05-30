/**
 * @file lib/actions/actionAudit.ts
 * @description Structured in-memory audit log for alert dispatch outcomes.
 *
 * PURPOSE:
 *   Maintains a rolling, bounded history of every alert that passed all
 *   pipeline gates (policy → dedup → rate-limit) and was handed to a
 *   delivery channel. Records final outcome (success / failed) and attempt
 *   count for full observability without requiring external storage.
 *
 * POSITION IN PIPELINE:
 *
 *   channel delivery (withRetry → slack / email / webhook)
 *        ↓
 *   actionAudit.ts  ← YOU ARE HERE (called AFTER delivery outcome is known)
 *
 * DESIGN DECISIONS:
 *   - In-memory Map keyed by `${alertId}:${channel}`.
 *   - Bounded at MAX_LOG_ENTRIES — oldest entries are evicted automatically.
 *   - No persistence — intentional. The log is ephemeral; for durable history
 *     operators should use the analytics event stream (alert.delivery.*).
 *   - No async — all operations are synchronous and O(1) amortised.
 *   - No imports from React, hooks, UI, or pages.
 *
 * GUARANTEES:
 *   - recordAction() NEVER throws.
 *   - getRecentActions() NEVER throws — returns [] on any error.
 *   - No mutation of Alert, Insight, or dispatcher state.
 *   - Thread-safe within the single-threaded JS event loop.
 *
 * RULES:
 *   - Additive only — no existing files modified.
 *   - No randomness — log entries are deterministic.
 *   - No side effects — read/write of this module's own Map only.
 *
 * INTEGRATION (in alertDispatcher.ts, inside _deliverToChannel, after outcome):
 *
 *   import { recordAction } from '@/lib/actions/actionAudit';
 *
 *   // On success:
 *   recordAction({
 *     alertId:   alert.id,
 *     type:      alert.id,       // rule type
 *     target:    alert.metric,
 *     channel:   channel.name,
 *     status:    'success',
 *     timestamp: Date.now(),
 *     attempts:  result.attempts,
 *   });
 *
 *   // On failure:
 *   recordAction({ ..., status: 'failed' });
 */

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG ENTRY TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single structured entry in the audit log.
 *
 * All fields are required — partial entries are never stored. This ensures
 * consumers can always read a complete record without null-checking.
 */
export interface ActionLogEntry {
  /**
   * The alert ID that triggered this action (from Alert.id).
   * Matches the rule identifier in alerts.ts.
   */
  alertId: string;

  /**
   * The alert rule type / action type.
   * Matches Alert.id — the rule name (e.g. 'resume_failure_rate_critical').
   * Stored separately for queryability (future: filter by type).
   */
  type: string;

  /**
   * The metric that was targeted (from Alert.metric).
   * Provides context for why the action fired.
   */
  target: string;

  /**
   * The delivery channel used for this entry.
   * One log entry per (alertId, channel) pair.
   */
  channel: 'slack' | 'email' | 'webhook';

  /**
   * Final delivery outcome after all retry attempts.
   * 'success' — at least one delivery attempt succeeded.
   * 'failed'  — all retry attempts exhausted without success.
   */
  status: 'success' | 'failed';

  /**
   * Unix timestamp (ms) when the delivery outcome was recorded.
   * Set by the caller at the moment of outcome resolution.
   */
  timestamp: number;

  /**
   * Total number of delivery attempts (including the first).
   * 1 = succeeded on first try; > 1 = required retry.
   */
  attempts: number;

  // ── Optional enrichment fields (additive — no schema break) ─────────────

  /**
   * The MetricsMeta.mode at the time of dispatch.
   * 'single' | 'hybrid' | 'mock' — mirrors MetricsMeta.mode.
   * Absent when the dispatcher did not forward meta (e.g. in tests).
   */
  mode?: 'single' | 'hybrid' | 'mock';

  /**
   * Whether the metrics data was partial (degraded) at dispatch time.
   * Mirrors MetricsMeta.partial. Absent when meta was not forwarded.
   * Useful for correlating delivery failures with degraded data windows.
   */
  partial?: boolean;

  /**
   * Human-readable source label derived from MetricsMeta.
   * Format: comma-joined list of active source names, e.g. 'posthog,backend'.
   * Absent when meta was not forwarded or sources were empty.
   */
  source?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT META TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional context forwarded from the dispatcher into the audit log.
 *
 * Maps directly from MetricsMeta fields — callers pass the whole _meta object
 * and recordAction() extracts only what it needs. All fields are optional so
 * existing call sites with no meta argument continue to work unchanged.
 */
export interface AuditMeta {
  /** MetricsMeta.mode — execution mode at dispatch time. */
  mode?: 'single' | 'hybrid' | 'mock';
  /** MetricsMeta.partial — true if degraded data was used. */
  partial?: boolean;
  /**
   * MetricsMeta.sources — active source map.
   * recordAction() derives a human-readable label from this map.
   */
  sources?: { posthog?: boolean; backend?: boolean };
}

import { safeTrack } from '@/lib/actions/utils/safeTrack';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum number of entries retained in the audit log.
 *
 * When the log exceeds this limit, the oldest entry (by insertion order)
 * is evicted to keep memory usage bounded.
 *
 * 500 entries covers approximately:
 *   - 5 channels × 20 alert rules × 5 retry cycles = 500 events
 *   - At typical polling intervals this represents several hours of history.
 */
const MAX_LOG_ENTRIES = 500;

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Primary audit log store.
 *
 * Key: `${entry.alertId}:${entry.channel}` — scoped per (alert, channel) pair.
 *
 * Insertion order is preserved by Map — getRecentActions() exploits this to
 * return the most recent entries without sorting.
 *
 * When a (alertId, channel) pair re-fires (e.g. after cooldown expiry), the
 * existing entry is OVERWRITTEN with the latest outcome. This prevents stale
 * success records from masking subsequent failures.
 */
const _auditLog = new Map<string, ActionLogEntry>();

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the storage key for a log entry.
 * @internal
 */
function _logKey(entry: ActionLogEntry): string {
  return `${entry.alertId}:${entry.channel}`;
}

/**
 * Evict the oldest entry when the log is at capacity.
 *
 * Map.keys() returns keys in insertion order — the first key is the oldest.
 * This is O(1) for deletion and O(1) for iteration to the first element.
 *
 * @internal
 */
function _evictOldestIfNeeded(): void {
  if (_auditLog.size < MAX_LOG_ENTRIES) return;

  const firstKey = _auditLog.keys().next().value;
  if (firstKey !== undefined) {
    _auditLog.delete(firstKey);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a delivery outcome in the audit log.
 *
 * Call this ONCE per (alert, channel) outcome — after withRetry() resolves.
 * Overwrites any prior entry for the same (alertId, channel) pair so the
 * log always reflects the most recent dispatch cycle.
 *
 * @param entry - Complete outcome record for this dispatch attempt.
 * @param meta  - Optional MetricsMeta context to enrich the entry.
 *                Existing call sites omitting meta continue to work unchanged.
 *
 * SAFETY:
 *   Wrapped in try/catch — a logging failure must never propagate into the
 *   dispatcher or affect delivery of other alerts.
 */
export function recordAction(entry: ActionLogEntry, meta?: AuditMeta): void {
  try {
    _evictOldestIfNeeded();

    // ── Enrich entry with meta context (additive — only if meta provided) ──
    if (meta !== undefined) {
      if (meta.mode    !== undefined) entry.mode    = meta.mode;
      if (meta.partial !== undefined) entry.partial = meta.partial;
      if (meta.sources !== undefined) {
        // Derive a compact source label: 'posthog', 'backend', 'posthog,backend', ''
        const active = Object.entries(meta.sources)
          .filter(([, v]) => v === true)
          .map(([k])     => k);
        entry.source = active.join(',');
      }
    }

    const key = _logKey(entry);

    // If key already exists, delete first so re-insertion moves it to the
    // end of the Map's iteration order (most-recent = last).
    if (_auditLog.has(key)) {
      _auditLog.delete(key);
    }

    _auditLog.set(key, entry);

    // ── Emit audit analytics event (non-blocking) ──────────────────────────
    // Fires for every recorded outcome so operators can monitor delivery
    // health in their analytics pipeline without querying the in-memory log.
    // safeTrack never throws — audit recording is unaffected by analytics failure.
    safeTrack('action.audit.recorded', {
      alert_id: entry.alertId,
      channel:  entry.channel,
      status:   entry.status,
      attempts: entry.attempts,
      mode:     entry.mode     ?? 'single',
      partial:  entry.partial  ?? false,
    });

  } catch (err) {
    // Audit log failure must never surface into the delivery pipeline.
    if (process.env.NODE_ENV === 'development') {
      console.error('[actionAudit] recordAction failed — swallowed.', err);
    }
  }
}

/**
 * Retrieve the N most recent audit log entries, newest first.
 *
 * Because Map preserves insertion order and we move updated entries to the
 * end on re-insertion, reversing the values array yields newest-first order.
 *
 * @param limit - Maximum number of entries to return. Defaults to 50.
 * @returns     Array of ActionLogEntry, newest first. Empty on error.
 */
export function getRecentActions(limit = 50): ActionLogEntry[] {
  try {
    const all = Array.from(_auditLog.values());
    // Reverse gives newest-first (last inserted = most recent).
    return all.reverse().slice(0, limit);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[actionAudit] getRecentActions failed — returning [].', err);
    }
    return [];
  }
}

/**
 * Retrieve all audit log entries for a specific alert ID, newest first.
 *
 * Useful for building a per-alert delivery history view.
 *
 * @param alertId - The alert ID to filter by (matches ActionLogEntry.alertId).
 * @param limit   - Maximum entries to return. Defaults to 20.
 * @returns       Filtered entries, newest first. Empty when none found.
 */
export function getActionsForAlert(alertId: string, limit = 20): ActionLogEntry[] {
  try {
    return getRecentActions(MAX_LOG_ENTRIES)
      .filter(e => e.alertId === alertId)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Count entries by status in the audit log.
 *
 * Returns a simple summary object — useful for health dashboards or
 * diagnostics without having to iterate the full log.
 *
 * @returns { success: number; failed: number; total: number }
 */
export function getAuditSummary(): { success: number; failed: number; total: number } {
  try {
    let success = 0;
    let failed  = 0;
    for (const entry of _auditLog.values()) {
      if (entry.status === 'success') success++;
      else failed++;
    }
    return { success, failed, total: _auditLog.size };
  } catch {
    return { success: 0, failed: 0, total: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS / TESTING UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flush the entire audit log.
 *
 * Intended for:
 *   - Unit tests that need a clean audit state between cases.
 *   - Operator reset after incident post-mortems.
 *
 * Has no effect on dispatcher or delivery state.
 */
export function flushAuditLog(): void {
  _auditLog.clear();
}

/**
 * Current number of entries in the audit log.
 * Useful for diagnostics and test assertions.
 */
export function auditLogSize(): number {
  return _auditLog.size;
}