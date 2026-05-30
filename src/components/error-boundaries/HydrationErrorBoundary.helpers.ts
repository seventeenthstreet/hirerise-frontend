/**
 * src/components/error-boundaries/HydrationErrorBoundary.helpers.ts
 *
 * Timeout constant and guard hook for HydrationErrorBoundary.
 * Extracted from HydrationErrorBoundary.tsx for Vite Fast Refresh compatibility.
 */

import React from 'react';
import { logEvent, createEvent } from '@/lib/observability';

/**
 * Total budget for the hydration sequence before we surface an error.
 * warmAppEntry (3 s) + fetchUser (10 s max) = 13 s worst case.
 */
export const HYDRATION_UI_TIMEOUT_MS = 15_000;

/**
 * React hook that fires onTimeout if isHydrated stays false for longer
 * than HYDRATION_UI_TIMEOUT_MS. Clears on hydration success.
 *
 * Place in root layout or any component that wraps the loading spinner.
 */
export function useHydrationTimeoutGuard({
  isHydrated,
  onTimeout,
}: {
  isHydrated: boolean;
  onTimeout:  () => void;
}): void {
  React.useEffect(() => {
    if (isHydrated) return;

    const id = setTimeout(() => {
      onTimeout();
      try {
        logEvent(createEvent({
          type:    'system',
          name:    'HYDRATION_UI_TIMEOUT',
          level:   'warn',
          context: { thresholdMs: HYDRATION_UI_TIMEOUT_MS },
        }));
      } catch { /* never surface */ }
    }, HYDRATION_UI_TIMEOUT_MS);

    return () => clearTimeout(id);
  }, [isHydrated, onTimeout]);
}