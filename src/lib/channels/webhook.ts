/**
 * @file lib/channels/webhook.ts
 * @description Generic outbound webhook delivery channel.
 *
 * PURPOSE:
 *   Delivers the canonical FormattedAlert payload to any HTTP endpoint via
 *   a signed POST. This channel is fully generic — it does not assume any
 *   specific receiver format. Use it to integrate with PagerDuty, OpsGenie,
 *   custom internal tooling, or any other webhook-capable system.
 *
 * SIGNING:
 *   The request includes an X-Alert-Signature header containing a lightweight
 *   HMAC-style signature of the payload. This allows the receiving endpoint to
 *   verify the payload was not tampered in transit.
 *
 *   Signing is skipped (header omitted) when no secret is configured.
 *
 * CONFIGURATION:
 *   NEXT_PUBLIC_ALERT_WEBHOOK_URL    — the target endpoint URL
 *   NEXT_PUBLIC_ALERT_WEBHOOK_SECRET — optional shared secret for signing
 *
 *   If the URL is absent, sendWebhookAlert() is a no-op.
 *
 * RETRY:
 *   Same contract as slack.ts and email.ts — throws on failure.
 *
 * SCOPE:
 *   Internal — consumed only by alertDispatcher.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Alert } from '@/lib/alerts';
import { formatAlert }  from './formatAlert';
import type { FormattedAlert } from './formatAlert';

// ─────────────────────────────────────────────────────────────────────────────
// PAYLOAD BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrap the FormattedAlert in an envelope suitable for webhook delivery.
 * The envelope includes a schema version so receivers can handle format changes.
 *
 * @internal
 */
function _buildWebhookPayload(alert: FormattedAlert): object {
  return {
    schema_version: '1.0',
    event:          'alert.fired',
    alert,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a lightweight HMAC-style signature for the serialized payload.
 *
 * Uses the Web Crypto API (available in modern browsers and Node.js 18+).
 * Falls back to null if crypto is unavailable — signing is best-effort.
 *
 * Format: "sha256=<hex>"  — matches the GitHub webhook signature convention.
 *
 * @param body   - The serialized JSON string to sign.
 * @param secret - The shared secret.
 * @returns      Signature string, or null on failure.
 *
 * @internal
 */
async function _signPayload(
  body:   string,
  secret: string,
): Promise<string | null> {
  try {
    const encoder  = new TextEncoder();
    const keyData  = encoder.encode(secret);
    const msgData  = encoder.encode(body);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const signature = await crypto.subtle.sign('HMAC', key, msgData);
    const hexSig    = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return `sha256=${hexSig}`;
  } catch {
    // crypto.subtle unavailable (e.g. non-secure context) — skip signing.
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an alert to the configured generic webhook endpoint.
 *
 * @throws If the HTTP request fails or returns a non-OK status.
 *         The caller (alertDispatcher.ts → withRetry) handles the throw.
 *
 * @param alert - Internal Alert instance from evaluateAlerts().
 */
export async function sendWebhookAlert(alert: Alert): Promise<void> {
  const webhookUrl = process.env.NEXT_PUBLIC_ALERT_WEBHOOK_URL;

  if (!webhookUrl) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[webhook] NEXT_PUBLIC_ALERT_WEBHOOK_URL is not set — skipping webhook delivery.',
      );
    }
    return; // No-op, not an error.
  }

  const formatted = formatAlert(alert);
  const envelope  = _buildWebhookPayload(formatted);
  const body      = JSON.stringify(envelope);

  const headers: Record<string, string> = {
    'Content-Type':    'application/json',
    'User-Agent':      'HireRise-AlertDispatcher/1.0',
    'Idempotency-Key': alert.id,   // prevent duplicate side-effects on retry
  };

  // Sign the payload if a secret is configured.
  const secret    = process.env.NEXT_PUBLIC_ALERT_WEBHOOK_SECRET;
  if (secret) {
    const sig = await _signPayload(body, secret);
    if (sig) {
      headers['X-Alert-Signature'] = sig;
    }
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const err = new Error(`Webhook returned ${response.status}`);
    (err as Error & { status: number }).status = response.status;
    throw err;
  }
}