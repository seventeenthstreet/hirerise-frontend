/**
 * src/lib/api/endpoints/billing.ts
 *
 * TASK 3 — Stripe Checkout Redirect
 *
 * Thin endpoint wrapper following the existing apiClient pattern.
 * No React Query, no abstractions — just the fetch call.
 */

import { apiClient } from '@/lib/api/client';

export const billingApi = {
  createCheckoutSession: (): Promise<{ url: string }> =>
    apiClient<{ url: string }>({
      url:    '/api/v1/billing/checkout-session',
      method: 'POST',
    }),
} as const;