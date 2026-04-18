'use client';

// features/admin/marketIntelligence/components/MarketDataSources.tsx
//
// Dashboard panel showing configured market data sources,
// connection status, and last sync time.

import { useMarketDataSources, useFetchMarketDemand } from '../hooks/useMarketIntelligence';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';
import type { DataSource } from '@/services/marketIntelligenceService';

function StatusBadge({ status }: { status: DataSource['status'] }) {
  const styles = {
    connected:       'bg-green-50 text-green-700 border-green-200',
    not_configured:  'bg-surface-50 text-surface-500 border-surface-200',
    error:           'bg-red-50 text-red-600 border-red-200',
  } as const;

  const labels = {
    connected:      'Connected',
    not_configured: 'Not Configured',
    error:          'Error',
  } as const;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-surface-300'}`} />
      {labels[status]}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function MarketDataSources() {
  const { data, isLoading, isError, refetch } = useMarketDataSources();
  const fetchDemand = useFetchMarketDemand();
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  const sources = data?.sources ?? [];

  const handleRefresh = async () => {
    try {
      await fetchDemand.mutateAsync({ role: 'Software Engineer', country: 'in' });
      await refetch();
      setRefreshToast('Market data refreshed.');
      setTimeout(() => setRefreshToast(null), 3500);
    } catch {
      setRefreshToast('Refresh failed. Check API configuration.');
      setTimeout(() => setRefreshToast(null), 4000);
    }
  };

  return (
    <div className="rounded-xl border border-surface-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
            <svg className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-900">Market Data Sources</h3>
            <p className="text-xs text-surface-500 mt-0.5">Configured API providers and sync status</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          loading={fetchDemand.isPending}
          leftIcon={
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        >
          Refresh Data
        </Button>
      </div>

      {/* Content */}
      <div className="p-5">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load data sources. Please refresh.
          </div>
        )}

        {!isLoading && !isError && sources.length === 0 && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-100">
              <svg className="h-5 w-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-sm font-medium text-surface-500">No data sources configured</p>
            <p className="mt-1 text-xs text-surface-400">
              Configure an API provider in the Secret Manager section above.
            </p>
          </div>
        )}

        {!isLoading && sources.length > 0 && (
          <div className="space-y-3">
            {sources.map((source, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-xl border border-surface-100
                bg-surface-50/50 px-4 py-3.5 hover:bg-surface-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-surface-200 shadow-sm">
                    <svg className="h-3.5 w-3.5 text-hr-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{source.name}</p>
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      Last Sync: {formatDate(source.lastSync)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {source.recordCount > 0 && (
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold text-surface-700">{source.recordCount.toLocaleString()}</p>
                      <p className="text-[10px] text-surface-400">records</p>
                    </div>
                  )}
                  <StatusBadge status={source.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {refreshToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border
          border-surface-200 bg-white px-4 py-3 shadow-lg animate-slide-up">
          <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-surface-800">{refreshToast}</span>
        </div>
      )}
    </div>
  );
}