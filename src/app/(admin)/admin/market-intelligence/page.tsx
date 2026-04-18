'use client';

/**
 * File: src/app/(admin)/admin/market-intelligence/page.tsx
 * Production Ready:
 * - Supabase auth aligned
 * - Firebase wording removed
 * - Master Admin guard retained
 */

import { useState } from 'react';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { MarketApiConfigPanel } from '@/features/admin/marketIntelligence/components/MarketApiConfigPanel';
import { MarketDataSources } from '@/features/admin/marketIntelligence/components/MarketDataSources';
import { MarketAnalytics } from '@/features/admin/marketIntelligence/components/MarketAnalytics';
import { cn } from '@/utils/cn';

function MasterAdminRequired({ children }: { children: React.ReactNode }) {
  const { isMasterAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-hr-600" />
      </div>
    );
  }

  if (!isMasterAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 mb-4">
          <svg className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-surface-900 mb-1">Access Restricted</h2>
        <p className="text-sm text-surface-500 max-w-sm">
          Market Intelligence configuration is only accessible to Master Admins.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

type Tab = 'sources' | 'config' | 'analytics';

const TABS = [
  { id: 'sources', label: 'Market Data Sources' },
  { id: 'config', label: 'API Configuration' },
  { id: 'analytics', label: 'Market Analytics' },
] as const;

export default function MarketIntelligencePage() {
  const [activeTab, setActiveTab] = useState<Tab>('sources');

  return (
    <div className="flex flex-col h-full">
      <AdminTopbar title="Market Intelligence" />

      <div className="flex-1 overflow-y-auto p-6">
        <MasterAdminRequired>

          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-surface-900">Market Intelligence</h2>
            <p className="text-sm text-surface-500 max-w-2xl">
              Securely configure external labor market APIs and fetch real-time demand signals.
              Credentials are stored securely — never in the database, client storage, or logs.
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-5 flex gap-2">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-2 rounded-md text-sm',
                  activeTab === tab.id ? 'bg-white shadow text-black' : 'text-gray-500'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {activeTab === 'sources' && <MarketDataSources />}
          {activeTab === 'config' && <MarketApiConfigPanel />}
          {activeTab === 'analytics' && <MarketAnalytics />}

        </MasterAdminRequired>
      </div>
    </div>
  );
}