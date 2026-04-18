'use client';

/**
 * components/AvaMemoryCard.tsx
 *
 * Displays Ava's memory context:
 *   - Weekly summary (what you did last week)
 *   - Progress stats (skills added, score delta, jobs applied)
 *   - Reminder (inactivity / stale resume nudge)
 *   - Next step (single most impactful action)
 *
 * Placement: below AvaProactiveBanner, above AvaCoachingSystem
 *
 * Props:
 *   memory      — AvaMemoryContext from useAvaMemory
 *   isLoading   — show skeleton while fetching
 *   onAction    — optional callback when user clicks a CTA (for analytics)
 */

import React, { useState } from 'react';
import Link from 'next/link';
import type { AvaMemoryContext } from '@/services/avaMemoryService';
import type { AvaPersonality }   from '@/lib/avaEmotionEngine';

// ─── Design tokens (match dashboard T object) ─────────────────────────────────

const C = {
  bg:     '#07090f',
  s0:     '#0d1117',
  s1:     '#111822',
  s2:     '#161f2e',
  border: 'rgba(255,255,255,0.07)',
  text:   '#dde4ef',
  muted:  '#5f6d87',
  dim:    '#29334a',
  green:  '#1fd8a0',
  blue:   '#3c72f8',
  amber:  '#f4a928',
  red:    '#ef5b48',
  purple: '#9b7cf7',
  pink:   '#e96caa',
} as const;

const ACTION_COLORS: Record<string, string> = {
  skills:  C.amber,
  resume:  C.blue,
  jobs:    C.green,
  explore: C.purple,
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MemorySkeleton() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shim 1.6s infinite',
    borderRadius: 6,
  };
  return (
    <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...shimmer, height: 12, width: '60%' }} />
      <div style={{ ...shimmer, height: 10, width: '80%' }} />
      <div style={{ display: 'flex', gap: 10 }}>
        {[70, 90, 70].map((w, i) => (
          <div key={i} style={{ ...shimmer, height: 48, flex: 1, minWidth: w, borderRadius: 10 }} />
        ))}
      </div>
      <div style={{ ...shimmer, height: 36, width: '40%', borderRadius: 9 }} />
    </div>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  value, label, color, sublabel,
}: {
  value:    string | number;
  label:    string;
  color:    string;
  sublabel?: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 80,
      background: C.s1,
      border: `1px solid ${color}20`,
      borderRadius: 10, padding: '10px 14px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: 10, color: color, fontWeight: 600, marginTop: 2 }}>{sublabel}</div>
      )}
    </div>
  );
}

// ─── AvaMemoryCard ─────────────────────────────────────────────────────────────

interface AvaMemoryCardProps {
  memory:      AvaMemoryContext;
  isLoading:   boolean;
  personality?: AvaPersonality;
  onAction?:   (type: string, label: string) => void;
}

export function AvaMemoryCard({ memory, isLoading, personality, onAction }: AvaMemoryCardProps) {
  const [dismissed, setDismissed] = useState(false);

  // Don't render anything for truly new users with no memory and nothing to show
  const isEmpty = !isLoading
    && memory.stats.isNewUser
    && !memory.weeklySummary
    && !memory.reminder;

  if (isEmpty || dismissed) return null;

  const { stats, weeklySummary, reminder, nextStep, scoreDelta } = memory;
  const acColor = personality?.emotion.color ?? (nextStep?.type ? ACTION_COLORS[nextStep.type] ?? C.blue : C.blue);

  // Score delta direction
  const deltaPositive = stats.currentScore > stats.lastScore;
  const deltaValue    = Math.abs(stats.currentScore - stats.lastScore);

  return (
    <div style={{
      background: `linear-gradient(160deg, rgba(233,108,170,0.06) 0%, rgba(60,114,248,0.04) 100%)`,
      border: `1px solid rgba(233,108,170,0.18)`,
      borderRadius: 16,
      marginBottom: 14,
      overflow: 'hidden',
      animation: 'rise 0.35s ease-out',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: `1px solid rgba(255,255,255,0.05)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: personality
              ? `linear-gradient(135deg, ${personality.emotion.color}28, ${personality.emotion.color}10)`
              : 'linear-gradient(135deg, rgba(233,108,170,0.22), rgba(60,114,248,0.16))',
            border: personality
              ? `1px solid ${personality.emotion.color}35`
              : '1px solid rgba(233,108,170,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17,
          }}>{personality?.emotion.emoji ?? '🧠'}</div>
          <div>
            <div style={{
              fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.16em',
              color: personality?.emotion.color ?? C.pink,
            }}>
              Ava&apos;s Memory · {personality?.emotion.label ?? 'Weekly recap'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 1 }}>
              {stats.isNewUser ? "Let's start building your profile" : "Your week at a glance"}
            </div>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss memory card"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.dim, fontSize: 15, padding: 4, lineHeight: 1,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.muted; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.dim; }}
        >
          ✕
        </button>
      </div>

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {isLoading && <MemorySkeleton />}

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      {!isLoading && (
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Weekly summary text */}
          {/* Emotion-aware message takes priority over generic weekly summary */}
          {(personality?.message || weeklySummary) && (
            <p style={{
              fontSize: 13, color: C.text, lineHeight: 1.6,
              margin: 0, fontWeight: 500,
            }}>
              {personality?.message ?? weeklySummary}
            </p>
          )}

          {/* Stats row */}
          {!stats.isNewUser && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Score delta */}
              <StatTile
                value={stats.currentScore > 0 ? `${Math.round(stats.currentScore)}%` : '—'}
                label="Score"
                color={stats.currentScore >= 70 ? C.green : stats.currentScore >= 45 ? C.amber : C.red}
                sublabel={deltaValue > 0
                  ? `${deltaPositive ? '↑' : '↓'} ${deltaValue.toFixed(0)} pts`
                  : undefined
                }
              />

              {/* Skills added this week */}
              <StatTile
                value={stats.skillsAddedThisWeek}
                label="Skills Added"
                color={stats.skillsAddedThisWeek > 0 ? C.amber : C.muted}
                sublabel={stats.skillsAddedThisWeek > 0 ? 'this week' : undefined}
              />

              {/* Jobs applied */}
              <StatTile
                value={stats.jobsAppliedThisWeek}
                label="Jobs Applied"
                color={stats.jobsAppliedThisWeek > 0 ? C.green : C.muted}
                sublabel={stats.jobsAppliedThisWeek > 0 ? 'this week' : undefined}
              />

              {/* Resume status */}
              <StatTile
                value={stats.resumeImproved ? '✓' : '—'}
                label="Resume"
                color={stats.resumeImproved ? C.green : C.muted}
                sublabel={stats.resumeImproved ? 'improved' : undefined}
              />
            </div>
          )}

          {/* Score gain badge */}
          {scoreDelta && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: C.green + '12', border: `1px solid ${C.green}25`,
              borderRadius: 20, padding: '5px 12px',
              fontSize: 12, fontWeight: 800, color: C.green,
              alignSelf: 'flex-start',
            }}>
              {scoreDelta}
            </div>
          )}

          {/* Inactivity / stale reminder */}
          {reminder && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: `rgba(244,169,40,0.07)`,
              border: `1px solid rgba(244,169,40,0.2)`,
              borderRadius: 10, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>⏰</span>
              <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, margin: 0 }}>
                {reminder}
              </p>
            </div>
          )}

          {/* Next step CTA */}
          {nextStep?.action && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
              background: acColor + '08',
              border: `1px solid ${acColor}22`,
              borderRadius: 11, padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: acColor, whiteSpace: 'nowrap', marginTop: 3 }}>
                  Next Step
                </span>
                <p style={{ fontSize: 12, color: C.text, lineHeight: 1.5, margin: 0 }}>
                  {nextStep.action}
                </p>
              </div>
              <Link
                href={nextStep.href}
                onClick={() => onAction?.(nextStep.type, nextStep.action)}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '7px 16px', borderRadius: 9,
                  background: acColor, color: '#07090f',
                  fontSize: 12, fontWeight: 800, textDecoration: 'none',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.88'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
              >
                Go →
              </Link>
            </div>
          )}

        </div>
      )}
    </div>
  );
}