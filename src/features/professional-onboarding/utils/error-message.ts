/**
 * @file src/features/professional-onboarding/utils/error-message.ts
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Maps an `ApiClientError` (or unknown thrown value) to a short, user-facing
 * message for the Guided Builder step forms. Branches on `err.category`
 * only — never on `err.code` — per the UI rule documented on
 * `ApiClientError` itself (lib/api/core/api-error.ts).
 *
 * Field-level validation messages (from `err.details`) are handled
 * separately by each step form, since the field-error shape is
 * section-specific; this helper only covers the form-level banner message.
 */

import { isApiClientError } from '@/lib/api/core';

export function getGuidedBuilderErrorMessage(error: unknown): string {
  if (!isApiClientError(error)) {
    return 'Something went wrong. Please try again.';
  }

  switch (error.category) {
    case 'validation':
      return error.message || 'Please check the highlighted fields and try again.';
    case 'auth':
      return 'Your session has expired. Please sign in again.';
    case 'rate_limit':
      return 'You are making changes too quickly. Please wait a moment and try again.';
    case 'tier_gate':
      return 'This action is not available on your current plan.';
    case 'network':
      return 'Could not reach the server. Check your connection and try again.';
    case 'server':
      return 'Something went wrong on our end. Please try again.';
    case 'not_found':
      return 'We could not find what you were looking for.';
    case 'conflict':
      return 'This information was already updated elsewhere. Please refresh and try again.';
    case 'cancelled':
      return '';
    case 'system':
    default:
      return 'Something went wrong. Please try again.';
  }
}
