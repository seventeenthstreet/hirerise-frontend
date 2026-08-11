/**
 * @file src/features/professional-onboarding/hooks/useAdvanceToNextStep.ts
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Shared "what happens after a successful save" navigation helper for the
 * Guided Builder step forms (WP-PRO-09D §5 — Step Navigation).
 *
 * WHY THIS EXISTS / WHY IT WORKS THIS WAY:
 *   The work package requires navigation to be "driven by `currentStep`
 *   returned from the Progress API" and explicitly forbids calculating
 *   progression locally (e.g. "this is step 2 of 5, go to step 3"). A
 *   mutation's own response (`SaveGuidedSectionResponse`) only tells us
 *   which step was JUST completed, not which one comes next — so after a
 *   successful save this hook performs one authoritative, imperative
 *   refetch of the Progress API (via `queryClient.fetchQuery`, which also
 *   refreshes the shared cache the rest of the app reads from) and
 *   navigates using the FRESH `currentStep` it returns, resolved through the
 *   existing Step Registry (`resolveStep`, from WP-PRO-09C) — never a
 *   client-computed "next index".
 *
 *   This does not duplicate `useProfessionalOnboardingProgress` — that hook
 *   is for passive, subscribed reads; this one is an explicit one-shot
 *   fetch tied to a specific user action (a save), which `useQuery` alone
 *   doesn't cleanly express. It reuses the same query key and the same
 *   `guidedBuilderApi.getProgress` call, so the two never diverge.
 *
 * HARD RULES:
 *  - No business/completion logic — this hook only decides WHERE to
 *    navigate, using a value the backend already computed.
 *  - No duplicate API layer or query key — both are imported from the
 *    existing WP-PRO-09C modules.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { useAppContext } from '@/context/AppContext';
import { ROUTES } from '@/routes/routes.constants';

import { guidedBuilderApi } from '../api/guided-builder.api';
import { professionalOnboardingQueryKeys } from '../queries/queryKeys';
import { resolveStep } from '../constants/step-registry';

export function useAdvanceToNextStep() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const userId = user?.id ?? null;

  /**
   * Call after a section save succeeds. Refetches the Progress API and
   * navigates to whichever route the FRESH `currentStep` resolves to.
   *
   * Falls back to the Review route if:
   *  - `currentStep` is null (every gating step is complete), or
   *  - the fresh `currentStep` doesn't resolve in the registry (an
   *    unrecognised step id — see resolveStep's fallback contract).
   *
   * Both fallback cases intentionally route to Review rather than staying
   * put or throwing — "all gating steps done" and "unknown step" both mean
   * "there's nothing further this renderer can show, so move the user
   * forward" (the Review screen itself is a later work package, but the
   * route already exists — ROUTES.ONBOARDING_PROFILE_REVIEW).
   */
  async function advance(): Promise<void> {
    if (!userId) return;

    const fresh = await queryClient.fetchQuery({
      queryKey: professionalOnboardingQueryKeys.progress(userId),
      queryFn: () => guidedBuilderApi.getProgress(),
    });

    const nextEntry = resolveStep(fresh.currentStep);
    const nextRoute = nextEntry?.route ?? ROUTES.ONBOARDING_PROFILE_REVIEW;

    navigate(nextRoute);
  }

  return { advance };
}
