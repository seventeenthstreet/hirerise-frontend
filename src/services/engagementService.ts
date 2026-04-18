/**
 * services/engagementService.ts
 *
 * Frontend API client for the Daily Engagement System.
 * Typed wrappers for all seven endpoints across the three modules.
 *
 * All methods:
 *   - Automatically attach the Supabase JWT token as Bearer auth
 *   - Throw descriptive errors on non-2xx responses
 *   - Are fully typed end-to-end
 */

// Uses the central apiClient for all requests — Supabase JWT injection
// is handled there automatically via getAuthToken() from @/lib/auth.
import { apiFetch as _apiFetch } from '@/services/apiClient';

// ─── Local apiFetch wrapper ───────────────────────────────────────────────────
// Strips the /api/v1 prefix that apiClient adds, since this service already
// uses full paths like /api/v1/career/...
// We re-export as apiFetch for internal use unchanged.
async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // apiClient.apiFetch expects a path WITHOUT /api/v1 prefix
  const strippedPath = path.startsWith('/api/v1') ? path.slice(7) : path;
  return _apiFetch<T>(strippedPath, init as import('@/services/apiClient').FetchOptions);
}

// ══════════════════════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type InsightType =
  | 'skill_demand'
  | 'job_match'
  | 'market_trend'
  | 'opportunity_signal'
  | 'risk_alert'
  | 'salary_update';

export type SourceEngine =
  | 'labor_market_intelligence'
  | 'opportunity_radar'
  | 'job_matching'
  | 'career_risk_predictor'
  | 'skill_graph'
  | 'career_digital_twin';

export type AlertType =
  | 'job_match'
  | 'skill_demand'
  | 'career_opportunity'
  | 'salary_trend'
  | 'risk_warning'
  | 'market_shift';

export type AlertPriority = 1 | 2 | 3 | 4 | 5;

// ─── Insight ──────────────────────────────────────────────────────────────────

export interface CareerInsight {
  id:            string;
  user_id:       string;
  insight_type:  InsightType;
  title:         string;
  description:   string;
  source_engine: SourceEngine;
  payload:       Record<string, unknown>;
  is_read:       boolean;
  priority:      number;
  created_at:    string;
}

export interface InsightsFeedResult {
  insights:     CareerInsight[];
  unread_count: number;
  cached:       boolean;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export interface ProgressScores {
  career_health_index: number;
  skills_count:        number;
  job_match_score:     number;
  recorded_at?:        string;
}

export interface ProgressImprovement {
  career_health_index: string | null;  // "+7", "-2", "0"
  skills_count:        string | null;
  job_match_score:     string | null;
}

export interface ProgressHistoryPoint {
  recorded_at:         string;
  career_health_index: number;
  skills_count:        number;
  job_match_score:     number;
  trigger_event:       string;
}

export interface ProgressReport {
  current:     ProgressScores | null;
  previous:    ProgressScores | null;
  improvement: ProgressImprovement | null;
  history:     ProgressHistoryPoint[];
  has_data:    boolean;
  cached:      boolean;
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export interface CareerAlert {
  id:             string;
  user_id:        string;
  alert_type:     AlertType;
  title:          string;
  description:    string;
  alert_priority: AlertPriority;
  action_url:     string | null;
  payload:        Record<string, unknown>;
  is_read:        boolean;
  read_at:        string | null;
  created_at:     string;
}

export interface AlertsFeedResult {
  alerts:       CareerAlert[];
  unread_count: number;
  cached:       boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 1 — INSIGHTS
// ══════════════════════════════════════════════════════════════════════════════

export interface GetInsightsOptions {
  limit?:       number;
  offset?:      number;
  unread_only?: boolean;
  type?:        InsightType;
}

/**
 * Fetch the user's daily insight feed.
 * GET /api/v1/career/daily-insights
 */
export async function getInsightsFeed(opts: GetInsightsOptions = {}): Promise<InsightsFeedResult> {
  const params = new URLSearchParams();
  if (opts.limit       != null) params.set('limit',       String(opts.limit));
  if (opts.offset      != null) params.set('offset',      String(opts.offset));
  if (opts.unread_only)         params.set('unread_only', 'true');
  if (opts.type)                params.set('type',        opts.type);

  const qs  = params.toString();
  const res = await apiFetch<{ success: boolean; data: InsightsFeedResult }>(
    `/api/v1/career/daily-insights${qs ? `?${qs}` : ''}`
  );
  return res.data;
}

/**
 * Mark insights as read.
 * POST /api/v1/career/daily-insights/read
 * @param ids — omit to mark ALL as read
 */
export async function markInsightsRead(ids?: string[]): Promise<{ updated: number }> {
  const res = await apiFetch<{ success: boolean; data: { updated: number } }>(
    '/api/v1/career/daily-insights/read',
    { method: 'POST', body: JSON.stringify({ ids: ids ?? [] }) }
  );
  return res.data;
}

/**
 * Trigger insight generation for the current user.
 * POST /api/v1/career/daily-insights/generate
 */
export async function generateInsights(profile?: {
  role?: string; skills?: string[]; industry?: string;
}): Promise<{ insights: CareerInsight[]; count: number }> {
  const res = await apiFetch<{ success: boolean; data: { insights: CareerInsight[]; count: number } }>(
    '/api/v1/career/daily-insights/generate',
    { method: 'POST', body: JSON.stringify(profile ?? {}) }
  );
  return res.data;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 2 — PROGRESS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch the progress report (current + previous + history).
 * GET /api/v1/career/progress
 */
export async function getProgressReport(): Promise<ProgressReport> {
  const res = await apiFetch<{ success: boolean; data: ProgressReport }>(
    '/api/v1/career/progress'
  );
  return res.data;
}

/**
 * Manually record a progress snapshot.
 * POST /api/v1/career/progress/record
 */
export async function recordProgress(data?: {
  chi?: number; skills_count?: number; job_match_score?: number; trigger_event?: string;
}): Promise<{ snapshot: Record<string, unknown> }> {
  const res = await apiFetch<{ success: boolean; data: { snapshot: Record<string, unknown> } }>(
    '/api/v1/career/progress/record',
    { method: 'POST', body: JSON.stringify(data ?? {}) }
  );
  return res.data;
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODULE 3 — ALERTS
// ══════════════════════════════════════════════════════════════════════════════

export interface GetAlertsOptions {
  limit?:       number;
  offset?:      number;
  unread_only?: boolean;
  type?:        AlertType;
}

/**
 * Fetch the user's alert feed.
 * GET /api/v1/career/alerts
 */
export async function getAlertsFeed(opts: GetAlertsOptions = {}): Promise<AlertsFeedResult> {
  const params = new URLSearchParams();
  if (opts.limit       != null) params.set('limit',       String(opts.limit));
  if (opts.offset      != null) params.set('offset',      String(opts.offset));
  if (opts.unread_only)         params.set('unread_only', 'true');
  if (opts.type)                params.set('type',        opts.type);

  const qs  = params.toString();
  const res = await apiFetch<{ success: boolean; data: AlertsFeedResult }>(
    `/api/v1/career/alerts${qs ? `?${qs}` : ''}`
  );
  return res.data;
}

/**
 * Mark alerts as read.
 * POST /api/v1/career/alerts/read
 * @param ids — omit to mark ALL as read
 */
export async function markAlertsRead(
  ids?: string[]
): Promise<{ updated: number; unread_count: number }> {
  const res = await apiFetch<{ success: boolean; data: { updated: number; unread_count: number } }>(
    '/api/v1/career/alerts/read',
    { method: 'POST', body: JSON.stringify({ ids: ids ?? [] }) }
  );
  return res.data;
}