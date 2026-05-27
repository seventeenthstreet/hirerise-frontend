/**
 * @file lib/channels/email.ts
 * @description Email delivery channel for alert notifications.
 *
 * PURPOSE:
 *   Delivers a formatted alert via email. Designed as a lightweight adapter
 *   that POSTs to an email API endpoint (e.g. a Next.js API route that calls
 *   SendGrid, Resend, or Postmark server-side). This keeps secrets off the
 *   client and keeps this file free of SDK dependencies.
 *
 * APPROACH — API Route Bridge:
 *   The browser cannot call SendGrid directly (CORS + secret exposure).
 *   Instead this module POSTs to /api/alerts/email, which is a thin Next.js
 *   route handler that forwards the payload to the email provider.
 *
 *   If NEXT_PUBLIC_ALERT_EMAIL_API_URL is not set, the function is a no-op
 *   (safe for CI, local dev, staging environments without email credentials).
 *
 * RETRY:
 *   Same contract as slack.ts — throws on failure so withRetry() can catch.
 *
 * SCOPE:
 *   Internal — consumed only by alertDispatcher.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Alert } from '@/lib/alerts';
import { formatAlert }  from './formatAlert';

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL PAYLOAD TYPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The body shape POSTed to the email API route.
 * The route handler is responsible for translating this into provider-specific calls.
 */
interface EmailAlertPayload {
  subject:  string;
  severity: string;
  message:  string;
  metric:   string;
  value:    number;
  alertId:  string;
  firedAt:  string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT LINE BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a clear, scannable email subject line.
 * Format: "[CRITICAL] Resume failure rate exceeds 15% — immediate action required"
 *
 * @internal
 */
function _buildSubject(alert: ReturnType<typeof formatAlert>): string {
  return `[${alert.severity.toUpperCase()}] ${alert.message}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an alert notification via email (through the API route bridge).
 *
 * @throws If the HTTP request fails or returns a non-OK status.
 *         The caller (alertDispatcher.ts → withRetry) handles the throw.
 *
 * @param alert - Internal Alert instance from evaluateAlerts().
 */
export async function sendEmailAlert(alert: Alert): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_ALERT_EMAIL_API_URL;

  if (!apiUrl) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[email] NEXT_PUBLIC_ALERT_EMAIL_API_URL is not set — skipping email delivery.',
      );
    }
    return; // No-op, not an error.
  }

  const formatted = formatAlert(alert);

  const payload: EmailAlertPayload = {
    subject:  _buildSubject(formatted),
    severity: formatted.severity,
    message:  formatted.message,
    metric:   formatted.metric,
    value:    formatted.value,
    alertId:  formatted.id,
    firedAt:  formatted.timestamp,
  };

  const response = await fetch(apiUrl, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'Idempotency-Key': alert.id,   // prevent duplicate side-effects on retry
    },
    body:    JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = new Error(`Email API returned ${response.status}`);
    (err as Error & { status: number }).status = response.status;
    throw err;
  }
}