/**
 * @file lib/actions/handlers/slackAction.ts
 * @description Slack delivery handler for action notifications.
 *
 * MIRRORS: lib/channels/slack.ts — same env-guard + throw-on-failure pattern.
 *
 * CONFIGURATION:
 *   NEXT_PUBLIC_SLACK_ACTION_WEBHOOK_URL — Incoming Webhook URL for action alerts.
 *   Uses a SEPARATE env var from the alert Slack webhook so action and alert
 *   notifications can be routed to different channels independently.
 *
 *   Falls back to NEXT_PUBLIC_SLACK_ALERT_WEBHOOK_URL when the action-specific
 *   var is absent — allows zero-config reuse of the existing alert channel.
 *
 * CONTRACT:
 *   - No-op (silent) when no webhook URL is configured.
 *   - Throws on network/5xx failure → retry layer in actionDispatcher handles it.
 *   - Never throws on missing config — that is a silent no-op, not an error.
 *
 * SCOPE:
 *   Internal — consumed only by actionDispatcher.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

import type { Action } from '../types';
import { isDevelopment } from '@/lib/utils/env';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

function _getWebhookUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SLACK_ACTION_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_SLACK_ALERT_WEBHOOK_URL
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK KIT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  high:   '🔴',
  medium: '🟡',
  low:    '🔵',
};

function _buildBlocks(action: Action): unknown[] {
  const emoji   = SEVERITY_EMOJI[action.severity] ?? '⚪';
  const title   = `${emoji} Action: ${action.type.toUpperCase()} — ${action.target}`;
  const payload = action.payload ?? {};

  const fields: string[] = [
    `*Action ID:* \`${action.id}\``,
    `*Severity:* ${action.severity}`,
    `*Target:* ${action.target}`,
  ];

  if (payload['metric'])  fields.push(`*Metric:* ${payload['metric']}`);
  if (payload['message']) fields.push(`*Message:* ${payload['message']}`);
  if (payload['recommendation']) {
    fields.push(`*Recommendation:* ${payload['recommendation']}`);
  }

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: title, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: fields.join('\n') },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Fired at <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} {time}|${new Date().toISOString()}>`,
        },
      ],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deliver an action notification to Slack.
 *
 * @throws When the HTTP call fails (network/5xx) — let the retry layer handle it.
 *         Does NOT throw when config is absent (silent no-op).
 */
export async function handleSlackAction(action: Action): Promise<void> {
  const url = _getWebhookUrl();

  if (!url) {
    if (isDevelopment) {
      console.debug('[slackAction] No webhook URL configured — skipping.');
    }
    return; // Silent no-op
  }

  const body = JSON.stringify({ blocks: _buildBlocks(action) });

  const response = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    // 400/401/403 are non-retryable — throw with a descriptive message.
    // withRetry()'s isRetryable() classifier will decide whether to retry.
    throw new Error(
      `[slackAction] HTTP ${response.status} for action ${action.id}`,
    );
  }
}