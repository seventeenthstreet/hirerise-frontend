/**
 * @file front/src/modules/student-onboarding/activities/hooks/use-activities.ts
 *
 * REACT QUERY HOOKS — Activities Step (Phase 3B)
 * ──────────────────────────────────────────────
 * Provides the query and mutation hooks for the activities onboarding step.
 *
 * ARCHITECTURE:
 *   API (activities.api.ts) → Hooks (this file) → UI (components)
 *
 * PROGRESSIVE PERSISTENCE:
 *   Every mutation immediately updates the server.
 *   No local draft state is maintained here — the server is the source of truth.
 *   On mutation success, the activities query cache is invalidated.
 *
 * HARDENING (Issue 2B):
 *   useCommitActivities invalidates the session using a user-scoped key via
 *   studentOnboardingQueryKeys.session(userId). This prevents accidental
 *   invalidation of unrelated session queries in future multi-account scenarios.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import * as api from '../api/activities.api';

import { useAppContext }              from '@/context/AppContext';
import { studentOnboardingQueryKeys } from '../../hooks/query-keys';

import type {
  AddActivityInput,
  AddActivityResponse,
  AddAchievementInput,
  AddAchievementResponse,
  CommitActivitiesResponse,
  GetActivitiesResponse,
  SaveReflectionInput,
  SaveReflectionResponse,
  StudentActivity,
  Achievement,
  TaxonomyCategory,
  ActivitySignalQuality,
  UpdateDepthInput,
  UpdateDepthResponse,
} from '../types';

import { ACTIVITY_CATEGORIES, type ActivityCategory } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const ACTIVITIES_QUERY_KEY = ['student-onboarding', 'activities'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS
// Map raw DB shapes → domain layer types for hooks/UI consumption
// ─────────────────────────────────────────────────────────────────────────────

function normalizeActivity(raw: import('../types').DbStudentActivity): StudentActivity {
  return {
    id:               raw.id,
    activityKey:      raw.activity_key,
    activityCategory: raw.activity_category as ActivityCategory,
    proficiencyLevel: raw.proficiency_level as StudentActivity['proficiencyLevel'],
    durationMonths:   raw.duration_months,
    weeklyFrequency:  raw.weekly_frequency,
    currentlyActive:  raw.currently_active,
    leadershipLevel:  raw.leadership_level as StudentActivity['leadershipLevel'],
    isPartial:        raw.is_partial,
    updatedAt:        raw.updated_at,
  };
}

function normalizeAchievement(raw: import('../types').DbAchievement): Achievement {
  return {
    id:                  raw.id,
    studentActivityId:   raw.student_activity_id,
    achievementTitle:    raw.achievement_title,
    achievementLevel:    raw.achievement_level as Achievement['achievementLevel'],
    achievementPosition: raw.achievement_position as Achievement['achievementPosition'],
    achievementYear:     raw.achievement_year,
    createdAt:           raw.created_at,
  };
}

function normalizeTaxonomy(
  rawTaxonomy: GetActivitiesResponse['taxonomy'],
): TaxonomyCategory[] {
  return ACTIVITY_CATEGORIES.map((category) => {
    const group = rawTaxonomy[category];
    if (!group) return { category, activities: [] };
    return {
      category,
      activities: group.activities.map((a) => ({
        activityKey:  a.activity_key,
        displayName:  a.display_name,
        description:  a.description,
        tags:         a.tags,
        displayOrder: a.display_order,
      })),
    };
  });
}

function normalizeSignalQuality(
  raw: GetActivitiesResponse['signal_quality'],
): ActivitySignalQuality {
  return {
    totalCount:      raw.total_count,
    committedCount:  raw.committed_count,
    hasAchievements: raw.has_achievements,
    hasLeadership:   raw.has_leadership,
    isSufficient:    raw.is_sufficient,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivitiesStepData {
  taxonomy:       TaxonomyCategory[];
  activities:     StudentActivity[];
  achievements:   Achievement[];
  signalQuality:  ActivitySignalQuality;
  /** achievements keyed by studentActivityId for O(1) lookup in UI */
  achievementMap: Map<string, Achievement[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// useActivitiesStep()
// Primary query hook. Fetches and normalizes all step data.
// ─────────────────────────────────────────────────────────────────────────────

export function useActivitiesStep(): UseQueryResult<ActivitiesStepData, Error> {
  return useQuery({
    queryKey: ACTIVITIES_QUERY_KEY,
    queryFn:  async ({ signal }) => {
      const res = await api.fetchActivities(signal);

      const taxonomy      = normalizeTaxonomy(res.taxonomy);
      const activities    = res.activities.map(normalizeActivity);
      const achievements  = res.achievements.map(normalizeAchievement);
      const signalQuality = normalizeSignalQuality(res.signal_quality);

      const achievementMap = new Map<string, Achievement[]>();
      for (const ach of achievements) {
        const existing = achievementMap.get(ach.studentActivityId) ?? [];
        achievementMap.set(ach.studentActivityId, [...existing, ach]);
      }

      return {
        taxonomy,
        activities,
        achievements,
        signalQuality,
        achievementMap,
      };
    },
    staleTime: 30_000,
    retry:     1,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useAddActivity()
// ─────────────────────────────────────────────────────────────────────────────

export function useAddActivity(): UseMutationResult<AddActivityResponse, Error, AddActivityInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddActivityInput) => api.addActivity(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useUpdateActivityDepth()
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateActivityDepth(): UseMutationResult<
  UpdateDepthResponse,
  Error,
  { activityKey: string; input: UpdateDepthInput }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityKey, input }) => api.updateActivityDepth(activityKey, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useDeleteActivity()
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteActivity(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityKey: string) => api.deleteActivity(activityKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useAddAchievement()
// ─────────────────────────────────────────────────────────────────────────────

export function useAddAchievement(): UseMutationResult<
  AddAchievementResponse,
  Error,
  { activityKey: string; input: AddAchievementInput }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityKey, input }) => api.addAchievement(activityKey, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useDeleteAchievement()
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteAchievement(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (achievementId: string) => api.deleteAchievement(achievementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useSaveReflection()
// ─────────────────────────────────────────────────────────────────────────────

export function useSaveReflection(): UseMutationResult<
  SaveReflectionResponse,
  Error,
  SaveReflectionInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveReflectionInput) => api.saveReflection(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useCommitActivities()
// Advances the onboarding session to 'cognitive'.
// Session invalidation is user-scoped (Issue 2B).
// ─────────────────────────────────────────────────────────────────────────────

export function useCommitActivities(): UseMutationResult<
  CommitActivitiesResponse,
  Error,
  void
> {
  const queryClient = useQueryClient();
  const { user }    = useAppContext();
  const userId      = user?.id ?? null;

  return useMutation({
    mutationFn: () => api.commitActivities(),
    onSuccess: () => {
      // Invalidate activities so the UI reflects committed state
      queryClient.invalidateQueries({ queryKey: ACTIVITIES_QUERY_KEY });
      // Invalidate session with user-scoped key so the onboarding shell
      // navigates to the next step. Guard prevents invalidation if user
      // is unexpectedly null (e.g. concurrent logout edge case).
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: studentOnboardingQueryKeys.session(userId),
        });
      }
    },
  });
}
