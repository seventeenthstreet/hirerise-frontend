/**
 * @file src/features/premium/components/ExplainabilityPanel.tsx
 * @description Renders the deterministic AI explanation reasons.
 *
 * Complies with WP-1-SPEC-01 / WP-12-SPEC-01:
 * - Displays reasons verbatim (no client-side transformation)
 * - Makes clear reasons are AI-assisted but deterministic
 * - No PII rendered (backend contract guarantees this)
 */

import React from 'react';
import type { ExplanationPayload } from '../types';

export interface ExplainabilityPanelProps {
  explanation: ExplanationPayload;
}

export function ExplainabilityPanel({ explanation }: ExplainabilityPanelProps) {
  const { reasons } = explanation;

  return (
    <div className="premium-explanation" role="region" aria-label="Match Explanation">
      <div className="premium-explanation__header">
        <h3 className="premium-explanation__title">Why this score?</h3>
        <span className="premium-explanation__badge" title="Scores are calculated deterministically from your profile data">
          Explainable AI
        </span>
      </div>
      {reasons && reasons.length > 0 ? (
        <ol className="premium-explanation__list" aria-label="Explanation reasons">
          {reasons.map((reason, idx) => (
            <li key={idx} className="premium-explanation__reason">
              {reason}
            </li>
          ))}
        </ol>
      ) : (
        <p className="premium-explanation__empty">No explanation available.</p>
      )}
    </div>
  );
}
