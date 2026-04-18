'use client';

/**
 * PersonalizedRecommendations.tsx
 *
 * AI Personalization Engine — dashboard component.
 *
 * Shows personalized career role recommendations ranked by behavioral signals
 * combined with market data. Includes a signal strength indicator and
 * score breakdown per role.
 *
 * Two exports:
 *   PersonalizedRecommendationsPanel  — full panel for /career-health or dedicated page
 *   PersonalizationSignalBadge        — compact badge showing signal status (embed anywhere)
 *
 * Dashboard integration:
 *   Add PersonalizationSignalBadge to the top of JobMatchesPage, OpportunityRadarPage
 *   Add PersonalizedRecommendationsPanel to /dashboard or /career-health
 *
 * Behavior tracking integration:
 *   Wrap any clickable career element with useTrackBehaviorEvent()
 *   See dashboard.integration.ts for full wiring instructions
 */

import { useState } from 'react';
import {
  usePersonalizedRecommendations,
  usePersonalizationProfile,
  useTrackBehaviorEvent,
  getSignalStrengthLabel,
  getSignalStrengthColor,
  type PersonalizedRole,
  type SignalStrength,
} from '@/hooks/usePersonalization';
import { cn } from '@/utils/cn';

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const r     = (size / 2) - 5;
  const circ  = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;
  const color =
    score >= 80 ? '#7c3aed' :
    score >= 60 ? '#059669' :
    score >= 40 ? '#d97706' : '#9ca3af';

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-sm font-bold text-surface-900">{score}</span>
    </div>
  );
}

// ─── Signal strength indicator ────────────────────────────────────────────────

function SignalBar({ strength }: { strength: SignalStrength }) {
  const bars  = ['none', 'low', 'medium', 'high', 'very_high'];
  const level = bars.indexOf(strength);
  const colors = ['bg-surface-200', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-400', 'bg-violet-500'];

  return (
    <div className="flex items-center gap-1">
      {bars.slice(1).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            i < level ? colors[i + 1] : 'bg-surface-200'
          )}
          style={{ width: 6, height: 6 + i * 2 }}
        />
      ))}
    </div>
  );
}

// ─── Score breakdown mini bars ────────────────────────────────────────────────

function BreakdownRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-24 shrink-0 text-surface-500">{label}</span>
      <div className="flex-1 h-1 rounded-full bg-surface-100 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="w-5 text-right font-semibold text-surface-600">{value}</span>
    </div>
  );
}

// ─── Role card ────────────────────────────────────────────────────────────────

function PersonalizedRoleCard({ role }: { role: PersonalizedRole }) {
  const [expanded, setExpanded] = useState(false);
  const { trackEvent } = useTrackBehaviorEvent();

  const handleClick = () => {
    trackEvent({
      event_type:   'role_explore',
      entity_type:  'role',
      entity_id:    role.role.toLowerCase().replace(/\s+/g, '_'),
      entity_label: role.role,
      metadata:     { source: 'personalized_recommendations', score: role.score },
    });
  };

  return (
    <div
      className="rounded-xl border border-surface-100 bg-white shadow-sm overflow-hidden hover:border-violet-200 transition-colors"
      onClick={handleClick}
    >
      <div className="h-0.5 bg-gradient-to-r from-violet-500 to-indigo-400" />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <ScoreRing score={role.score} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-surface-900">{role.role}</h3>
              {role.industry && (
                <span className="text-[10px] text-surface-400">· {role.industry}</span>
              )}
            </div>
            {role.average_salary && (
              <p className="text-sm font-semibold text-emerald-700 mt-0.5">{role.average_salary}</p>
            )}
            {role.match_reason && (
              <p className="text-[11px] text-surface-500 mt-1 italic">{role.match_reason}</p>
            )}
          </div>
        </div>

        {/* Breakdown toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="mt-2.5 text-[11px] text-violet-600 hover:underline"
        >
          {expanded ? 'Hide breakdown ↑' : 'Score breakdown ↓'}
        </button>

        {expanded && (
          <div className="mt-2 space-y-1.5 p-2.5 rounded-lg bg-surface-50">
            <BreakdownRow label="Behavior signals"  value={role.breakdown.behavior_signals}  color="bg-violet-500" />
            <BreakdownRow label="Skill alignment"   value={role.breakdown.skill_alignment}   color="bg-blue-500" />
            <BreakdownRow label="Opportunity score" value={role.breakdown.opportunity_score} color="bg-emerald-500" />
            <BreakdownRow label="Market demand"     value={role.breakdown.market_demand}     color="bg-amber-500" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-100 p-4 flex items-start gap-3">
          <div className="h-13 w-13 rounded-full bg-surface-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-36 rounded bg-surface-100 animate-pulse" />
            <div className="h-3 w-24 rounded bg-surface-100 animate-pulse" />
            <div className="h-3 w-48 rounded bg-surface-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Cold start state ─────────────────────────────────────────────────────────

function ColdStartState() {
  return (
    <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50 p-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 mx-auto mb-3">
        <svg className="h-5 w-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-violet-700 mb-1">Building your profile…</p>
      <p className="text-xs text-violet-500">
        Interact with job cards, skills, and opportunities to receive personalized career recommendations.
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PersonalizedRecommendationsPanel
// ═════════════════════════════════════════════════════════════════════════════

interface PersonalizedRecommendationsPanelProps {
  topN?:      number;
  className?: string;
}

export function PersonalizedRecommendationsPanel({
  topN = 8,
  className,
}: PersonalizedRecommendationsPanelProps) {
  const { data, isLoading, isError, refetch } = usePersonalizedRecommendations(topN);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100">
            <svg className="h-4.5 w-4.5 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-surface-900">Personalized For You</h2>
            <p className="text-[10px] text-surface-400 uppercase tracking-wide">AI-Driven · Based on Your Activity</p>
          </div>
        </div>

        {data && (
          <div className="flex items-center gap-2">
            <SignalBar strength={data.signal_strength} />
            <span className={cn('text-[11px] font-medium', getSignalStrengthColor(data.signal_strength))}>
              {getSignalStrengthLabel(data.signal_strength)}
            </span>
          </div>
        )}
      </div>

      {/* Stats row */}
      {data && data.has_personalization && (
        <div className="flex gap-3">
          {[
            { label: 'Roles Found',  value: data.personalized_roles.length },
            { label: 'Events Used',  value: data.total_events_analyzed },
            { label: 'Completeness', value: `${data.profile_completeness}%` },
          ].map(stat => (
            <div key={stat.label} className="flex-1 rounded-xl border border-surface-100 bg-surface-50 p-2 text-center">
              <p className="text-base font-bold text-violet-700">{stat.value}</p>
              <p className="text-[9px] text-surface-400 uppercase tracking-wide">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading && <Skeleton />}

      {isError && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-center">
          <p className="text-sm text-rose-600">Could not load personalized recommendations.</p>
          <button onClick={() => refetch()} className="mt-2 text-xs text-rose-700 hover:underline">
            Retry
          </button>
        </div>
      )}

      {data && !data.has_personalization && <ColdStartState />}

      {data && data.has_personalization && data.personalized_roles.length > 0 && (
        <div className="space-y-2">
          {data.personalized_roles.map(role => (
            <PersonalizedRoleCard key={`${role.role}-${role.industry}`} role={role} />
          ))}
        </div>
      )}

      {data && data._cached && (
        <p className="text-[10px] text-surface-300 text-right">Cached · refreshes in ~10 min</p>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PersonalizationSignalBadge — compact embed for other pages
// ═════════════════════════════════════════════════════════════════════════════

interface PersonalizationSignalBadgeProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Compact badge to embed at the top of JobMatches, OpportunityRadar, etc.
 * Communicates to users that results are personalized to their behavior.
 */
export function PersonalizationSignalBadge({
  className,
  showLabel = true,
}: PersonalizationSignalBadgeProps) {
  const { data } = usePersonalizedRecommendations(5);

  if (!data) return null;
  if (data.signal_strength === 'none') return null;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5',
      className
    )}>
      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-200">
        <svg className="h-2.5 w-2.5 text-violet-700" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>
      <SignalBar strength={data.signal_strength} />
      {showLabel && (
        <span className={cn('text-[11px] font-medium', getSignalStrengthColor(data.signal_strength))}>
          {getSignalStrengthLabel(data.signal_strength)}
        </span>
      )}
    </div>
  );
}
