// services/avaMemoryService.ts
//
// Typed client for the Ava Memory API.
// All calls go through apiFetch which handles auth tokens and error handling.

import { apiFetch } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvaEventType =
  | 'skill_added'
  | 'resume_improved'
  | 'job_applied'
  | 'score_updated';

export interface AvaNextStep {
  action: string;
  href:   string;
  type:   'skills' | 'resume' | 'jobs' | 'explore';
}

export interface AvaMemoryStats {
  skillsAddedThisWeek: number;
  jobsAppliedThisWeek: number;
  resumeImproved:      boolean;
  weeklyProgress:      number;
  currentScore:        number;
  lastScore:           number;
  daysSinceActive:     number | null;
  isNewUser:           boolean;
}

export interface AvaMemoryContext {
  weeklySummary: string;
  reminder:      string | null;
  nextStep:      AvaNextStep;
  scoreDelta:    string | null;
  stats:         AvaMemoryStats;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Fetch Ava's memory context for the current user.
 * Pass currentScore so the backend can sync asynchronously.
 */
export async function fetchAvaMemory(currentScore?: number): Promise<AvaMemoryContext> {
  const qs = currentScore != null ? `?current_score=${currentScore}` : '';
  const res = await apiFetch<{ data: AvaMemoryContext }>(`/ava-memory${qs}`);
  return res.data;
}

/**
 * Track a career event. Fire-and-forget — never throws.
 */
export async function trackAvaEvent(
  eventType: AvaEventType,
  payload?: { count?: number; score?: number },
): Promise<void> {
  try {
    await apiFetch<void>('/ava-memory/event', {
      method: 'POST',
      body:   JSON.stringify({ event_type: eventType, ...payload }),
    });
  } catch {
    // Non-critical — silently swallow
  }
}

/**
 * Trigger a weekly snapshot for the current user.
 */
export async function triggerWeeklySnapshot(): Promise<void> {
  await apiFetch<void>('/ava-memory/weekly-snapshot', { method: 'POST' });
}