/**
 * src/modules/skill-evolution/components/SkillCard.tsx
 *
 * Displays a single skill recommendation with:
 *   - Impact bar (animated fill)
 *   - Demand score badge
 *   - Growth rate badge
 *   - Career relevance indicator
 *   - Rationale tooltip on hover
 */

import React, { useEffect, useState } from 'react';
import type { SkillRecommendation } from '../services/skills.api';

// ─── Config ───────────────────────────────────────────────────────────────────

const IMPACT_COLORS: Array<{ min: number; color: string; bg: string }> = [
  { min: 90, color: '#22c55e', bg: 'rgba(34,197,94,0.12)'   },
  { min: 80, color: '#06b6d4', bg: 'rgba(6,182,212,0.12)'   },
  { min: 70, color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  { min: 60, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { min:  0, color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
];

const STREAM_EMOJI: Record<string, string> = {
  engineering: '💻',
  medical:     '🏥',
  commerce:    '📈',
  humanities:  '📚',
};

function getImpactTheme(impact: number) {
  return IMPACT_COLORS.find(c => impact >= c.min) ?? IMPACT_COLORS[IMPACT_COLORS.length - 1];
}

function formatGrowth(rate: number): string {
  return `+${(rate * 100).toFixed(0)}%/yr`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SkillCardProps {
  skill:      SkillRecommendation;
  rank:       number;
  animate?:   boolean;
  compact?:   boolean;   // compact = single-line variant for the roadmap view
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkillCard({
  skill,
  rank,
  animate = true,
  compact = false,
}: SkillCardProps) {
  const [barWidth, setBarWidth] = useState(0);
  const [hovered,  setHovered]  = useState(false);

  const theme = getImpactTheme(skill.impact);

  // Animate bar on mount
  useEffect(() => {
    if (!animate) { setBarWidth(skill.impact); return; }
    const t = setTimeout(() => setBarWidth(skill.impact), 80 + rank * 60);
    return () => clearTimeout(t);
  }, [skill.impact, animate, rank]);

  if (compact) {
    // ── Compact single-line variant (used in roadmap steps) ───────────────
    return (
      <div style={{
        ...SK.compactRow,
        borderLeft: `3px solid ${theme.color}`,
      }}>
        <span style={{ ...SK.compactRank, background: theme.color }}>
          {rank}
        </span>
        <span style={SK.compactName}>{skill.skill}</span>

        <div style={SK.compactBarWrap}>
          <div style={{
            ...SK.compactBar,
            width: `${barWidth}%`,
            background: theme.color,
          }} />
        </div>

        <span style={{ ...SK.compactImpact, color: theme.color }}>
          {skill.impact}
        </span>
      </div>
    );
  }

  // ── Full card variant ─────────────────────────────────────────────────────
  return (
    <div
      style={{
        ...SK.card,
        borderColor: hovered ? theme.color : '#1f2937',
        background:  hovered ? theme.bg    : '#0d1117',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header row */}
      <div style={SK.headerRow}>
        <span style={{ ...SK.rankBadge, background: theme.color }}>
          #{rank + 1}
        </span>
        <span style={SK.skillName}>{skill.skill}</span>
        <span style={{ ...SK.impactScore, color: theme.color }}>
          {skill.impact}
        </span>
      </div>

      {/* Impact bar */}
      <div style={SK.barTrack}>
        <div style={{
          ...SK.barFill,
          width:      `${barWidth}%`,
          background: `linear-gradient(90deg, ${theme.color}cc, ${theme.color})`,
          transition:  animate ? 'width 0.7s cubic-bezier(0.34,1.1,0.64,1)' : 'none',
        }} />
      </div>

      {/* Badge row */}
      <div style={SK.badgeRow}>
        <span style={{ ...SK.badge, color: theme.color, background: theme.bg }}>
          Impact {skill.impact}
        </span>
        <span style={SK.demandBadge}>
          📊 Demand {skill.demand_score}
        </span>
        <span style={SK.growthBadge}>
          📈 {formatGrowth(skill.growth_rate)}
        </span>
      </div>

      {/* Rationale (visible on hover) */}
      {hovered && skill.rationale && (
        <p style={SK.rationale}>{skill.rationale}</p>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SK: Record<string, React.CSSProperties> = {
  // Full card
  card:         { background: '#0d1117', border: '1.5px solid #1f2937', borderRadius: 14, padding: '14px 16px', cursor: 'default', transition: 'border-color 0.2s, background 0.2s' },
  headerRow:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  rankBadge:    { fontSize: 10, fontWeight: 800, color: '#000', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  skillName:    { fontSize: 15, fontWeight: 700, color: '#f9fafb', flex: 1 },
  impactScore:  { fontSize: 22, fontWeight: 800, lineHeight: '1' },

  barTrack:     { height: 6, background: '#1f2937', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  barFill:      { height: '100%', borderRadius: 4 },

  badgeRow:     { display: 'flex', gap: 6, flexWrap: 'wrap' },
  badge:        { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10 },
  demandBadge:  { fontSize: 10, fontWeight: 600, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: 10 },
  growthBadge:  { fontSize: 10, fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '2px 8px', borderRadius: 10 },

  rationale:    { fontSize: 12, color: '#9ca3af', margin: '10px 0 0', lineHeight: 1.6, borderTop: '1px solid #1f2937', paddingTop: 10 },

  // Compact row
  compactRow:   { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0d1117', borderRadius: 8, marginBottom: 4 },
  compactRank:  { fontSize: 10, fontWeight: 800, color: '#000', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  compactName:  { fontSize: 13, fontWeight: 600, color: '#f9fafb', flex: '0 0 140px', minWidth: 0 },
  compactBarWrap:{ flex: 1, height: 5, background: '#1f2937', borderRadius: 3, overflow: 'hidden' },
  compactBar:   { height: '100%', borderRadius: 3, transition: 'width 0.7s cubic-bezier(0.34,1.1,0.64,1)' },
  compactImpact:{ fontSize: 12, fontWeight: 800, flexShrink: 0, width: 28, textAlign: 'right' },
};
