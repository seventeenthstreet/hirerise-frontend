'use client';

// features/admin/marketIntelligence/components/MarketApiConfigPanel.tsx
//
// Admin UI for configuring Market Intelligence API providers.
// Credentials are submitted to the backend and stored in Secret Manager ONLY.
// No credentials are stored in state longer than the form session.

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useSaveMarketConfig, useTestMarketConnection } from '../hooks/useMarketIntelligence';
import type { MarketApiProvider } from '@/services/marketIntelligenceService';

// ─── Field components ─────────────────────────────────────────────────────────

function FormField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  hint,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-surface-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm
          text-surface-900 placeholder-surface-400 shadow-sm
          focus:border-hr-400 focus:outline-none focus:ring-2 focus:ring-hr-200
          transition-colors"
      />
      {hint && <p className="text-[11px] text-surface-400">{hint}</p>}
    </div>
  );
}

// ─── Connection test result ────────────────────────────────────────────────────

function TestResult({
  result,
}: {
  result: { connected: boolean; message: string; job_postings?: number; provider?: string } | null;
}) {
  if (!result) return null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        result.connected
          ? 'border-green-200 bg-green-50'
          : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            result.connected ? 'bg-green-500' : 'bg-red-500'
          }`}
        >
          {result.connected ? (
            <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div>
          <p className={`text-sm font-semibold ${result.connected ? 'text-green-800' : 'text-red-800'}`}>
            {result.connected ? 'Connection Successful' : 'Connection Failed'}
          </p>
          <p className={`mt-0.5 text-xs ${result.connected ? 'text-green-700' : 'text-red-700'}`}>
            {result.message}
          </p>
          {result.connected && result.job_postings != null && (
            <p className="mt-1 text-xs font-mono text-green-700">
              Job postings detected: {result.job_postings.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketApiConfigPanel() {
  const [provider, setProvider] = useState<MarketApiProvider>('adzuna');

  // Adzuna fields
  const [adzunaAppId,  setAdzunaAppId]  = useState('');
  const [adzunaAppKey, setAdzunaAppKey] = useState('');
  const [adzunaCountry, setAdzunaCountry] = useState('in');

  // SerpAPI fields
  const [serpApiKey,      setSerpApiKey]      = useState('');
  const [serpSearchEngine, setSerpSearchEngine] = useState('google_jobs_listing');

  // Custom API fields
  const [customBaseUrl,  setCustomBaseUrl]  = useState('');
  const [customApiKey,   setCustomApiKey]   = useState('');
  const [customAuthType, setCustomAuthType] = useState<'bearer' | 'apikey' | 'basic'>('bearer');

  const [testResult, setTestResult] = useState<{
    connected: boolean; message: string; job_postings?: number;
  } | null>(null);

  const [saveToast, setSaveToast] = useState<string | null>(null);

  const saveMutation = useSaveMarketConfig();
  const testMutation = useTestMarketConnection();

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleSave = async () => {
    try {
      let config: Parameters<typeof saveMutation.mutateAsync>[0];

      if (provider === 'adzuna') {
        config = { provider: 'adzuna', appId: adzunaAppId, appKey: adzunaAppKey, country: adzunaCountry };
      } else if (provider === 'serpapi') {
        config = { provider: 'serpapi', apiKey: serpApiKey, searchEngine: serpSearchEngine };
      } else {
        config = { provider: 'custom', baseUrl: customBaseUrl, apiKey: customApiKey, authType: customAuthType };
      }

      const result = await saveMutation.mutateAsync(config);
      showToast(result.message ?? 'Configuration saved to Secret Manager.');
      setTestResult(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration.';
      showToast(`Error: ${msg}`);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync();
      setTestResult({
        connected:    result.connected,
        message:      result.message,
        job_postings: result.job_postings,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed.';
      setTestResult({ connected: false, message: msg });
    }
  };

  const isSaving  = saveMutation.isPending;
  const isTesting = testMutation.isPending;

  return (
    <div className="rounded-xl border border-surface-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-surface-100 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-hr-50">
          <svg className="h-4.5 w-4.5 text-hr-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-surface-900">Market Intelligence API Configuration</h3>
          <p className="text-xs text-surface-500 mt-0.5">
            Credentials are stored in Secret Manager — never in Firestore or logs.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Provider selector */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-700">
            API Provider <span className="text-red-500">*</span>
          </label>
          <select
            value={provider}
            onChange={e => {
              setProvider(e.target.value as MarketApiProvider);
              setTestResult(null);
            }}
            className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm
              text-surface-900 shadow-sm focus:border-hr-400 focus:outline-none focus:ring-2
              focus:ring-hr-200 transition-colors"
          >
            <option value="adzuna">Adzuna</option>
            <option value="serpapi">SerpAPI</option>
            <option value="custom">Custom API</option>
          </select>
        </div>

        {/* ── Adzuna fields ── */}
        {provider === 'adzuna' && (
          <div className="space-y-4 rounded-xl border border-surface-100 bg-surface-50/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                Adzuna Configuration
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="App ID"
                id="adzuna-app-id"
                value={adzunaAppId}
                onChange={setAdzunaAppId}
                placeholder="a1b2c3d4"
                required
                hint="Found in your Adzuna developer dashboard"
              />
              <FormField
                label="App Key"
                id="adzuna-app-key"
                type="password"
                value={adzunaAppKey}
                onChange={setAdzunaAppKey}
                placeholder="••••••••••••••••"
                required
                hint="Write-only — stored encrypted in Secret Manager"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="adzuna-country" className="block text-sm font-medium text-surface-700">
                Country
              </label>
              <select
                id="adzuna-country"
                value={adzunaCountry}
                onChange={e => setAdzunaCountry(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm
                  text-surface-900 shadow-sm focus:border-hr-400 focus:outline-none focus:ring-2
                  focus:ring-hr-200 transition-colors"
              >
                <option value="in">India (in)</option>
                <option value="gb">United Kingdom (gb)</option>
                <option value="us">United States (us)</option>
                <option value="au">Australia (au)</option>
                <option value="ca">Canada (ca)</option>
                <option value="de">Germany (de)</option>
                <option value="sg">Singapore (sg)</option>
              </select>
              <p className="text-[11px] text-surface-400">Default country for job market queries</p>
            </div>
          </div>
        )}

        {/* ── SerpAPI fields ── */}
        {provider === 'serpapi' && (
          <div className="space-y-4 rounded-xl border border-surface-100 bg-surface-50/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                SerpAPI Configuration
              </span>
            </div>
            <FormField
              label="API Key"
              id="serp-api-key"
              type="password"
              value={serpApiKey}
              onChange={setSerpApiKey}
              placeholder="••••••••••••••••••••••••••••••••"
              required
              hint="Write-only — stored encrypted in Secret Manager"
            />
            <div className="space-y-1.5">
              <label htmlFor="serp-engine" className="block text-sm font-medium text-surface-700">
                Search Engine
              </label>
              <select
                id="serp-engine"
                value={serpSearchEngine}
                onChange={e => setSerpSearchEngine(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm
                  text-surface-900 shadow-sm focus:border-hr-400 focus:outline-none focus:ring-2
                  focus:ring-hr-200 transition-colors"
              >
                <option value="google_jobs_listing">Google Jobs (default)</option>
                <option value="google">Google Search</option>
                <option value="bing">Bing</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Custom API fields ── */}
        {provider === 'custom' && (
          <div className="space-y-4 rounded-xl border border-surface-100 bg-surface-50/50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">
                Custom API Configuration
              </span>
            </div>
            <FormField
              label="API Base URL"
              id="custom-base-url"
              value={customBaseUrl}
              onChange={setCustomBaseUrl}
              placeholder="https://api.example.com/v1/jobs"
              required
              hint="The base endpoint for job market queries"
            />
            <FormField
              label="API Key"
              id="custom-api-key"
              type="password"
              value={customApiKey}
              onChange={setCustomApiKey}
              placeholder="••••••••••••••••"
              required
              hint="Write-only — stored encrypted in Secret Manager"
            />
            <div className="space-y-1.5">
              <label htmlFor="custom-auth-type" className="block text-sm font-medium text-surface-700">
                Authentication Type
              </label>
              <select
                id="custom-auth-type"
                value={customAuthType}
                onChange={e => setCustomAuthType(e.target.value as 'bearer' | 'apikey' | 'basic')}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm
                  text-surface-900 shadow-sm focus:border-hr-400 focus:outline-none focus:ring-2
                  focus:ring-hr-200 transition-colors"
              >
                <option value="bearer">Bearer Token (Authorization: Bearer …)</option>
                <option value="apikey">API Key Header (X-API-Key: …)</option>
                <option value="basic">HTTP Basic Auth</option>
              </select>
            </div>
          </div>
        )}

        {/* Test result */}
        <TestResult result={testResult} />

        {/* Security notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-100 bg-amber-50 px-3.5 py-2.5">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            <strong>Security:</strong> Credentials are encrypted and stored in Secret Manager only.
            They are never written to Firestore, returned in API responses, or visible in logs.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1 gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            loading={isTesting}
            disabled={isSaving}
            leftIcon={
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
          >
            {isTesting ? 'Testing…' : 'Test API Connection'}
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            loading={isSaving}
            disabled={isTesting}
            leftIcon={
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            }
          >
            {isSaving ? 'Saving…' : 'Save Configuration'}
          </Button>
        </div>
      </div>

      {/* Toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border
          border-green-200 bg-white px-4 py-3 shadow-lg shadow-surface-900/10 animate-slide-up">
          <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-surface-800">{saveToast}</span>
        </div>
      )}
    </div>
  );
}