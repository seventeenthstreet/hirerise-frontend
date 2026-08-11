/**
 * @file src/features/premium/components/PremiumInsightPanel.tsx
 * @description Renders actionable premium insights.
 */

import React from 'react';
import type { PremiumInsight, InsightType } from '../types';

const INSIGHT_ICONS: Record<InsightType, string> = {
  skill_gap:      '📚',
  market_signal:  '📊',
  experience_gap: '🎯',
};

export interface PremiumInsightPanelProps {
  insights: PremiumInsight[];
}

export function PremiumInsightPanel({ insights }: PremiumInsightPanelProps) {
  if (!insights || insights.length === 0) {
    return (
      <div className="premium-insights" role="region" aria-label="Premium Insights">
        <h3 className="premium-insights__title">Premium Insights</h3>
        <p className="premium-insights__empty">No actionable insights at this time.</p>
      </div>
    );
  }

  return (
    <div className="premium-insights" role="region" aria-label="Premium Insights">
      <h3 className="premium-insights__title">Premium Insights</h3>
      <ul className="premium-insights__list" role="list">
        {insights.map((insight, idx) => (
          <li key={idx} className={`premium-insights__item premium-insights__item--${insight.type}`}>
            <div className="premium-insights__icon" aria-hidden="true">
              {INSIGHT_ICONS[insight.type] ?? '💡'}
            </div>
            <div className="premium-insights__content">
              <h4 className="premium-insights__insight-title">{insight.title}</h4>
              <p className="premium-insights__description">{insight.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
