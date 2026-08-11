/**
 * @file src/features/premium/components/MatchScoreCard.tsx
 * @description Renders the match score and tier badge.
 *
 * RULES:
 *  - Display-only — no mutations, no API calls
 *  - Accepts typed props — no any
 *  - Accessible: score announced to screen readers
 */

import React from 'react';
import type { MatchTier } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// TIER CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<MatchTier, { label: string; colorClass: string }> = {
  HIGH:    { label: 'Strong Match',   colorClass: 'premium-score--high'    },
  MEDIUM:  { label: 'Partial Match',  colorClass: 'premium-score--medium'  },
  LOW:     { label: 'Low Match',      colorClass: 'premium-score--low'     },
  NO_DATA: { label: 'Insufficient Data', colorClass: 'premium-score--nodata' },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchScoreCardProps {
  matchScore:  number;
  tier:        MatchTier;
  cacheHit?:   boolean;
  scoredAt?:   string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function MatchScoreCard({
  matchScore,
  tier,
  cacheHit = false,
  scoredAt,
}: MatchScoreCardProps) {
  const config      = TIER_CONFIG[tier] ?? TIER_CONFIG.NO_DATA;
  const safeScore   = Math.max(0, Math.min(100, Math.round(matchScore)));
  const circumference = 2 * Math.PI * 40; // r=40
  const dashOffset    = circumference * (1 - safeScore / 100);

  return (
    <div className={`premium-score-card ${config.colorClass}`} role="region" aria-label="Match Score">
      {/* Circular gauge */}
      <div className="premium-score-card__gauge" aria-hidden="true">
        <svg width="100" height="100" viewBox="0 0 100 100">
          {/* Track */}
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            opacity="0.15"
          />
          {/* Progress */}
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="premium-score-card__score-label" aria-live="polite">
          <span className="premium-score-card__score">{safeScore}</span>
          <span className="premium-score-card__max">/100</span>
        </div>
      </div>

      {/* Tier badge */}
      <div className="premium-score-card__tier">
        <span className="premium-score-card__tier-badge">{config.label}</span>
      </div>

      {/* Screen-reader announcement */}
      <p className="sr-only">
        Your premium match score is {safeScore} out of 100, classified as {config.label}.
      </p>

      {/* Meta */}
      <div className="premium-score-card__meta">
        {cacheHit && (
          <span className="premium-score-card__cache-badge" title="Result served from cache">
            Cached result
          </span>
        )}
        {scoredAt && (
          <time dateTime={scoredAt} className="premium-score-card__timestamp">
            Scored {new Date(scoredAt).toLocaleDateString()}
          </time>
        )}
      </div>
    </div>
  );
}
