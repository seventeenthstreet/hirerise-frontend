// hooks/usePersonalization.ts
// TanStack Query hooks for the AI Personalization Engine.
// Follows existing patterns from useJobMatches.ts and useSkillGraph.ts.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalStrength = 'none' | 'low' | 'medium' | 'high' | 'very_high';

export type EventType =
  | 'job_click' | 'job_apply' | 'job_save'
  | 'skill_view' | 'skill_search'
  | 'course_view' | 'learning_path_start'
  | 'career_path_view' | 'role_explore'
  | 'opportunity_click'
  | 'dashboard_module_usage'
  | 'advice_read' | 'salary_check';

export type EntityType = 'role' | 'skill' | 'course' | 'module' | 'path' | 'job' | 'opportunity';

export interface BehaviorEvent {
  event_type:   EventType;
  entity_type?: EntityType;
  entity_id?:   string;
  entity_label?: string;
  metadata?:    Record<string, unknown>;
  session_id?:  string;
}

export interface ScoreBreakdown {
  behavior_signals:  number;
  skill_alignment:   number;
  opportunity_score: number;
  market_demand:     number;
}

export interface PersonalizedRole {
  role:             string;
  score:            number;
  industry:         string | null;
  average_salary:   string | null;
  match_reason:     string;
  breakdown:        ScoreBreakdown;
}

export interface PersonalizedRecommendationsData {
  user_id:               string;
  personalized_roles:    PersonalizedRole[];
  personalization_score: number;
  signal_strength:       SignalStrength;
  total_events_analyzed: number;
  profile_completeness:  number;
  has_personalization:   boolean;
  score_breakdown:       ScoreBreakdown;
  generated_at:          string;
  _cached?:              boolean;
}

export interface PreferredRole {
  name:        string;
  score:       number;
  click_count: number;
  apply_count: number;
}

export interface PreferredSkill {
  name:       string;
  score:      number;
  view_count: number;
}

export interface CareerInterest {
  industry: string;
  score:    number;
}

export interface PersonalizationProfile {
  user_id:              string;
  has_profile:          boolean;
  preferred_roles:      PreferredRole[];
  preferred_skills:     PreferredSkill[];
  career_interests:     CareerInterest[];
  active_modules:       string[];
  engagement_score:     number;
  total_events:         number;
  profile_completeness: number;
  updated_at?:          string;
  message?:             string;
}

// ─── usePersonalizedRecommendations ──────────────────────────────────────────

/**
 * Fetch personalized career recommendations.
 * Stale time matches the 10-minute Redis TTL on the backend.
 */
export function usePersonalizedRecommendations(topN = 10, forceRefresh = false) {
  return useQuery<PersonalizedRecommendationsData>({
    queryKey: ['personalization', 'recommendations', topN],
    queryFn: () =>
      apiFetch<PersonalizedRecommendationsData>(
        `/career/personalized-recommendations?topN=${topN}${forceRefresh ? '&forceRefresh=true' : ''}`
      ),
    staleTime: 8 * 60 * 1000,    // 8 min — just under 10-min backend TTL
    gcTime:    15 * 60 * 1000,
    retry: 1,
  });
}

// ─── usePersonalizationProfile ────────────────────────────────────────────────

export function usePersonalizationProfile() {
  return useQuery<PersonalizationProfile>({
    queryKey: ['personalization', 'profile'],
    queryFn: () => apiFetch<PersonalizationProfile>('/user/personalization-profile'),
    staleTime: 8 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
    retry: 1,
  });
}

// ─── useTrackBehaviorEvent ────────────────────────────────────────────────────

/**
 * Mutation hook for tracking user behavior events.
 * Fire-and-forget pattern — errors are silenced (tracking is non-blocking).
 *
 * Usage:
 *   const { trackEvent } = useTrackBehaviorEvent();
 *   trackEvent({ event_type: 'job_click', entity_type: 'role', entity_id: 'data_analyst', entity_label: 'Data Analyst' });
 */
export function useTrackBehaviorEvent() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (event: BehaviorEvent) =>
      apiFetch('/user/behavior-event', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(event),
      }),
    onSuccess: (data: any) => {
      // If profile was updated, invalidate recommendations cache
      if (data?.data?.queued_profile_update) {
        queryClient.invalidateQueries({ queryKey: ['personalization'] });
      }
    },
    onError: () => {
      // Silently fail — behavior tracking should never break UX
    },
  });

  return {
    trackEvent: (event: BehaviorEvent) => {
      mutation.mutate(event);
    },
    isTracking: mutation.isPending,
  };
}

// ─── useTriggerProfileUpdate ──────────────────────────────────────────────────

export function useTriggerProfileUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch('/user/update-behavior-profile', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
    },
  });
}

// ─── Helper: Signal strength display ─────────────────────────────────────────

export function getSignalStrengthLabel(strength: SignalStrength): string {
  const labels: Record<SignalStrength, string> = {
    none:      'No data yet',
    low:       'Building profile…',
    medium:    'Learning your preferences',
    high:      'Well personalised',
    very_high: 'Highly personalised',
  };
  return labels[strength] || 'Building profile…';
}

export function getSignalStrengthColor(strength: SignalStrength): string {
  const colors: Record<SignalStrength, string> = {
    none:      'text-surface-400',
    low:       'text-amber-500',
    medium:    'text-blue-500',
    high:      'text-emerald-500',
    very_high: 'text-violet-600',
  };
  return colors[strength] || 'text-surface-400';
}
