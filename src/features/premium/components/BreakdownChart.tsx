/**
 * @file src/features/premium/components/BreakdownChart.tsx
 * @description Renders the match breakdown as a horizontal bar chart.
 *
 * Shows skills, experience, education sub-scores and market demand.
 * Pure display — no mutations or API calls.
 */

import React from 'react';
import type { MatchBreakdown } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// DIMENSION CONFIG
// Maps breakdown keys to human labels and their maximum weight.
// ─────────────────────────────────────────────────────────────────────────────

const DIMENSIONS: Array<{
  key:    keyof MatchBreakdown;
  label:  string;
  maxVal: number;
}> = [
  { key: 'skills',       label: 'Skills Match',      maxVal: 30  },
  { key: 'experience',   label: 'Experience',         maxVal: 25  },
  { key: 'education',    label: 'Education',          maxVal: 15  },
  { key: 'marketDemand', label: 'Market Demand',      maxVal: 100 },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface BreakdownChartProps {
  breakdown: MatchBreakdown;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function BreakdownChart({ breakdown }: BreakdownChartProps) {
  return (
    <div className="premium-breakdown" role="region" aria-label="Match Breakdown">
      <h3 className="premium-breakdown__title">Score Breakdown</h3>
      <ul className="premium-breakdown__list" role="list">
        {DIMENSIONS.map(({ key, label, maxVal }) => {
          const raw = breakdown[key];
          if (raw == null) return null;

          const pct = Math.max(0, Math.min(100, Math.round((Number(raw) / maxVal) * 100)));

          return (
            <li key={key} className="premium-breakdown__item">
              <div className="premium-breakdown__row">
                <span className="premium-breakdown__label">{label}</span>
                <span className="premium-breakdown__value" aria-label={`${pct}%`}>
                  {pct}%
                </span>
              </div>
              <div
                className="premium-breakdown__bar-track"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${label}: ${pct}%`}
              >
                <div
                  className="premium-breakdown__bar-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
