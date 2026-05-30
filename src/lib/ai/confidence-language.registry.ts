/**
 * @file src/lib/ai/confidence-language.registry.ts
 *
 * AI Confidence Language Registry — Frontend Mirror (Phase 4B)
 *
 * This is the TypeScript mirror of the backend registry
 * (core/src/ai/confidence-language/ai-confidence-language.registry.js).
 *
 * GOVERNANCE CONSTRAINTS:
 *   ✅ Deterministic mappings only — no dynamic vocabulary
 *   ✅ Immutable (as const / Object.freeze equivalent via TypeScript)
 *   ✅ Used for CLIENT-SIDE validation before rendering AI narratives
 *   ✅ Never generates content — validation and fallback copy only
 *   ✅ Must remain in sync with the backend registry (version-locked)
 *
 * ARCHITECTURE POSITION:
 *   API response → useAIExplanation hook → [this registry] → component render
 *
 * NOTE: If vocabulary changes are needed, update BOTH registries together
 * and bump REGISTRY_VERSION in both files.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_DATA';

export interface TierVocabulary {
  readonly allowed:    readonly string[];
  readonly preferred:  readonly string[];
  readonly prohibited: readonly string[];
  readonly fallback:   string;
}

export type VocabularyMap = Readonly<Record<ConfidenceTier, TierVocabulary>>;

export interface ValidationResult {
  readonly valid:           boolean;
  readonly tier:            ConfidenceTier;
  readonly registryVersion: string;
  readonly violations:      readonly RejectionCode[] | null;
  readonly violationDetail: string | null;
  readonly fallback:        string;
}

export type RejectionCode =
  | 'UNKNOWN_TIER'
  | 'PROHIBITED_PHRASE'
  | 'TIER_ESCALATION'
  | 'EMPTY_OUTPUT'
  | 'EXCEEDS_MAX_LENGTH'
  | 'BELOW_MIN_LENGTH';

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY VERSION — must match backend
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTRY_VERSION = Object.freeze({
  version:   '1.0.0',
  createdAt: '2026-05-17',
  owner:     'hirerise-ai-governance',
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE TIERS
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIDENCE_TIERS = Object.freeze({
  HIGH:    'HIGH',
  MEDIUM:  'MEDIUM',
  LOW:     'LOW',
  NO_DATA: 'NO_DATA',
} as const) satisfies Record<ConfidenceTier, ConfidenceTier>;

// ─────────────────────────────────────────────────────────────────────────────
// VOCABULARY — see backend registry for full rationale on each entry
// ─────────────────────────────────────────────────────────────────────────────

export const VOCABULARY: VocabularyMap = Object.freeze({
  HIGH: Object.freeze({
    allowed: Object.freeze([
      'strong alignment', 'consistently demonstrated', 'well-supported',
      'clearly indicates', 'robust signal', 'well-established', 'highly relevant',
      'strong match', 'strong evidence', 'your profile shows', 'confidently suggests',
      'solid foundation', 'strong profile', 'demonstrates clearly', 'well-evidenced',
    ]),
    preferred: Object.freeze([
      'strong alignment', 'consistently demonstrated', 'well-supported',
      'your profile shows strong', 'confidently suggests',
    ]),
    prohibited: Object.freeze([
      'guaranteed', 'perfect fit', 'certain success', 'will definitely', 'absolute',
      'always succeed', 'no risk', 'flawless', 'unquestionably', 'without doubt',
      'certain match', 'perfect match', '100%',
      'limited signal', 'early indication', 'not enough data', 'unclear whether',
      'hard to say', 'possibly indicates', 'might suggest',
    ]),
    fallback: 'Your profile shows strong alignment with this direction.',
  }),

  MEDIUM: Object.freeze({
    allowed: Object.freeze([
      'suggests', 'indicates', 'shows some alignment', 'shows alignment',
      'some evidence', 'emerging signals', 'developing strengths', 'profile suggests',
      'your background suggests', 'early strengths', 'shows potential', 'positive signals',
      'relevant experience', 'appears well-suited', 'may be a good fit', 'encouraging signals',
    ]),
    preferred: Object.freeze([
      'your profile suggests', 'indicates some alignment', 'shows alignment',
      'encouraging signals', 'emerging strengths',
    ]),
    prohibited: Object.freeze([
      'strong alignment', 'consistently demonstrated', 'guaranteed', 'perfect fit',
      'certain success', 'will definitely', 'absolute', 'highly confident',
      'robust signal', 'clearly demonstrates', 'unquestionably',
      'not enough data', 'no signal', 'we cannot assess',
    ]),
    fallback: 'Your profile suggests some alignment with this direction.',
  }),

  LOW: Object.freeze({
    allowed: Object.freeze([
      'early indication', 'limited signal', 'exploratory direction', 'early signals suggest',
      'based on limited data', 'preliminary signals', 'some early indication',
      'initial signals', 'early-stage signals', 'tentative indication',
      'worth exploring', 'may be worth considering', 'emerging interest',
    ]),
    preferred: Object.freeze([
      'early indication', 'limited signal', 'based on limited data',
      'exploratory direction', 'early signals suggest',
    ]),
    prohibited: Object.freeze([
      'strong alignment', 'ideal fit', 'highly suited', 'consistently demonstrated',
      'well-supported', 'confidently suggests', 'robust signal', 'clearly indicates',
      'guaranteed', 'perfect fit', 'certain success', 'strong match', 'strong evidence',
      'strong profile', 'no data', 'we have no information', 'cannot assess at all',
    ]),
    fallback: 'Based on limited data, there are early signals worth exploring in this direction.',
  }),

  NO_DATA: Object.freeze({
    allowed: Object.freeze([
      "we don't yet have enough information", 'not enough information yet',
      'more data needed', 'no assessment available', 'your profile is still building',
      'once we have more information', 'as your profile develops',
      'currently insufficient data', 'not yet assessed', 'pending more signal',
    ]),
    preferred: Object.freeze([
      "we don't yet have enough information",
      'your profile is still building',
      'not enough information yet',
    ]),
    prohibited: Object.freeze([
      'strong alignment', 'shows alignment', 'suggests', 'indicates', 'early indication',
      'limited signal', 'demonstrates', 'evidenced', 'you are suited', 'you would excel',
      'you are a good fit', 'your skills match', 'you are not suited', 'you lack',
      'you are unlikely to succeed', 'poor fit',
    ]),
    fallback: "We don't yet have enough information to assess this direction. Your profile will strengthen as more data is collected.",
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION CONFIG — must match backend
// ─────────────────────────────────────────────────────────────────────────────

export const VALIDATION_CONFIG = Object.freeze({
  MIN_LENGTH: 20,
  MAX_LENGTH: 1000,
} as const);

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE VALIDATOR
// Mirrors backend validator logic for pre-render validation in the hook layer.
// Must not duplicate backend — this runs AFTER the backend has already validated.
// This is a lightweight guard for defensive rendering only.
// ─────────────────────────────────────────────────────────────────────────────

function containsPhrase(text: string, phrase: string): boolean {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

/**
 * Lightweight client-side validation guard.
 * The backend is the authoritative validator — this is defence-in-depth only.
 *
 * Returns true if the narrative is safe to render, false if it should be
 * suppressed in favour of the fallback.
 */
export function isNarrativeSafeToRender(
  narrative: string | null | undefined,
  tier: ConfidenceTier,
): boolean {
  if (!narrative || typeof narrative !== 'string') return false;
  const text = narrative.trim();
  if (text.length < VALIDATION_CONFIG.MIN_LENGTH) return false;
  if (text.length > VALIDATION_CONFIG.MAX_LENGTH) return false;

  const vocab = VOCABULARY[tier];
  if (!vocab) return false;

  return !vocab.prohibited.some((phrase) => containsPhrase(text, phrase));
}

/**
 * Returns the deterministic fallback copy for a tier.
 * Rendered when AI narrative is suppressed on the client side.
 */
export function getFallbackCopy(tier: ConfidenceTier): string {
  return VOCABULARY[tier]?.fallback
    ?? "We don't yet have enough information to assess this direction.";
}
