/**
 * @file src/features/ai-confidence/hooks/useAIExplanation.ts
 *
 * useAIExplanation — Phase 4B AI Confidence Language Hook
 *
 * PURPOSE:
 *   Fetches AI-generated narrative for a given assessment, validates it
 *   client-side against the confidence language registry, and returns
 *   either the approved narrative or the deterministic fallback copy.
 *
 * GOVERNANCE CONSTRAINTS:
 *   ✅ Deterministic content rendered first — hook returns null while loading,
 *      never blocks the deterministic recommendation render
 *   ✅ AI narrative is layered afterward — isFallback tells the component
 *      whether to show the AI badge or suppress it
 *   ✅ Client-side validation is defence-in-depth — backend has already
 *      validated; this guards against any transport corruption
 *   ✅ No global AI state — result is local to each hook instance
 *   ✅ No AI-driven rendering logic — hook returns string | null, component
 *      decides how to present it
 *   ✅ Feature flag gated — if ai_augmentation_enabled is false, hook
 *      returns null immediately (no API call)
 *
 * ARCHITECTURE POSITION:
 *   API → [this hook] → UI component (never Pages directly)
 */

import { useEffect, useRef, useState } from 'react';
import {
  type ConfidenceTier,
  isNarrativeSafeToRender,
  getFallbackCopy,
} from '../../../lib/ai/confidence-language.registry';
import { evaluateFlag } from '../../../lib/featureFlags';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AIExplanationResult {
  /** The text to render. Either the validated AI narrative or deterministic fallback. */
  narrative:   string | null;
  /** True when deterministic fallback is being shown instead of AI narrative. */
  isFallback:  boolean;
  /** True while the API call is in flight. */
  isLoading:   boolean;
  /** The confidence tier for this explanation (from deterministic engine). */
  tier:        ConfidenceTier | null;
}

interface UseAIExplanationOptions {
  /** Assessment ID from the deterministic engine. */
  assessmentId: string | null | undefined;
  /** Deterministic confidence tier from IntelligenceSnapshot. */
  confidenceTier: ConfidenceTier | null | undefined;
  /** Which AI capability this hook serves (for telemetry). */
  capability: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Hard timeout — AI augmentation must not block UI for more than this. */
const AI_FETCH_TIMEOUT_MS = 3000;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useAIExplanation({
  assessmentId,
   
  confidenceTier,
  capability,
}: UseAIExplanationOptions): AIExplanationResult {

  const [result, setResult] = useState<AIExplanationResult>({
    narrative:  null,
    isFallback: false,
    isLoading:  false,
    tier:       null,
  });

  // Track active fetch so we can abort on unmount or dep change
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // ── Guard: feature flag ─────────────────────────────────────────────────
    // Check ai_augmentation_enabled. If off, return null immediately.
    // evaluateFlag is synchronous — no flicker risk.
    const flagEnabled = _isAugmentationEnabled();
    if (!flagEnabled || !assessmentId || !confidenceTier) {
      setResult({ narrative: null, isFallback: false, isLoading: false, tier: confidenceTier ?? null });
      return;
    }

    // ── Abort previous fetch ────────────────────────────────────────────────
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // ── Timeout ─────────────────────────────────────────────────────────────
    const timeoutId = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);

    setResult((prev) => ({ ...prev, isLoading: true }));

    _fetchAIExplanation({ assessmentId, confidenceTier, capability, signal: controller.signal })
      .then((raw) => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;

        // ── Client-side validation (defence-in-depth) ─────────────────────
        const safe = isNarrativeSafeToRender(raw, confidenceTier);

        if (safe && raw) {
          setResult({
            narrative:  raw,
            isFallback: false,
            isLoading:  false,
            tier:       confidenceTier,
          });
        } else {
          // Narrative suppressed — use deterministic fallback
          setResult({
            narrative:  getFallbackCopy(confidenceTier),
            isFallback: true,
            isLoading:  false,
            tier:       confidenceTier,
          });
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;

        // AI fetch failed — deterministic fallback
        setResult({
          narrative:  getFallbackCopy(confidenceTier),
          isFallback: true,
          isLoading:  false,
          tier:       confidenceTier,
        });
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [assessmentId, confidenceTier, capability]);

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether the ai_augmentation_enabled feature flag is active.
 * Synchronous, deterministic — same user always gets same result.
 */
function _isAugmentationEnabled(): boolean {
  try {
    // 'ai_augmentation_enabled' will be added to FeatureFlags in featureFlags.ts
    // as part of Phase 4B-1 rollout. Until then, returns false safely.
    return (evaluateFlag as (flag: string) => boolean)('ai_augmentation_enabled') ?? false;
  } catch {
    return false;  // fail closed — no AI augmentation on any flag error
  }
}

/**
 * Fetches validated AI explanation from the backend.
 * The backend has already run all 5 validation stages before returning.
 *
 * @param params
 * @returns raw narrative string from backend (already backend-validated)
 */
async function _fetchAIExplanation({
  assessmentId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  confidenceTier,
  capability,
  signal,
}: {
  assessmentId:    string;
  confidenceTier:  ConfidenceTier;
  capability:      string;
  signal:          AbortSignal;
}): Promise<string | null> {
  const response = await fetch('/api/ai/explanation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assessmentId, capability }),
    signal,
  });

  if (!response.ok) return null;

  const data = await response.json() as { narrative?: string };
  return typeof data.narrative === 'string' ? data.narrative : null;
}
