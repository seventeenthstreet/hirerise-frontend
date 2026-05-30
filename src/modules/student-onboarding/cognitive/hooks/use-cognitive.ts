/**
 * @file front/src/modules/student-onboarding/cognitive/hooks/use-cognitive.ts
 *
 * REACT QUERY HOOKS — Cognitive Step (Phase 3C)
 * ──────────────────────────────────────────────
 * Provides the query and mutation hooks for the cognitive onboarding step.
 *
 * ARCHITECTURE:
 *   API (cognitive.api.ts) → Hooks (this file) → UI (components)
 *
 * SESSION ADVANCEMENT CONTRACT (mirrors activities pattern):
 *   useCommitCognitive extracts signals server-side but does NOT advance
 *   the session. The page.tsx switch handles cognitive like academics:
 *
 *     case 'cognitive': {
 *       await advanceStep({ completedStep: 'cognitive', nextStep: 'aspiration' });
 *     }
 *
 *   So useCommitCognitive only needs to invalidate the cognitive cache.
 *   Session invalidation happens AFTER onComplete() → page.tsx → advanceStep.
 *
 * PROGRESSIVE PERSISTENCE:
 *   useSaveResponse fires on every option tap. On success, cognitive cache
 *   is invalidated so signal_quality re-renders immediately. Background
 *   saves — errors are swallowed; the commit gate catches gaps.
 *
 * RECOVERY:
 *   useCognitiveStep fetches taxonomy + existing responses on mount.
 *   responseMap hydrates local UI selection state for transparent restoration.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import * as api from '../api/cognitive.api';

import type {
  BatchSaveResponsesInput,
  BatchSaveResponsesResponse,
  CommitCognitiveResponse,
  CognitiveDomainGroup,
  CognitiveOption,
  CognitiveQuestion,
  CognitiveResponse,
  CognitiveSignalQuality,
  DbCognitiveTaxonomyRow,
  DbCognitiveResponse,
  GetCognitiveStepResponse,
  SaveResponseInput,
  SaveResponseResponse,
} from '../types';

import { type CognitiveDomain } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEY
// Follows the module-owned key convention (not registered in global query-keys.ts).
// Lives alongside the hooks that use it — same pattern as ACTIVITIES_QUERY_KEY.
// ─────────────────────────────────────────────────────────────────────────────

export const COGNITIVE_QUERY_KEY = ['student-onboarding', 'cognitive'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// NORMALIZERS
// Raw DB shapes → domain-layer types. Never leak DB column names into UI.
// ─────────────────────────────────────────────────────────────────────────────

function normalizeTaxonomy(raw: DbCognitiveTaxonomyRow[]): CognitiveDomainGroup[] {
  return raw
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((t) => ({
      domain:       t.domain as CognitiveDomain,
      displayName:  t.display_name,
      description:  t.description,
      displayOrder: t.display_order,
      questions: (t.cognitive_questions ?? [])
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .map((q): CognitiveQuestion => ({
          id:           q.id,
          questionKey:  q.question_key,
          questionText: q.question_text,
          hintText:     q.hint_text,
          allowsMulti:  q.allows_multi,
          isRequired:   q.is_required,
          displayOrder: q.display_order,
          options: (q.cognitive_options ?? [])
            .slice()
            .sort((a, b) => a.display_order - b.display_order)
            .map((o): CognitiveOption => ({
              optionKey:    o.option_key,
              optionText:   o.option_text,
              displayOrder: o.display_order,
              // signal_weights intentionally omitted — not for UI
            })),
        })),
    }));
}

function normalizeResponse(raw: DbCognitiveResponse): CognitiveResponse {
  return {
    id:                 raw.id,
    questionId:         raw.question_id,
    selectedOptionKeys: raw.selected_option_keys,
    isPartial:          raw.is_partial,
    updatedAt:          raw.updated_at,
  };
}

function normalizeSignalQuality(
  raw: GetCognitiveStepResponse['signal_quality'],
): CognitiveSignalQuality {
  return {
    totalResponses:   raw.total_responses,
    requiredAnswered: raw.required_answered,
    requiredTotal:    raw.required_total,
    isSufficient:     raw.is_sufficient,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED STATE TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface CognitiveStepData {
  domainGroups:  CognitiveDomainGroup[];
  responses:     CognitiveResponse[];
  signalQuality: CognitiveSignalQuality;
  /** questionId → selectedOptionKeys — for hydrating UI selection state */
  responseMap:   Record<string, string[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// useCognitiveStep()
// Primary query hook. Fetches and normalizes all step data.
// Mirrors useActivitiesStep() shape — UseQueryResult with derived data object.
// ─────────────────────────────────────────────────────────────────────────────

export function useCognitiveStep(): UseQueryResult<CognitiveStepData, Error> {
  return useQuery({
    queryKey: COGNITIVE_QUERY_KEY,
    queryFn: async ({ signal }) => {
      const res = await api.fetchCognitiveStep(signal);

      const domainGroups  = normalizeTaxonomy(res.taxonomy);
      const responses     = res.responses.map(normalizeResponse);
      const signalQuality = normalizeSignalQuality(res.signal_quality);

      const responseMap: Record<string, string[]> = {};
      for (const r of responses) {
        responseMap[r.questionId] = r.selectedOptionKeys;
      }

      return { domainGroups, responses, signalQuality, responseMap };
    },
    staleTime: 30_000,
    retry:     1,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useSaveResponse()
// Progressive persistence — fires on every option tap.
// Invalidates cognitive cache on success so signal_quality re-computes.
// Background fire-and-forget from the UI; errors don't block the user.
// ─────────────────────────────────────────────────────────────────────────────

export function useSaveResponse(): UseMutationResult<
  SaveResponseResponse,
  Error,
  SaveResponseInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => api.saveResponse(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COGNITIVE_QUERY_KEY });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useBatchSaveResponses()
// Persists all answers in one request.
// ─────────────────────────────────────────────────────────────────────────────

export function useBatchSaveResponses(): UseMutationResult<
  BatchSaveResponsesResponse,
  Error,
  BatchSaveResponsesInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => api.batchSaveResponses(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COGNITIVE_QUERY_KEY });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// useCommitCognitive()
// Extracts cognitive signals server-side and marks responses committed.
// Does NOT advance the session — page.tsx useUpdateOnboardingStep handles that
// after onComplete() is called by the step component.
//
// Only invalidates the cognitive cache (not the session cache).
// Session cache invalidation happens in page.tsx after advanceStep() resolves.
// ─────────────────────────────────────────────────────────────────────────────

export function useCommitCognitive(): UseMutationResult<
  CommitCognitiveResponse,
  Error,
  void
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.commitCognitiveStep(),
    onSuccess: () => {
      // Invalidate cognitive so committed state is reflected
      queryClient.invalidateQueries({ queryKey: COGNITIVE_QUERY_KEY });
      // NOTE: Session invalidation is handled by page.tsx → advanceStep()
      // Do NOT invalidate studentOnboardingQueryKeys.session() here.
    },
  });
}
