/**
 * @file lib/channels/formatAlert.ts
 * @description Canonical alert payload formatter.
 *
 * PURPOSE:
 *   All three delivery channels (Slack, email, webhook) must receive the same
 *   standardized payload shape. This module is the single transformation point
 *   from the internal Alert type (from /lib/alerts.ts) to the wire format.
 *
 * WHY a separate formatter?
 *   - Channels should not know about Alert internals.
 *   - Changing the wire format does not require touching three files.
 *   - The formatter is independently testable.
 *
 * SCOPE:
 *   Internal — consumed only by channel implementations.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Alert } from '@/lib/alerts';

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTED ALERT TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical wire payload delivered to all channels.
 *
 * All fields are always present (no optional fields) to give channel
 * implementations a stable contract — they never need to guard against
 * undefined values.
 */
export interface FormattedAlert {
  /** Stable unique identifier matching the fired rule. */
  id:        string;
  /** The alert rule category (matches Alert.id — kept for channel clarity). */
  type:      string;
  /** Severity tier. */
  severity:  'low' | 'medium' | 'high' | 'critical';
  /** Human-readable alert message. */
  message:   string;
  /** The schema metric name this alert monitors. */
  metric:    string;
  /** The raw value that triggered the alert. 0 when the original value was null. */
  value:     number;
  /** ISO 8601 timestamp string. Preferred over Unix ms for human readability in payloads. */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform an internal Alert into the canonical FormattedAlert wire payload.
 *
 * Normalization rules:
 *  - `value` null → 0  (channels display "0" rather than crashing on null)
 *  - `timestamp` rendered as ISO 8601 UTC string
 *  - `type` mirrors `id` — channels may use whichever label is more legible
 *
 * @param alert - Internal Alert instance from evaluateAlerts().
 * @returns     FormattedAlert ready for channel delivery.
 */
export function formatAlert(alert: Alert): FormattedAlert {
  return {
    id:        alert.id,
    type:      alert.id,           // same value — `type` is the channel-friendly alias
    severity:  alert.severity,
    message:   alert.message,
    metric:    alert.metric,
    value:     alert.value ?? 0,
    timestamp: new Date(alert.firedAt).toISOString(),
  };
}
