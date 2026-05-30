/**
 * components/shared/UpgradeBanner.tsx
 *
 * Soft quota warning banner. Shown when quota.remaining < 5 but not yet
 * exhausted. Does NOT replace the full quota-exhausted screen.
 */

import React from 'react';

interface UpgradeBannerProps {
  remaining: number;
  upgradeUrl?: string;
}

export function UpgradeBanner({ remaining, upgradeUrl = '/pricing' }: UpgradeBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
    >
      <p className="text-sm text-amber-800">
        You have{' '}
        <strong>{remaining}</strong>{' '}
        {remaining === 1 ? 'use' : 'uses'} remaining on your current plan.
      </p>
      <a
        href={upgradeUrl}
        className="ml-4 flex-shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
      >
        Upgrade
      </a>
    </div>
  );
}