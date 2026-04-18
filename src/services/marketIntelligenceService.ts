// services/marketIntelligenceService.ts
//
// Client-side API calls for Market Intelligence configuration.
//
// SECURITY: Credentials are write-only. This service only sends them
// to the backend and never stores or logs them client-side.
//
// All values are send to backend → stored in Secret Manager only.

import { apiFetch } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketApiProvider = 'adzuna' | 'serpapi' | 'custom';

export interface AdzunaConfig {
  provider: 'adzuna';
  appId: string;
  appKey: string;
  country?: string;
}

export interface SerpApiConfig {
  provider: 'serpapi';
  apiKey: string;
  searchEngine?: string;
}

export interface CustomApiConfig {
  provider: 'custom';
  baseUrl: string;
  apiKey: string;
  authType?: 'bearer' | 'apikey' | 'basic';
}

export type MarketApiConfig = AdzunaConfig | SerpApiConfig | CustomApiConfig;

export interface SaveConfigResponse {
  provider: string;
  savedAt: string;
  message: string;
}

export interface TestConnectionResponse {
  connected: boolean;
  provider?: string;
  job_postings?: number;
  salary_median?: number | null;
  message: string;
  error?: string;
  testedAt?: string;
}

export interface MarketApiStatus {
  provider: string | null;
  isConfigured: boolean;
  lastSync: string | null;
}

export interface DataSource {
  name: string;
  provider: string | null;
  isConfigured: boolean;
  status: 'connected' | 'not_configured' | 'error';
  lastSync: string | null;
  recordCount: number;
}

export interface FetchDemandResponse {
  role: string;
  country: string;
  job_postings: number;
  salary_median: number | null;
  growth_rate: number | null;
  remote_ratio: number;
  provider: string;
  fetchedAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const marketIntelligenceService = {

  /**
   * Save API configuration to Secret Manager via backend.
   * Credentials are write-only — never stored in frontend state beyond the form.
   */
  saveConfig(config: MarketApiConfig): Promise<SaveConfigResponse> {
    return apiFetch<SaveConfigResponse>('/admin/market-intelligence/config', {
      method: 'POST',
      body:   JSON.stringify(config),
    });
  },

  /**
   * Test the configured API connection.
   * Returns aggregated counts only, not raw API credentials.
   */
  testConnection(): Promise<TestConnectionResponse> {
    return apiFetch<TestConnectionResponse>('/admin/market-intelligence/test', {
      method: 'POST',
    });
  },

  /**
   * Get current provider name and last sync time.
   * Safe for display — no credentials included.
   */
  getStatus(): Promise<MarketApiStatus> {
    return apiFetch<MarketApiStatus>('/admin/market-intelligence/status');
  },

  /**
   * Get data sources for the admin dashboard panel.
   */
  getDataSources(): Promise<{ sources: DataSource[] }> {
    return apiFetch<{ sources: DataSource[] }>('/admin/market-intelligence/data-sources');
  },

  /**
   * Manually trigger a demand fetch for a specific role.
   */
  fetchDemand(role: string, country = 'in'): Promise<FetchDemandResponse> {
    return apiFetch<FetchDemandResponse>('/admin/market-intelligence/fetch', {
      method: 'POST',
      body:   JSON.stringify({ role, country }),
    });
  },
};