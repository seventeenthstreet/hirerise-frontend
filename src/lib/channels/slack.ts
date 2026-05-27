/**
 * @file lib/channels/slack.ts
 * @description Slack webhook delivery channel.
 *
 * PURPOSE:
 *   Delivers a formatted alert to a Slack channel via Incoming Webhook.
 *   Incoming Webhooks are the simplest Slack integration: one POST to a
 *   per-channel URL, no OAuth, no scopes, no bot token required.
 *
 * CONFIGURATION:
 *   NEXT_PUBLIC_SLACK_ALERT_WEBHOOK_URL — the Incoming Webhook URL.
 *   If the env var is absent, sendSlackAlert() is a no-op (logs a dev warning).
 *   This allows the delivery system to run in CI/staging without Slack credentials.
 *
 * PAYLOAD FORMAT:
 *   Slack Block Kit is used for structured display. Blocks give the alert a
 *   visible title, severity badge, metric context, and timestamp.
 *
 * RETRY:
 *   Callers (alertDispatcher.ts) wrap this function with withRetry().
 *   This function throws on network or 5xx failures so the retry wrapper
 *   can catch and retry. It throws immediately on 400/401/403 (non-retryable).
 *
 * SCOPE:
 *   Internal — consumed only by alertDispatcher.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Alert } from '@/lib/alerts';
import { formatAlert }  from './formatAlert';

// ─────────────────────────────────────────────────────────────────────────────
// SEVERITY → EMOJI MAP
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🚨',
  high:     '🔴',
  medium:   '🟡',
  low:      '🔵',
};

// ─────────────────────────────────────────────────────────────────────────────
// SLACK BLOCK KIT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Slack Block Kit payload for an alert.
 * See: https://api.slack.com/block-kit
 *
 * @internal
 */
function _buildSlackPayload(alert: ReturnType<typeof formatAlert>): object {
  const emoji = SEVERITY_EMOJI[alert.severity] ?? '⚠️';

  return {
    text: `${emoji} Alert: ${alert.message}`,  // fallback for notifications
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${alert.severity.toUpperCase()} Alert`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Message*\n${alert.message}`,
          },
          {
            type: 'mrkdwn',
            text: `*Metric*\n\`${alert.metric}\``,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Value*\n${alert.value}`,
          },
          {
            type: 'mrkdwn',
            text: `*Fired At*\n${alert.timestamp}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Alert ID: \`${alert.id}\``,
          },
        ],
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an alert to Slack via Incoming Webhook.
 *
 * @throws If the HTTP request fails or returns a non-OK status.
 *         The caller (alertDispatcher.ts → withRetry) handles the throw.
 *         Non-retryable statuses (400, 401, 403) are thrown immediately;
 *         the retry wrapper classifies them as non-retryable and gives up.
 *
 * @param alert - Internal Alert instance from evaluateAlerts().
 */
export async function sendSlackAlert(alert: Alert): Promise<void> {
  const webhookUrl = process.env.NEXT_PUBLIC_SLACK_ALERT_WEBHOOK_URL;

  if (!webhookUrl) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[slack] NEXT_PUBLIC_SLACK_ALERT_WEBHOOK_URL is not set — skipping Slack delivery.',
      );
    }
    return; // No-op, not an error. Dispatcher continues with other channels.
  }

  const formatted = formatAlert(alert);
  const payload   = _buildSlackPayload(formatted);

  const response = await fetch(webhookUrl, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'Idempotency-Key': alert.id,   // prevent duplicate side-effects on retry
    },
    body:    JSON.stringify(payload),
  });

  if (!response.ok) {
    // Throw with the HTTP status so the retry wrapper can classify it.
    const err = new Error(`Slack webhook returned ${response.status}`);
    (err as Error & { status: number }).status = response.status;
    throw err;
  }
}