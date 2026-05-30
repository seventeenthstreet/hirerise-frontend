/**
 * hooks/onboarding/useOnboardingQuota.ts
 *
 * Quota gate helper for onboarding flows.
 *
 * HOOK ORDERING NOTE:
 *   Call useOnboardingQuota() FIRST (gets openQuotaModal).
 *   Then call useQuota(user, { onQuotaExhausted: openQuotaModal }).
 *   Pass live quota into checkQuota(quota) at each call site.
 *
 *   This avoids the circular dep where useQuota needs openQuotaModal
 *   before it is defined.
 */

import { useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface QuotaState {
  isExhausted: boolean;
  upgradeUrl?: string | null;
}

export interface UseOnboardingQuotaReturn {
  quotaModalOpen: boolean;
  upgradeUrl: string | null;
  openQuotaModal: (url?: string | null) => void;
  closeQuotaModal: () => void;
  checkQuota: (quota: QuotaState | null | undefined) => boolean;
  handleApiError: (err: unknown) => boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useOnboardingQuota(): UseOnboardingQuotaReturn {
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);

  const openQuotaModal = useCallback((url?: string | null) => {
    setUpgradeUrl(url ?? '/pricing');
    setQuotaModalOpen(true);
  }, []);

  const closeQuotaModal = useCallback(() => {
    setQuotaModalOpen(false);
  }, []);

  const checkQuota = useCallback(
    (quota: QuotaState | null | undefined): boolean => {
      if (!quota?.isExhausted) return false;
      openQuotaModal(quota.upgradeUrl);
      return true;
    },
    [openQuotaModal],
  );

  const handleApiError = useCallback(
    (err: unknown): boolean => {
      const apiErr = err as {
        status?: number;
        quotaExhausted?: boolean;
        upgradeUrl?: string;
      };
      if (apiErr?.status === 429 || apiErr?.quotaExhausted) {
        openQuotaModal(apiErr.upgradeUrl);
        return true;
      }
      return false;
    },
    [openQuotaModal],
  );

  return {
    quotaModalOpen,
    upgradeUrl,
    openQuotaModal,
    closeQuotaModal,
    checkQuota,
    handleApiError,
  };
}
