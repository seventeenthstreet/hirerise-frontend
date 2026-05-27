/**
 * @file lib/actions/handlers/internalAction.ts
 * @description Internal job signal handler for scale and restart actions.
 *
 * PURPOSE:
 *   Handles 'scale' and 'restart' actions by posting to an internal
 *   API endpoint. This decouples the action engine from any specific
 *   orchestration layer (BullMQ, k8s, custom job runner) — the endpoint
 *   receives the signal and acts appropriately.
 *
 * CONFIGURATION:
 *   NEXT_PUBLIC_INTERNAL_ACTION_URL — base URL for the internal action endpoint.
 *   When absent: silent no-op. No config = no internal actions.
 *
 * CONTRACT:
 *   - No-op when NEXT_PUBLIC_INTERNAL_ACTION_URL is absent.
 *   - Throws on network/5xx — retry layer handles it.
 *   - Validates action.type is 'scale' or 'restart' before calling.
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

function _getInternalUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_INTERNAL_ACTION_URL;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Post a scale or restart signal to the internal action endpoint.
 *
 * @throws On network/5xx — retry layer handles it.
 *         Silent no-op when config is absent or action type is not handled.
 */
export async function handleInternalAction(action: Action): Promise<void> {
  // Only handle internal action types
  if (action.type !== 'scale' && action.type !== 'restart') return;

  const baseUrl = _getInternalUrl();

  if (!baseUrl) {
    if (isDevelopment) {
      console.debug(
        `[internalAction] No internal URL configured — skipping ${action.type} for ${action.target}.`,
      );
    }
    return;
  }

  const url  = `${baseUrl}/actions/${action.type}`;
  const body = JSON.stringify({
    actionId: action.id,
    target:   action.target,
    severity: action.severity,
    payload:  action.payload ?? {},
    firedAt:  Date.now(),
  });

  const response = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `[internalAction] HTTP ${response.status} for ${action.type} → ${action.target}`,
    );
  }

  if (isDevelopment) {
    console.debug(
      `[internalAction] ${action.type.toUpperCase()} dispatched → ${action.target} (action=${action.id})`,
    );
  }
}