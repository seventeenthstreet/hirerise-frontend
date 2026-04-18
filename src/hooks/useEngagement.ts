/**
 * hooks/useEngagement.ts
 *
 * Unified React hook for the Daily Engagement System.
 * Manages loading / error state for all three modules independently
 * so each dashboard widget can mount without blocking the others.
 *
 * Usage:
 *
 *   // Full hook (all three modules)
 *   const { insights, progress, alerts, actions } = useEngagement();
 *
 *   // Scoped hooks (import individually for code-splitting)
 *   const { insights, actions } = useInsightsFeed();
 *   const { progress }          = useProgressTracker();
 *   const { alerts, actions }   = useAlertsFeed();
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  getInsightsFeed,
  markInsightsRead,
  generateInsights,
  getProgressReport,
  getAlertsFeed,
  markAlertsRead,
  type InsightsFeedResult,
  type ProgressReport,
  type AlertsFeedResult,
} from '@/services/engagementService';

// ─── Module state shape ───────────────────────────────────────────────────────

interface ModuleState<T> {
  data:    T | null;
  loading: boolean;
  error:   string | null;
}

function initState<T>(): ModuleState<T> {
  return { data: null, loading: false, error: null };
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCOPED HOOKS
// ══════════════════════════════════════════════════════════════════════════════

// ─── useInsightsFeed ──────────────────────────────────────────────────────────

export function useInsightsFeed() {
  const [state, setState] = useState<ModuleState<InsightsFeedResult>>(initState());

  const load = useCallback(async (opts?: Parameters<typeof getInsightsFeed>[0]) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await getInsightsFeed(opts);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, []);

  const markRead = useCallback(async (ids?: string[]) => {
    try {
      await markInsightsRead(ids);
      // Optimistically update local read state
      setState(s => {
        if (!s.data) return s;
        const updated = s.data.insights.map(i =>
          !ids || ids.includes(i.id) ? { ...i, is_read: true } : i
        );
        const unread_count = updated.filter(i => !i.is_read).length;
        return { ...s, data: { ...s.data, insights: updated, unread_count } };
      });
    } catch (err) {
      setState(s => ({ ...s, error: (err as Error).message }));
    }
  }, []);

  const refresh = useCallback(async (profile?: Parameters<typeof generateInsights>[0]) => {
    setState(s => ({ ...s, loading: true }));
    try {
      await generateInsights(profile);
      await load(); // re-fetch after generation
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, [load]);

  // Auto-load on mount
  useEffect(() => { load(); }, [load]);

  return {
    insights: state,
    actions: { load, markRead, refresh },
  };
}

// ─── useProgressTracker ───────────────────────────────────────────────────────

export function useProgressTracker() {
  const [state, setState] = useState<ModuleState<ProgressReport>>(initState());

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await getProgressReport();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return {
    progress: state,
    actions: { load },
  };
}

// ─── useAlertsFeed ────────────────────────────────────────────────────────────

export function useAlertsFeed() {
  const [state, setState] = useState<ModuleState<AlertsFeedResult>>(initState());

  const load = useCallback(async (opts?: Parameters<typeof getAlertsFeed>[0]) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await getAlertsFeed(opts);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: (err as Error).message }));
    }
  }, []);

  const markRead = useCallback(async (ids?: string[]) => {
    try {
      const result = await markAlertsRead(ids);
      setState(s => {
        if (!s.data) return s;
        const updated = s.data.alerts.map(a =>
          !ids || ids.includes(a.id) ? { ...a, is_read: true } : a
        );
        return { ...s, data: { ...s.data, alerts: updated, unread_count: result.unread_count } };
      });
    } catch (err) {
      setState(s => ({ ...s, error: (err as Error).message }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return {
    alerts: state,
    actions: { load, markRead },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  UNIFIED HOOK
// ══════════════════════════════════════════════════════════════════════════════

/**
 * useEngagement()
 *
 * Composes all three scoped hooks for pages that need all modules
 * (e.g. the main career dashboard summary row).
 */
export function useEngagement() {
  const { insights, actions: insightActions }   = useInsightsFeed();
  const { progress, actions: progressActions }  = useProgressTracker();
  const { alerts,   actions: alertActions }     = useAlertsFeed();

  const totalUnread =
    (insights.data?.unread_count  ?? 0) +
    (alerts.data?.unread_count    ?? 0);

  return {
    insights,
    progress,
    alerts,
    totalUnread,
    actions: {
      insights: insightActions,
      progress: progressActions,
      alerts:   alertActions,
    },
  };
}
