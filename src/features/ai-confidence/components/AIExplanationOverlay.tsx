/**
 * @file src/features/ai-confidence/components/AIExplanationOverlay.tsx
 *
 * AIExplanationOverlay — Phase 4B Frontend Integration Component
 *
 * PURPOSE:
 *   Renders an AI-generated (or deterministic fallback) narrative overlay.
 *   This component is purely presentational — it never makes API calls,
 *   never accesses global state, and never participates in scoring logic.
 *
 * GOVERNANCE CONSTRAINTS:
 *   ✅ Deterministic content renders first (in the parent component)
 *   ✅ This overlay is layered afterward — never blocks parent render
 *   ✅ isFallback prop suppresses AI badge when deterministic fallback is shown
 *   ✅ No AI-driven rendering logic inside this component
 *   ✅ No global state — all data flows through props
 *   ✅ Null-safe: if narrative is null, component renders nothing
 *
 * USAGE:
 *   // In a deterministic recommendation card:
 *   const { narrative, isFallback, isLoading, tier } = useAIExplanation({
 *     assessmentId,
 *     confidenceTier: recommendation.confidenceTier,
 *     capability: 'explanation_enhancement',
 *   });
 *
 *   return (
 *     <div>
 *       <DeterministicContent rec={recommendation} />  // always renders
 *       <AIExplanationOverlay
 *         narrative={narrative}
 *         isFallback={isFallback}
 *         isLoading={isLoading}
 *         tier={tier}
 *       />
 *     </div>
 *   );
 */

import type { ConfidenceTier } from '../../../lib/ai/confidence-language.registry';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface AIExplanationOverlayProps {
  /** The narrative to display. null = render nothing. */
  narrative:   string | null;
  /** True when narrative is deterministic fallback (suppresses AI badge). */
  isFallback:  boolean;
  /** True while fetch is in progress (renders skeleton). */
  isLoading:   boolean;
  /** Confidence tier — used for tier label display. */
  tier:        ConfidenceTier | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER LABEL MAP
// Human-readable tier labels for display. Not sourced from AI.
// ─────────────────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<ConfidenceTier, string> = {
  HIGH:    'Strong signal',
  MEDIUM:  'Moderate signal',
  LOW:     'Early signal',
  NO_DATA: 'Building profile',
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AIExplanationOverlay({
  narrative,
  isFallback,
  isLoading,
  tier,
}: AIExplanationOverlayProps) {

  // ── Null guard: no overlay if nothing to show ─────────────────────────────
  if (!isLoading && !narrative) return null;

  // ── Loading state: render skeleton ────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading explanation"
        style={{
          height: '2.5rem',
          background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
          backgroundSize: '200% 100%',
          borderRadius: '0.375rem',
          animation: 'shimmer 1.5s infinite',
          marginTop: '0.75rem',
        }}
      />
    );
  }

  // ── Narrative render ──────────────────────────────────────────────────────
  return (
    <div
      style={{
        marginTop: '0.75rem',
        padding: '0.75rem 1rem',
        borderLeft: `3px solid ${_tierColor(tier)}`,
        background: '#f9fafb',
        borderRadius: '0 0.375rem 0.375rem 0',
      }}
    >
      {/* Tier label + AI badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
        {tier && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: _tierColor(tier),
          }}>
            {TIER_LABELS[tier]}
          </span>
        )}
        {/* AI badge — suppressed when showing deterministic fallback */}
        {!isFallback && (
          <span style={{
            fontSize: '0.65rem',
            padding: '0.1rem 0.4rem',
            background: '#e8f0fe',
            color: '#1a56db',
            borderRadius: '999px',
            fontWeight: 500,
          }}>
            AI insight
          </span>
        )}
      </div>

      {/* The narrative itself */}
      <p style={{
        margin: 0,
        fontSize: '0.875rem',
        color: '#374151',
        lineHeight: 1.6,
      }}>
        {narrative}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function _tierColor(tier: ConfidenceTier | null): string {
  switch (tier) {
    case 'HIGH':    return '#16a34a';  // green
    case 'MEDIUM':  return '#ca8a04';  // amber
    case 'LOW':     return '#9ca3af';  // grey
    case 'NO_DATA': return '#d1d5db';  // light grey
    default:        return '#d1d5db';
  }
}
