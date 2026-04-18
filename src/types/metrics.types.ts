/**
 * metrics.types.ts — HireRise Admin Metrics Type Definitions
 *
 * CHANGED: Removed `import { firestore } from 'firebase-admin'`.
 * Timestamps are ISO 8601 strings — supabaseDbShim.FieldValue.serverTimestamp()
 * returns new Date().toISOString(), so string is the correct type here.
 */

// ─── Collection: usageLogs ────────────────────────────────────────────────────

export type UserTier = 'free' | 'pro' | 'enterprise';

export interface UsageLog {
  userId:       string;
  feature:      string;
  tier:         UserTier;
  model:        string;
  inputTokens:  number;
  outputTokens: number;
  totalTokens:  number;
  costUSD:      number;
  revenueUSD:   number;
  marginUSD:    number;
  createdAt:    string; // ISO 8601 string from supabaseDbShim.FieldValue.serverTimestamp()
}

// ─── Collection: metrics/daily/{YYYY-MM-DD} ───────────────────────────────────

export interface DailyMetricsAggregate {
  date:                string;          // YYYY-MM-DD
  totalUsers:          number;
  activeUsers:         number;
  totalRequests:       number;
  totalTokens:         number;
  totalCostUSD:        number;
  totalRevenueUSD:     number;
  grossMarginUSD:      number;
  grossMarginPercent:  number;
  freeTierCostUSD:     number;
  paidTierCostUSD:     number;
  paidUserCount:       number;
  featureCounts:       Record<string, number>;
  updatedAt:           string; // ISO 8601 string
}

// ─── API Request / Response ───────────────────────────────────────────────────

export type PeriodPreset = '7d' | '30d' | '90d' | '1y';

export interface MetricsQueryParams {
  period?:    PeriodPreset;
  startDate?: string;  // YYYY-MM-DD
  endDate?:   string;  // YYYY-MM-DD
}

export interface TopFeature {
  feature: string;
  count:   number;
}

export interface ModelCostBreakdown {
  model:          string;
  totalCostUSD:   number;
  totalTokens:    number;
  callCount:      number;
  avgCostPerCall: number;
}

export interface HealthAlerts {
  marginHealthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  marginWarning?:     string;
  freeBurnAlert?:     string;
  freeBurnPercent:    number;
}

export interface AdminMetricsResponse {
  period:    string;
  startDate: string;
  endDate:   string;

  // User metrics
  totalUsers:  number;
  activeUsers: number;

  // Volume
  totalRequests: number;
  totalTokens:   number;

  // Financial
  totalCostUSD:       number;
  totalRevenueUSD:    number;
  grossMarginUSD:     number;
  grossMarginPercent: number;

  // Tier breakdown
  freeTierCostUSD: number;
  paidTierCostUSD: number;

  // Per-unit economics
  avgCostPerRequest:     number;
  avgRevenuePerPaidUser: number;

  // Feature analytics
  topFeatures: TopFeature[];

  // Bonus
  modelBreakdown: ModelCostBreakdown[];
  healthAlerts:   HealthAlerts;

  // Meta
  dataSource:  'live' | 'aggregated' | 'hybrid';
  generatedAt: string;
  periodDays:  number;
}

// ─── Internal computation types ───────────────────────────────────────────────

export interface PeriodWindow {
  startDate: Date;
  endDate:   Date;
  label:     string;
  days:      number;
}

export interface CostRow {
  userId:       string;
  feature:      string;
  tier:         UserTier;
  model:        string;
  inputTokens:  number;
  outputTokens: number;
  totalTokens:  number;
  costUSD:      number;
  revenueUSD:   number;
  date:         string;
}

// ─── Model Pricing ────────────────────────────────────────────────────────────

export interface ModelRate {
  input:  number; // USD per 1M tokens
  output: number; // USD per 1M tokens
}

export type ModelPricingMap = Record<string, ModelRate>;