'use client';
import { getAuthToken } from '@/lib/getToken';
/**
 * components/career/PathTimeline.tsx  (upgraded — market-data layer)
 *
 * Vertical timeline showing each simulated career step.
 *
 * New in this version:
 *   - Probability bar + % per step                (demand*0.5 + skillMatch*0.3 + expFit*0.2)
 *   - Trend label: "High Demand" / "Emerging Role" / "Stable Role"
 *   - 🔥 Trending badge for high-demand roles    (marketDemand ≥ 0.80)
 *   - ⭐ Top Match badge for the highest-scored path
 *   - Market insight reason pill                  (from AI engine)
 *   - MarketSummaryBar: aggregate stats at top of list
 *   - Highlight card treatment for top path
 *   - Fully backward-compatible with SimulatedPathStep (static engine)
 *     AND DynamicPathStep (AI engine) — union prop type
 *
 * Features retained:
 *   - Inline Ava roadmap generation with per-session cache
 *   - What-If delta badges
 *   - Mobile-first
 */

import React, { useState, useCallback, useRef } from 'react';
import type { SimulatedPathStep } from '@/lib/services/careerPathService';
import type { DynamicPathStep }   from '@/lib/services/aiCareerPathService';
import type { DeltaMap, StepDelta } from '@/components/career/CareerPathSection';

// ─── Unified step type ────────────────────────────────────────────────────────
type AnyPathStep = SimulatedPathStep | DynamicPathStep;

function getProbability(s: AnyPathStep): number | null {
  return 'probability' in s && typeof s.probability === 'number' ? s.probability : null;
}
function getReason(s: AnyPathStep): string | null {
  return 'reason' in s && typeof s.reason === 'string' && s.reason.trim()
    ? s.reason.trim() : null;
}
function getExplanation(s: AnyPathStep): string | null {
  return 'explanation' in s && typeof s.explanation === 'string' && s.explanation.trim()
    ? s.explanation.trim() : null;
}
function getMarketDemand(s: AnyPathStep): number {
  return 'marketDemand' in s && typeof s.marketDemand === 'number' ? s.marketDemand : 0;
}
function getReadinessPct(s: AnyPathStep): number | null {
  return 'readinessPct' in s && typeof s.readinessPct === 'number' ? s.readinessPct : null;
}
function getSalaryMid(s: AnyPathStep): number {
  return 'salaryAtReadiness' in s
    ? ((s as SimulatedPathStep).salaryAtReadiness?.mid ?? 0)
    : 0;
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     '#07090f',
  s0:     '#0d1117',
  s1:     '#111822',
  s2:     '#161f2e',
  border: 'rgba(255,255,255,0.07)',
  borderB:'rgba(255,255,255,0.11)',
  text:   '#dde4ef',
  muted:  '#5f6d87',
  dim:    '#29334a',
  green:  '#1fd8a0',
  blue:   '#3c72f8',
  amber:  '#f4a928',
  red:    '#ef5b48',
  purple: '#9b7cf7',
  pink:   '#e96caa',
  teal:   '#22d3ee',
  orange: '#fb923c',
} as const;

// ─── Market intelligence helpers ──────────────────────────────────────────────
function getTrendLabel(demand: number): 'High Demand' | 'Emerging Role' | 'Stable Role' {
  if (demand >= 0.75) return 'High Demand';
  if (demand >= 0.50) return 'Emerging Role';
  return 'Stable Role';
}
const TREND_CONFIG = {
  'High Demand':   { color: C.green,  bg: `${C.green}12`,              border: `${C.green}28`,              icon: '📈' },
  'Emerging Role': { color: C.teal,   bg: `${C.teal}10`,               border: `${C.teal}25`,               icon: '🌱' },
  'Stable Role':   { color: C.muted,  bg: 'rgba(95,109,135,0.10)',     border: 'rgba(95,109,135,0.20)',     icon: '⚓' },
} as const;
const isTrending    = (s: AnyPathStep) => getMarketDemand(s) >= 0.80;
const probColor     = (p: number) => p >= 0.70 ? C.green : p >= 0.45 ? C.amber : C.red;
const readinessColor = (pct: number) => pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;
const pathTypeColor  = (t: string) => t === 'vertical' ? C.blue : t === 'lateral' ? C.purple : C.muted;

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function authPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken();
  const res   = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body:   JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────
function fmt(months: number): string {
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12), m = months % 12;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
}
function salaryLabel(mid: number): string { return mid > 0 ? `₹${mid.toFixed(1)}L` : '—'; }

// ─── SkeletonRow ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 18 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: C.dim }} />
        <div style={{ width: 2, flex: 1, background: C.dim, marginTop: 4 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, width: '55%', borderRadius: 6, background: C.dim, marginBottom: 8 }} />
        <div style={{ height: 10, width: '35%', borderRadius: 6, background: C.dim, marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[60, 80, 70].map((w, i) => <div key={i} style={{ height: 20, width: w, borderRadius: 20, background: C.dim }} />)}
        </div>
      </div>
    </div>
  );
}

// ─── SkillTag ─────────────────────────────────────────────────────────────────
function SkillTag({ label, variant }: { label: string; variant: 'gap' | 'preferred' }) {
  const col = variant === 'gap' ? C.red : C.muted;
  return (
    <span style={{
      display: 'inline-block', fontSize: 10, lineHeight: 1,
      padding: '3px 8px', borderRadius: 20,
      border: `1px solid ${col}30`, background: `${col}10`, color: col, whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ─── DeltaBadge ───────────────────────────────────────────────────────────────
function DeltaBadge({ delta }: { delta: StepDelta }) {
  const any = delta.timelineDelta !== 0 || delta.salaryDelta !== 0 || delta.readinessDelta !== 0;
  if (!any) return null;
  return (
    <div style={{ marginTop: 8, padding: '8px 11px', borderRadius: 9, background: `${C.purple}08`, border: `1px solid ${C.purple}22`, display: 'flex', flexWrap: 'wrap', gap: '5px 14px' }}>
      <span style={{ fontSize: 9, fontWeight: 800, color: C.purple, textTransform: 'uppercase' as const, letterSpacing: '0.1em', width: '100%', marginBottom: 2 }}>🔮 What If impact</span>
      {delta.timelineDelta !== 0 && (
        <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: delta.timelineDelta < 0 ? C.green : C.red }}>
          ⏱ {delta.timelineDelta < 0 ? `${Math.abs(delta.timelineDelta)} mo faster` : `+${delta.timelineDelta} mo longer`}
        </span>
      )}
      {delta.salaryDelta !== 0 && (
        <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: delta.salaryDelta > 0 ? C.green : C.red }}>
          💰 {delta.salaryDelta > 0 ? `+₹${delta.salaryDelta.toFixed(1)}L` : `-₹${Math.abs(delta.salaryDelta).toFixed(1)}L`}
        </span>
      )}
      {delta.readinessDelta !== 0 && (
        <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: delta.readinessDelta > 0 ? C.green : C.red }}>
          ✓ {delta.readinessDelta > 0 ? `+${delta.readinessDelta}%` : `${delta.readinessDelta}%`} ready
        </span>
      )}
    </div>
  );
}

// ─── ProbabilityBar ───────────────────────────────────────────────────────────
function ProbabilityBar({ probability, isTopPath }: { probability: number; isTopPath: boolean }) {
  const pct   = Math.round(probability * 100);
  const col   = probColor(probability);
  const label = pct >= 70 ? 'Strong fit' : pct >= 45 ? 'Moderate fit' : 'Stretch goal';

  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: isTopPath ? col : C.muted }}>
          Match probability
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: col, padding: '1px 6px', borderRadius: 20, background: `${col}12`, border: `1px solid ${col}25`, fontWeight: 700 }}>
            {label}
          </span>
          <span style={{ fontSize: 14, fontWeight: 900, color: col, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {pct}%
          </span>
        </div>
      </div>
      <div style={{ height: 5, borderRadius: 5, background: C.s2, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: `${pct}%`,
          background: isTopPath ? `linear-gradient(90deg, ${col}bb, ${col})` : col,
          borderRadius: 5,
        }} />
      </div>
    </div>
  );
}

// ─── TrendBadge ───────────────────────────────────────────────────────────────
function TrendBadge({ demand }: { demand: number }) {
  const label = getTrendLabel(demand);
  const cfg   = TREND_CONFIG[label];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap' as const, textTransform: 'uppercase' as const, letterSpacing: '0.07em',
    }}>
      {cfg.icon} {label}
    </span>
  );
}

// ─── AvaExplanation ───────────────────────────────────────────────────────────
/**
 * Renders Ava's 2-sentence explanation under each career path step.
 * Always shows — explanation is guaranteed present on DynamicPathStep.
 * Layout: Ava avatar dot + "Ava explains" label + 2-sentence text block.
 */
function AvaExplanation({ explanation, isTopPath }: { explanation: string; isTopPath: boolean }) {
  // Split into sentences for distinct visual treatment
  const sentences = explanation.match(/[^.!?]+[.!?]+/g) ?? [explanation];
  const s1 = sentences[0]?.trim() ?? explanation;
  const s2 = sentences.slice(1).join(' ').trim();

  return (
    <div style={{
      marginBottom: 10,
      padding: '9px 11px',
      borderRadius: 9,
      background: isTopPath
        ? `linear-gradient(135deg, ${C.pink}0d 0%, ${C.purple}08 100%)`
        : `${C.pink}07`,
      border: `1px solid ${isTopPath ? C.pink + '30' : C.pink + '1a'}`,
    }}>
      {/* Header: avatar dot + label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
      }}>
        {/* Ava avatar dot */}
        <div style={{
          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 8, lineHeight: 1 }}>✦</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 800, color: C.pink,
          textTransform: 'uppercase' as const, letterSpacing: '0.1em',
        }}>
          Ava explains
        </span>
      </div>

      {/* Sentence 1 — market demand (slightly brighter) */}
      <p style={{
        margin: '0 0 4px 0', fontSize: 11,
        color: C.text, lineHeight: 1.55,
        opacity: 0.92,
      }}>
        {s1}
      </p>

      {/* Sentence 2 — skill fit + growth potential (muted) */}
      {s2 && (
        <p style={{
          margin: 0, fontSize: 11,
          color: C.muted, lineHeight: 1.55,
        }}>
          {s2}
        </p>
      )}
    </div>
  );
}

// ─── MarketSummaryBar ─────────────────────────────────────────────────────────
function MarketSummaryBar({ paths }: { paths: AnyPathStep[] }) {
  const withProb = paths.filter(p => getProbability(p) !== null);
  if (withProb.length === 0) return null;

  const topProb       = Math.max(...withProb.map(p => getProbability(p)!));
  const trendingCount = paths.filter(isTrending).length;
  const highDemand    = paths.filter(p => getMarketDemand(p) >= 0.75).length;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', padding: '0 0 14px', borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Best match</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: probColor(topProb), fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(topProb * 100)}%
        </span>
      </div>
      {trendingCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Trending</span>
          <span style={{ fontSize: 12, fontWeight: 900, color: C.orange }}>{trendingCount} role{trendingCount > 1 ? 's' : ''}</span>
        </div>
      )}
      {highDemand > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>High demand</span>
          <span style={{ fontSize: 12, fontWeight: 900, color: C.green }}>{highDemand} role{highDemand > 1 ? 's' : ''}</span>
        </div>
      )}
      <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${C.blue}12`, color: C.blue, border: `1px solid ${C.blue}20` }}>
        AI · Market data
      </span>
    </div>
  );
}

// ─── RoadmapPanel ─────────────────────────────────────────────────────────────
interface RoadmapResult { roadmap: string[]; advice: string }

function RoadmapPanel({ currentRole, targetRole, skillsGap, timelineMonths, cache }: {
  currentRole: string; targetRole: string; skillsGap: string[];
  timelineMonths: number; cache: React.MutableRefObject<Map<string, RoadmapResult>>;
}) {
  const cacheKey = `${currentRole}→${targetRole}`;
  const [result,  setResult]  = useState<RoadmapResult | null>(cache.current.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const generate = useCallback(async () => {
    const hit = cache.current.get(cacheKey);
    if (hit) { setResult(hit); return; }
    setLoading(true); setError(null);
    try {
      const data = await authPost<RoadmapResult>('/api/career/roadmap', { currentRole, targetRole, skillsGap, timeline: timelineMonths });
      cache.current.set(cacheKey, data);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Roadmap generation failed.');
    } finally { setLoading(false); }
  }, [currentRole, targetRole, skillsGap, timelineMonths, cacheKey, cache]);

  if (!result && !loading && !error) return (
    <button onClick={generate} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 8, border: `1px solid ${C.pink}30`, background: `${C.pink}08`, color: C.pink, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
      🤖 Generate Ava roadmap
    </button>
  );

  if (loading) return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 9, background: `${C.pink}06`, border: `1px solid ${C.pink}20`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.muted }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${C.pink}30`, borderTopColor: C.pink, animation: 'ptl-spin .65s linear infinite', flexShrink: 0 }} />
      Ava is building your roadmap…
      <style>{`@keyframes ptl-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ marginTop: 10, padding: '8px 11px', borderRadius: 8, background: `${C.red}08`, border: `1px solid ${C.red}20`, fontSize: 11, color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <span>{error}</span>
      <button onClick={() => { setError(null); generate(); }} style={{ fontSize: 10, color: C.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Retry ↻</button>
    </div>
  );

  if (!result) return null;
  return (
    <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 10, background: `${C.pink}06`, border: `1px solid ${C.pink}22` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>🤖</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: C.pink }}>Ava's roadmap</span>
        <button onClick={() => setResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 13, fontFamily: 'inherit', lineHeight: 1, padding: '0 2px' }} aria-label="Dismiss roadmap">×</button>
      </div>
      <ol style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {result.roadmap.map((step, i) => <li key={i} style={{ fontSize: 11, color: C.text, lineHeight: 1.55 }}>{step}</li>)}
      </ol>
      {result.advice && (
        <p style={{ margin: '10px 0 0', padding: '8px 10px', borderRadius: 7, background: `${C.amber}0a`, border: `1px solid ${C.amber}20`, fontSize: 11, color: C.amber, lineHeight: 1.5 }}>
          💡 {result.advice}
        </p>
      )}
    </div>
  );
}

// ─── StepCard ─────────────────────────────────────────────────────────────────
function StepCard({ step, isLast, isTopPath, currentRole, cache, delta }: {
  step: AnyPathStep; isLast: boolean; isTopPath: boolean;
  currentRole: string; cache: React.MutableRefObject<Map<string, RoadmapResult>>; delta?: StepDelta;
}) {
  const [expanded, setExpanded] = useState(false);

  const typeCol      = pathTypeColor(step.pathType);
  const readinessPct = getReadinessPct(step);
  const rdCol        = readinessPct !== null ? readinessColor(readinessPct) : C.muted;
  const probability  = getProbability(step);
  const reason       = getReason(step);
  const explanation  = getExplanation(step);
  const demand       = getMarketDemand(step);
  const trending     = isTrending(step);
  const salaryMid    = getSalaryMid(step);

  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: isLast ? 0 : 28 }}>

      {/* ── Connector column ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 18 }}>
        <div style={{
          width: isTopPath ? 16 : 14, height: isTopPath ? 16 : 14,
          borderRadius: '50%',
          background: isTopPath ? C.green : typeCol,
          border: `2px solid ${C.s0}`,
          flexShrink: 0, marginTop: 2,
          boxShadow: isTopPath ? `0 0 10px ${C.green}55` : 'none',
        }} />
        {!isLast && (
          <div style={{
            width: 2, flex: 1, marginTop: 4,
            background: isTopPath
              ? `linear-gradient(180deg, ${C.green}45, ${C.border})`
              : C.border,
          }} />
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minWidth: 0, paddingBottom: 4,
        ...(isTopPath ? {
          background: `linear-gradient(135deg, ${C.green}06 0%, ${C.blue}04 100%)`,
          border: `1px solid ${C.green}28`,
          borderRadius: 12,
          padding: '11px 13px',
          marginBottom: 4,
        } : {}),
      }}>

        {/* Row 1: role + badges ────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: isTopPath ? 14 : 13, fontWeight: 700, color: C.text, lineHeight: 1.3, textTransform: 'capitalize' }}>
            {step.role}
          </span>

          {/* Path type */}
          <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: `${typeCol}18`, color: typeCol, border: `1px solid ${typeCol}30`, whiteSpace: 'nowrap', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {step.pathType === 'unknown' ? 'pivot' : step.pathType}
          </span>

          {/* 🔥 Trending */}
          {trending && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: `${C.orange}15`, color: C.orange, border: `1px solid ${C.orange}30`, whiteSpace: 'nowrap', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              🔥 Trending
            </span>
          )}

          {/* ⭐ Top match */}
          {isTopPath && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}30`, whiteSpace: 'nowrap', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              ⭐ Top match
            </span>
          )}
        </div>

        {/* Row 2: timeline · salary · readiness · trend ───────────────── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginBottom: 9 }}>
          <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
              <circle cx="6" cy="6" r="5" stroke={C.muted} strokeWidth="1.4"/>
              <path d="M6 3v3l2 1.5" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {fmt(step.timelineMonths)}
          </span>
          {salaryMid > 0 && (
            <span style={{ fontSize: 11, color: C.amber, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M6 1v10M3.5 3.5c0-1.1.9-2 2.5-2s2.5.9 2.5 2-1 1.8-2.5 2c-1.5.2-2.5 1-2.5 2.2s1 2 2.5 2 2.5-.9 2.5-2" stroke={C.amber} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              {salaryLabel(salaryMid)}
            </span>
          )}
          {readinessPct !== null && (
            <span style={{ fontSize: 11, color: rdCol, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M2 6l3 3 5-5" stroke={rdCol} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {readinessPct}% ready
            </span>
          )}
          {demand > 0 && <TrendBadge demand={demand} />}
        </div>

        {/* Probability bar ─────────────────────────────────────────────── */}
        {probability !== null && <ProbabilityBar probability={probability} isTopPath={isTopPath} />}

        {/* Readiness bar (static engine only, no probability) ─────────── */}
        {readinessPct !== null && probability === null && (
          <div style={{ height: 3, borderRadius: 3, background: C.s2, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${readinessPct}%`, background: rdCol }} />
          </div>
        )}

        {/* Ava explanation — shown when explanation field is present (AI + static fallback) */}
        {explanation && <AvaExplanation explanation={explanation} isTopPath={isTopPath} />}

        {/* Market insight reason — shown only when no explanation (e.g. older data) */}
        {!explanation && reason && (
          <div style={{ marginBottom: 9, padding: '7px 10px', borderRadius: 8, background: `${C.blue}08`, border: `1px solid ${C.blue}18`, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <span style={{ fontSize: 11, flexShrink: 0, marginTop: 1 }}>💡</span>
            <p style={{ margin: 0, fontSize: 11, color: C.text, lineHeight: 1.5, opacity: 0.85 }}>{reason}</p>
          </div>
        )}

        {/* Skills gap ─────────────────────────────────────────────────── */}
        {step.skillsGap.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, margin: '0 0 5px' }}>
              Skills gap
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
              {step.skillsGap.slice(0, expanded ? undefined : 4).map(s => <SkillTag key={s} label={s} variant="gap" />)}
              {!expanded && step.skillsGap.length > 4 && (
                <button onClick={() => setExpanded(true)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, border: `1px solid ${C.border}`, background: 'none', color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>
                  +{step.skillsGap.length - 4} more
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preferred gap (expanded, static engine only) ───────────────── */}
        {expanded && 'preferredGap' in step && (step as SimulatedPathStep).preferredGap.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: C.muted, margin: '0 0 5px' }}>Nice to have</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(step as SimulatedPathStep).preferredGap.map(s => <SkillTag key={s} label={s} variant="preferred" />)}
            </div>
          </div>
        )}
        {expanded && <button onClick={() => setExpanded(false)} style={{ marginTop: 6, fontSize: 10, padding: '3px 8px', borderRadius: 20, border: `1px solid ${C.border}`, background: 'none', color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Show less</button>}

        {/* What-If delta ───────────────────────────────────────────────── */}
        {delta && <DeltaBadge delta={delta} />}

        {/* Ava roadmap ─────────────────────────────────────────────────── */}
        <RoadmapPanel currentRole={currentRole} targetRole={step.role} skillsGap={step.skillsGap} timelineMonths={step.timelineMonths} cache={cache} />
      </div>
    </div>
  );
}

// ─── Static sub-components ───────────────────────────────────────────────────
function OriginNode({ role }: { role: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, paddingBottom: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 18 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: C.green, border: `2px solid ${C.s0}`, flexShrink: 0, marginTop: 2 }} />
        <div style={{ width: 2, flex: 1, background: C.border, marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, paddingTop: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>You are here</span>
        <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700, color: C.text, textTransform: 'capitalize' }}>{role}</p>
      </div>
    </div>
  );
}

function PathDivider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 20px 30px' }}>
      <div style={{ height: 1, flex: 1, background: C.border }} />
      <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: C.border }} />
    </div>
  );
}

function EmptyState({ currentRole }: { currentRole?: string }) {
  return (
    <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <span style={{ fontSize: 28, opacity: 0.2 }}>🗺️</span>
      <p style={{ margin: 0, fontSize: 12, color: C.muted, maxWidth: 220 }}>
        {currentRole ? `No mapped paths found for "${currentRole}". Try updating your target role in the Resume Builder.` : 'Set a target role to see your career path simulation.'}
      </p>
      <a href="/resume-builder" style={{ fontSize: 12, color: C.blue, fontWeight: 700, textDecoration: 'none' }}>Update target role →</a>
    </div>
  );
}

// ─── PathTimeline (main export) ───────────────────────────────────────────────

export interface PathTimelineProps {
  /** Accepts both SimulatedPathStep[] (static) and DynamicPathStep[] (AI engine). */
  path:          AnyPathStep[];
  baselinePath?: AnyPathStep[];
  deltaMap?:     DeltaMap;
  currentRole?:  string;
  isLoading?:    boolean;
  error?:        string | null;
}

export function PathTimeline({
  path,
  baselinePath,
  deltaMap,
  currentRole,
  isLoading = false,
  error     = null,
}: PathTimelineProps) {
  const cache = useRef<Map<string, RoadmapResult>>(new Map());

  if (error) return (
    <div style={{ fontSize: 12, color: C.red, background: `${C.red}0a`, border: `1px solid ${C.red}25`, borderRadius: 10, padding: '10px 14px' }}>{error}</div>
  );
  if (isLoading) return <div><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>;
  if (path.length === 0) return <EmptyState currentRole={currentRole} />;

  const vertical = path.filter(s => s.pathType === 'vertical');
  const lateral  = path.filter(s => s.pathType === 'lateral' || s.pathType === 'unknown');

  // Top path = highest probability; fall back to first entry
  const withProb    = path.filter(p => getProbability(p) !== null);
  const topPathRole = withProb.length > 0
    ? withProb.reduce((a, b) => getProbability(a)! >= getProbability(b)! ? a : b).role
    : path[0]?.role ?? null;

  const resolvedRole   = currentRole ?? '';
  const hasMarketData  = path.some(p => getMarketDemand(p) > 0 || getProbability(p) !== null);

  return (
    <div style={{ width: '100%' }}>
      {hasMarketData && <MarketSummaryBar paths={path} />}
      {currentRole && <OriginNode role={currentRole} />}

      {vertical.length > 0 && (
        <>
          {lateral.length > 0 && <PathDivider label="Promotion path" />}
          {vertical.map((step, i) => (
            <StepCard
              key={step.role} step={step}
              isLast={i === vertical.length - 1 && lateral.length === 0}
              isTopPath={step.role === topPathRole}
              currentRole={resolvedRole} cache={cache}
              delta={deltaMap?.[step.role]}
            />
          ))}
        </>
      )}

      {lateral.length > 0 && (
        <>
          <PathDivider label="Lateral pivots" />
          {lateral.map((step, i) => (
            <StepCard
              key={step.role} step={step}
              isLast={i === lateral.length - 1}
              isTopPath={step.role === topPathRole}
              currentRole={resolvedRole} cache={cache}
              delta={deltaMap?.[step.role]}
            />
          ))}
        </>
      )}
    </div>
  );
}