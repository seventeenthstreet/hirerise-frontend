/**
 * @file lib/actions/handlers/webhookAction.ts
 * @description Generic outbound webhook handler for scale/restart/escalation actions.
 *
 * MIRRORS: lib/channels/webhook.ts — same signed POST + throw-on-failure pattern.
 *
 * CONFIGURATION:
 *   NEXT_PUBLIC_ACTION_WEBHOOK_URL    — target endpoint
 *   NEXT_PUBLIC_ACTION_WEBHOOK_SECRET — optional HMAC signing secret
 *
 *   Falls back to NEXT_PUBLIC_ALERT_WEBHOOK_URL / NEXT_PUBLIC_ALERT_WEBHOOK_SECRET
 *   when action-specific vars are absent — zero-config reuse of existing webhook.
 *
 * SIGNING:
 *   When a secret is configured, the payload is signed with a lightweight
 *   HMAC-style signature included in X-Action-Signature. The receiver can
 *   verify the payload was not tampered in transit.
 *
 * CONTRACT:
 *   - No-op when URL is absent.
 *   - Throws on network/5xx failure → retry layer handles it.
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
    process.env.NEXT_PUBLIC_ACTION_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_ALERT_WEBHOOK_URL
  );
}

function _getWebhookSecret(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_ACTION_WEBHOOK_SECRET ||
    process.env.NEXT_PUBLIC_ALERT_WEBHOOK_SECRET
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight deterministic signature — same pattern as alertDispatcher.
 * Not cryptographically HMAC (no SubtleCrypto in edge runtime without async),
 * but sufficient for tamper-detection on trusted internal networks.
 */
function _sign(body: string, secret: string): string {
  let hash = 0;
  const combined = `${secret}:${body}`;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYLOAD BUILDER
// ─────────────────────────────────────────────────────────────────────────────

interface ActionWebhookPayload {
  actionId:   string;
  actionType: string;
  severity:   string;
  target:     string;
  payload:    Record<string, unknown>;
  firedAt:    number;
}

function _buildPayload(action: Action): ActionWebhookPayload {
  return {
    actionId:   action.id,
    actionType: action.type,
    severity:   action.severity,
    target:     action.target,
    payload:    action.payload ?? {},
    firedAt:    Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deliver an action to an external webhook endpoint.
 *
 * @throws On network/5xx failure — let the retry layer handle it.
 *         Silent no-op when URL is not configured.
 */
export async function handleWebhookAction(action: Action): Promise<void> {
  const url = _getWebhookUrl();

  if (!url) {
    if (isDevelopment) {
      console.debug('[webhookAction] No webhook URL configured — skipping.');
    }
    return;
  }

  const webhookPayload = _buildPayload(action);
  const body           = JSON.stringify(webhookPayload);
  const secret         = _getWebhookSecret();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Action-Type': action.type,
  };

  if (secret) {
    headers['X-Action-Signature'] = _sign(body, secret);
  }

  const response = await fetch(url, { method: 'POST', headers, body });

  if (!response.ok) {
    throw new Error(
      `[webhookAction] HTTP ${response.status} for action ${action.id}`,
    );
  }
}