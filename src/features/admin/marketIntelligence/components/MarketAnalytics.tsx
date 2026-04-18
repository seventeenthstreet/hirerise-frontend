'use client';

// features/admin/marketIntelligence/components/MarketAnalytics.tsx
//
// Demand data refresh panel and basic market analytics display.

import { useState } from 'react';
import { Button }        from '@/components/ui/Button';
import { useFetchMarketDemand } from '../hooks/useMarketIntelligence';
import type { FetchDemandResponse } from '@/services/marketIntelligenceService';

const COUNTRY_OPTIONS = [
  { code: 'in', label: 'India' },
  { code: 'gb', label: 'United Kingdom' },
  { code: 'us', label: 'United States' },
  { code: 'au', label: 'Australia' },
  { code: 'ca', label: 'Canada' },
  { code: 'de', label: 'Germany' },
  { code: 'sg', label: 'Singapore' },
];

const PRESET_ROLES = [
  'Software Engineer',
  'Data Scientist',
  'Product Manager',
  'DevOps Engineer',
  'UX Designer',
  'Machine Learning Engineer',
  'Backend Developer',
  'Frontend Developer',
];

function SignalCard({ label, value, unit, icon }: {
  label: string;
  value: string | number | null;
  unit?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">{label}</p>
        <span className="text-surface-300">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-surface-900">
        {value == null ? (
          <span className="text-sm font-normal text-surface-400 italic">N/A</span>
        ) : (
          <>
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && <span className="ml-1 text-sm font-normal text-surface-400">{unit}</span>}
          </>
        )}
      </p>
    </div>
  );
}

export function MarketAnalytics() {
  const [role,    setRole]    = useState('Software Engineer');
  const [country, setCountry] = useState('in');
  const [result,  setResult]  = useState<FetchDemandResponse | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const fetchMutation = useFetchMarketDemand();

  const handleFetch = async () => {
    setError(null);
    setResult(null);
    try {
      const data = await fetchMutation.mutateAsync({ role, country });
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch demand data.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Demand Data Refresh panel */}
      <div className="rounded-xl border border-surface-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-surface-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
            <svg className="h-4 w-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-900">Demand Data Refresh</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Fetch live job market demand signals for a role
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Role input */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">Role</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm
                    text-surface-900 placeholder-surface-400 shadow-sm focus:border-hr-400
                    focus:outline-none focus:ring-2 focus:ring-hr-200 transition-colors"
                />
              </div>
              {/* Quick presets */}
              <div className="flex flex-wrap gap-1 pt-1">
                {PRESET_ROLES.slice(0, 4).map(r => (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors
                      ${role === r
                        ? 'bg-hr-100 text-hr-700 border border-hr-200'
                        : 'bg-surface-100 text-surface-500 border border-transparent hover:bg-surface-200'
                      }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">Country</label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm
                  text-surface-900 shadow-sm focus:border-hr-400 focus:outline-none focus:ring-2
                  focus:ring-hr-200 transition-colors"
              >
                {COUNTRY_OPTIONS.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleFetch}
            loading={fetchMutation.isPending}
            leftIcon={
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          >
            {fetchMutation.isPending ? 'Fetching…' : 'Fetch Demand Signals'}
          </Button>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Result signals */}
          {result && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                  Market Signals
                </p>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  Live · {result.provider}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SignalCard
                  label="Job Postings"
                  value={result.job_postings}
                  icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                />
                <SignalCard
                  label="Median Salary"
                  value={result.salary_median}
                  unit={result.salary_median ? '/ yr' : undefined}
                  icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                />
                <SignalCard
                  label="Growth Rate"
                  value={result.growth_rate != null ? `${(result.growth_rate * 100).toFixed(1)}%` : null}
                  icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                />
                <SignalCard
                  label="Remote Ratio"
                  value={`${(result.remote_ratio * 100).toFixed(0)}%`}
                  icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                />
              </div>

              <p className="text-[11px] text-surface-400 pt-1">
                Signals stored in Firestore · role_market_demand collection ·
                Fetched at {new Date(result.fetchedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}