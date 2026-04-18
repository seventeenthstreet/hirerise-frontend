'use client';
import { getAuthToken } from '@/lib/getToken';
/**
 * components/SalaryPredictor.tsx
 *
 * Salary Predictor Engine UI.
 *
 * Exports:
 *   SalaryPredictorCard  — full card with range, gap, simulator, insights
 *   SalaryPredictorWidget — compact dashboard widget
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { ResumeContent } from '@/lib/supabase';
import type {
  SalaryPrediction, SalaryInsight, SimulatorScenario,
} from '@/lib/salaryData';
import type { LocationTier } from '@/lib/salaryData';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#060810', s0: '#0b0f1a', s1: '#10151f', s2: '#161c2c', s3: '#1c2438',
  border: 'rgba(255,255,255,0.07)', borderB: 'rgba(255,255,255,0.12)',
  text: '#dde4ef', muted: '#5a6882',
  green: '#18d98b', blue: '#3b71f8', amber: '#f5a623',
  red: '#f04d3c', purple: '#9b7cf7', pink: '#e96caa',
} as const;

const KF = `
@keyframes spin  { to { transform:rotate(360deg) } }
@keyframes rise  { from { opacity:0;transform:translateY(6px) } to { opacity:1;transform:none } }
@keyframes grow  { from { width:0 } to { width:var(--w) } }
`;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return `₹${n.toFixed(1)}L`;
}
function gapColor(pct: number): string {
  return pct >= 10 ? C.green : pct >= -5 ? C.amber : C.red;
}
function gapLabel(pct: number): string {
  return pct >= 10 ? 'Above Market' : pct >= -5 ? 'Near Market' : 'Below Market';
}

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken();
  const res   = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

// ─── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${color}30`, borderTopColor: color, animation: 'spin .65s linear infinite', flexShrink: 0 }} />;
}

// ─── Salary range bar ─────────────────────────────────────────────────────────
function RangeBar({
  predicted, market,
}: { predicted: SalaryPrediction['predicted']; market: SalaryPrediction['market'] }) {
  const lo  = Math.min(predicted.min, market.min) * 0.95;
  const hi  = Math.max(predicted.max, market.max) * 1.05;
  const rng = hi - lo || 1;

  function pct(v: number) { return ((v - lo) / rng * 100).toFixed(1) + '%'; }

  return (
    <div style={{ position: 'relative', height: 48, marginBottom: 8 }}>
      {/* Market band (grey) */}
      <div style={{
        position: 'absolute', top: 24, height: 8, borderRadius: 4,
        background: C.s3, border: `1px solid ${C.border}`,
        left: pct(market.min), width: `calc(${pct(market.max)} - ${pct(market.min)})`,
      }} />
      {/* Predicted band (blue) */}
      <div style={{
        position: 'absolute', top: 18, height: 8, borderRadius: 4,
        background: `linear-gradient(90deg, ${C.blue}90, ${C.purple}90)`,
        left: pct(predicted.min), width: `calc(${pct(predicted.max)} - ${pct(predicted.min)})`,
        boxShadow: `0 0 10px ${C.blue}40`,
      }} />
      {/* Predicted median pin */}
      <div style={{
        position: 'absolute', top: 12, width: 3, height: 20, borderRadius: 2,
        background: C.blue, left: pct(predicted.median),
        transform: 'translateX(-50%)',
      }} />
      {/* Market median pin */}
      <div style={{
        position: 'absolute', top: 20, width: 3, height: 12, borderRadius: 2,
        background: C.amber, left: pct(market.median),
        transform: 'translateX(-50%)',
      }} />
      {/* Labels */}
      <div style={{ position: 'absolute', top: 0, left: pct(predicted.median), transform: 'translateX(-50%)', fontSize: 9, fontWeight: 800, color: C.blue, whiteSpace: 'nowrap' }}>
        You {fmt(predicted.median)}
      </div>
      <div style={{ position: 'absolute', top: 38, left: pct(market.median), transform: 'translateX(-50%)', fontSize: 9, fontWeight: 700, color: C.amber, whiteSpace: 'nowrap' }}>
        Mkt {fmt(market.median)}
      </div>
    </div>
  );
}

// ─── Gap indicator ─────────────────────────────────────────────────────────────
function GapBadge({ gap, gapPercent }: { gap: number; gapPercent: number }) {
  const col = gapColor(gapPercent);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${col}10`, border: `1px solid ${col}25`, borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ fontSize: 20 }}>{gapPercent >= 10 ? '🎯' : gapPercent >= -5 ? '📊' : '⚠️'}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: col }}>{gapLabel(gapPercent)}</div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
          {gap >= 0
            ? `${fmt(Math.abs(gap))} above market median`
            : `${fmt(Math.abs(gap))} below market median — improve resume & skills to close the gap`}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 900, color: col, whiteSpace: 'nowrap' }}>
        {gapPercent >= 0 ? '+' : ''}{gapPercent}%
      </div>
    </div>
  );
}

// ─── Factor bars ───────────────────────────────────────────────────────────────
function FactorRow({ label, value, max, color, hint }: { label: string; value: number; max: number; color: string; hint: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 3 }}>
        <span style={{ color: C.muted }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{hint}</span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: C.s2 }}>
        <div style={{ height: 4, borderRadius: 4, background: color, width: `${pct}%`, transition: 'width 1s cubic-bezier(.4,0,.2,1)' }} />
      </div>
    </div>
  );
}

// ─── Growth simulator ──────────────────────────────────────────────────────────
function GrowthSimulator({ scenarios, currentMedian }: { scenarios: SimulatorScenario[]; currentMedian: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxSalary = Math.max(...scenarios.map(s => s.salary), currentMedian) * 1.05;

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: C.muted, marginBottom: 10 }}>
        Growth Simulator — What could you earn?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Current baseline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 100, fontSize: 10, color: C.muted, textAlign: 'right', flexShrink: 0 }}>Current</div>
          <div style={{ flex: 1, height: 20, background: C.s2, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: '100%', borderRadius: 4, background: `${C.muted}50`, width: `${(currentMedian / maxSalary) * 100}%`, transition: 'width 1s' }} />
          </div>
          <div style={{ width: 60, fontSize: 10, fontWeight: 700, color: C.muted, flexShrink: 0 }}>{fmt(currentMedian)}</div>
        </div>

        {scenarios.map((s, i) => (
          <a key={s.label} href={s.href}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', cursor: 'pointer', transition: 'opacity .15s', opacity: hovered !== null && hovered !== i ? 0.6 : 1 }}>
            <div style={{ width: 100, fontSize: 10, color: C.text, textAlign: 'right', flexShrink: 0, lineHeight: 1.3 }}>{s.label}</div>
            <div style={{ flex: 1, height: 20, background: C.s2, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: `linear-gradient(90deg, ${C.blue}, ${C.green})`,
                width: `${(s.salary / maxSalary) * 100}%`,
                transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                boxShadow: hovered === i ? `0 0 8px ${C.blue}60` : 'none',
              }} />
              {/* Delta label */}
              <div style={{
                position: 'absolute', right: 4, top: 2,
                fontSize: 9, fontWeight: 800, color: C.green,
                opacity: hovered === i ? 1 : 0, transition: 'opacity .2s',
              }}>
                +{fmt(s.increase)}
              </div>
            </div>
            <div style={{ width: 60, fontSize: 10, fontWeight: 700, color: C.green, flexShrink: 0 }}>{fmt(s.salary)}</div>
          </a>
        ))}
      </div>
      <div style={{ fontSize: 9, color: C.muted, marginTop: 8, textAlign: 'center' }}>
        Click any scenario to take action →
      </div>
    </div>
  );
}

// ─── Insight card ───────────────────────────────────────────────────────────────
function InsightRow({ insight }: { insight: SalaryInsight }) {
  const colMap: Record<SalaryInsight['type'], string> = {
    celebration: C.green, strength: C.blue, action: C.amber, gap: C.red,
  };
  const col = colMap[insight.type];
  return (
    <div style={{ display: 'flex', gap: 9, padding: '8px 0', borderBottom: `1px solid ${C.border}`, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{insight.icon}</span>
      <p style={{ margin: 0, fontSize: 11, color: C.text, lineHeight: 1.5 }}>{insight.text}</p>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0, marginTop: 4 }} />
    </div>
  );
}

// ─── Location selector ──────────────────────────────────────────────────────────
const LOCATIONS: { value: LocationTier; label: string }[] = [
  { value: 'metro',  label: '🏙 Metro (Bangalore/Mumbai/Delhi)' },
  { value: 'tier1',  label: '🏘 Tier 1 (Ahmedabad/Kochi)' },
  { value: 'tier2',  label: '🏡 Tier 2 (Indore/Bhopal)' },
  { value: 'tier3',  label: '🌾 Tier 3 / Small City' },
  { value: 'remote', label: '💻 Remote' },
];

// ─── Main response type ─────────────────────────────────────────────────────────
interface PredictResponse {
  prediction:      SalaryPrediction;
  staticInsights:  SalaryInsight[];
  avaInsights:     string[];
  atsUsed:         number;
  expYearsUsed:    number;
}

// ─── SalaryPredictorCard ────────────────────────────────────────────────────────
export interface SalaryPredictorCardProps {
  resumeData?:    ResumeContent | null;
  targetRole?:    string;
  atsScore?:      number | null;
  currentSalary?: number | null;
}

export function SalaryPredictorCard({
  resumeData, targetRole, atsScore, currentSalary,
}: SalaryPredictorCardProps) {
  const [location,    setLocation]    = useState<LocationTier>('metro');
  const [custSalary,  setCustSalary]  = useState(currentSalary?.toString() ?? '');
  const [result,      setResult]      = useState<PredictResponse | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [avaLoading,  setAvaLoading]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [tab,         setTab]         = useState<'range' | 'factors' | 'simulator' | 'insights'>('range');

  const role = targetRole || resumeData?.targetRole || '';

  const predict = useCallback(async (withAva = false) => {
    if (!resumeData || !role) return;
    if (withAva) { setAvaLoading(true); }
    else { setLoading(true); setError(null); }

    try {
      const res = await authPost<PredictResponse>('/api/salary/predict', {
        resumeData,
        targetRole:          role,
        location,
        currentSalary:       custSalary ? parseFloat(custSalary) : null,
        includeAvaInsights:  withAva,
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message ?? 'Prediction failed');
    } finally {
      setLoading(false);
      setAvaLoading(false);
    }
  }, [resumeData, role, location, custSalary]);

  // Auto-predict when location changes (if already predicted)
  useEffect(() => { if (result) predict(false); }, [location]);

  const pred = result?.prediction;
  const ins  = result?.staticInsights ?? [];

  const inputStyle: React.CSSProperties = {
    background: C.s1, border: `1px solid ${C.borderB}`, borderRadius: 7,
    padding: '6px 10px', fontSize: 11, color: C.text, outline: 'none',
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <style>{KF}</style>

      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💰</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Salary Predictor</div>
              {role && <div style={{ fontSize: 10, color: C.muted }}>{role}</div>}
            </div>
          </div>
          {pred && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.amber, lineHeight: 1 }}>{fmt(pred.predicted.median)}</div>
              <div style={{ fontSize: 9, color: C.muted }}>predicted median</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginBottom: 3 }}>Location</div>
            <select value={location} onChange={e => setLocation(e.target.value as LocationTier)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {LOCATIONS.map(l => <option key={l.value} value={l.value} style={{ background: C.s0 }}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, marginBottom: 3 }}>Current Salary (LPA, optional)</div>
            <input
              type="number" value={custSalary}
              onChange={e => setCustSalary(e.target.value)}
              placeholder="e.g. 12"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px' }}>
        {!result && !loading && (
          <>
            {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 10 }}>{error}</div>}
            {!role && (
              <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                <p style={{ margin: '0 0 4px', fontSize: 12, color: C.muted }}>Set your target role in the Resume Builder to get a salary prediction.</p>
                <a href="/resume-builder" style={{ fontSize: 11, color: C.blue, textDecoration: 'none', fontWeight: 600 }}>Set target role →</a>
              </div>
            )}
            {role && (
              <button onClick={() => predict(false)} style={{
                width: '100%', padding: '11px', borderRadius: 10, border: 'none',
                background: `linear-gradient(135deg, ${C.amber}, #f97316)`,
                color: '#fff', fontWeight: 800, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                💰 Predict My Salary
              </button>
            )}
          </>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '24px 0' }}>
            <Spinner size={16} color={C.amber} />
            <span style={{ fontSize: 12, color: C.muted }}>Calculating your salary range…</span>
          </div>
        )}

        {pred && !loading && (
          <div style={{ animation: 'rise .3s ease-out' }}>
            {/* Range bar */}
            <div style={{ marginBottom: 12 }}>
              <RangeBar predicted={pred.predicted} market={pred.market} />
              {/* Min/Max labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginTop: 4 }}>
                <span>{fmt(pred.predicted.min)} min</span>
                <span style={{ fontWeight: 800, color: C.amber }}>{fmt(pred.predicted.median)} median</span>
                <span>{fmt(pred.predicted.max)} max</span>
              </div>
            </div>

            {/* Gap */}
            <div style={{ marginBottom: 14 }}>
              <GapBadge gap={pred.gap} gapPercent={pred.gapPercent} />
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 3, background: C.s2, borderRadius: 10, padding: '3px', marginBottom: 12 }}>
              {([
                { id: 'range'     as const, label: '📊 Market'    },
                { id: 'factors'   as const, label: '⚙ Factors'    },
                { id: 'simulator' as const, label: '🚀 Simulator'  },
                { id: 'insights'  as const, label: '💡 Insights'   },
              ]).map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: '5px 2px', border: 'none', borderRadius: 7,
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
                  fontSize: 10, transition: 'all .15s',
                  background: tab === t.id ? C.s0 : 'transparent',
                  color: tab === t.id ? C.text : C.muted,
                  boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,.3)' : 'none',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Tab: Market comparison */}
            {tab === 'range' && (
              <div style={{ animation: 'rise .2s ease-out' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: 'Your Min',    val: pred.predicted.min,    col: C.blue  },
                    { label: 'Your Median', val: pred.predicted.median, col: C.amber },
                    { label: 'Market Min',  val: pred.market.min,       col: C.muted },
                    { label: 'Market Median',val: pred.market.median,   col: C.muted },
                  ].map(s => (
                    <div key={s.label} style={{ background: C.s1, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: s.col }}>{fmt(s.val)}</div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: C.muted, textAlign: 'center' }}>
                  Experience used: {result!.expYearsUsed} yrs · ATS: {result!.atsUsed}/100 · {pred.location}
                </div>
              </div>
            )}

            {/* Tab: Score factors */}
            {tab === 'factors' && (
              <div style={{ animation: 'rise .2s ease-out' }}>
                <FactorRow label="Role Baseline"    value={pred.factors.roleBaseline}       max={50}  color={C.muted}   hint={`₹${pred.factors.roleBaseline.toFixed(1)}L`} />
                <FactorRow label="Experience"       value={pred.factors.experienceFactor}   max={3}   color={C.blue}    hint={`${pred.factors.experienceFactor.toFixed(2)}×`} />
                <FactorRow label="Skills Match"     value={pred.factors.skillsFactor}       max={1.2} color={C.purple}  hint={`${pred.factors.skillsFactor.toFixed(2)}×`} />
                <FactorRow label="Resume Quality"   value={pred.factors.atsFactor}          max={1.12}color={C.green}   hint={`${pred.factors.atsFactor.toFixed(2)}×`} />
                <FactorRow label="Location"         value={pred.factors.locationMultiplier} max={1.0} color={C.amber}   hint={`${(pred.factors.locationMultiplier * 100).toFixed(0)}%`} />
              </div>
            )}

            {/* Tab: Growth simulator */}
            {tab === 'simulator' && (
              <div style={{ animation: 'rise .2s ease-out' }}>
                <GrowthSimulator scenarios={pred.simulator} currentMedian={pred.predicted.median} />
              </div>
            )}

            {/* Tab: Insights */}
            {tab === 'insights' && (
              <div style={{ animation: 'rise .2s ease-out' }}>
                {ins.map(i => <InsightRow key={i.id} insight={i} />)}

                {/* Ava insights */}
                {result!.avaInsights.length > 0 && (
                  <div style={{ marginTop: 12, background: `${C.pink}08`, border: `1px solid ${C.pink}20`, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                      <span>🤖</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: C.pink }}>Ava's salary coaching</span>
                    </div>
                    {result!.avaInsights.map((a, i) => (
                      <p key={i} style={{ margin: i > 0 ? '6px 0 0' : '0', fontSize: 11, color: C.text, lineHeight: 1.5 }}>{a}</p>
                    ))}
                  </div>
                )}

                {/* Load Ava insights button */}
                {result!.avaInsights.length === 0 && (
                  <button onClick={() => predict(true)} disabled={avaLoading}
                    style={{ marginTop: 12, width: '100%', padding: '8px', borderRadius: 9, border: `1px solid ${C.pink}30`, background: `${C.pink}08`, color: C.pink, fontWeight: 700, fontSize: 11, cursor: avaLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    {avaLoading ? <><Spinner size={12} color={C.pink} /> Ava is generating insights…</> : '🤖 Get Ava\'s Salary Coaching'}
                  </button>
                )}
              </div>
            )}

            {/* Recalculate */}
            <button onClick={() => predict(false)} style={{ marginTop: 12, width: '100%', padding: '7px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ↻ Recalculate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SalaryPredictorWidget (compact dashboard) ─────────────────────────────────
export function SalaryPredictorWidget({
  resumeData, targetRole, atsScore,
}: { resumeData?: ResumeContent | null; targetRole?: string; atsScore?: number | null }) {
  const [result,  setResult]  = useState<PredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const role = targetRole || resumeData?.targetRole || '';

  const run = useCallback(async () => {
    if (!resumeData || !role || loading) return;
    setLoading(true);
    try {
      const res = await authPost<PredictResponse>('/api/salary/predict', {
        resumeData, targetRole: role, location: 'metro',
      });
      setResult(res);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [resumeData, role, loading]);

  useEffect(() => { if (resumeData && role) run(); }, [resumeData, role]);

  const pred = result?.prediction;

  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <style>{KF}</style>
      <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💰</span>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Salary Prediction</div>
        </div>
        <a href="/salary-predictor" style={{ fontSize: 10, color: C.amber, textDecoration: 'none', fontWeight: 600 }}>Full report →</a>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Spinner size={12} color={C.amber} />
            <span style={{ fontSize: 11, color: C.muted }}>Calculating…</span>
          </div>
        )}

        {!loading && !pred && !role && (
          <p style={{ margin: 0, fontSize: 11, color: C.muted }}>Set your target role to see salary prediction.</p>
        )}

        {pred && !loading && (
          <div style={{ animation: 'rise .3s ease-out' }}>
            {/* Big number */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: C.amber, lineHeight: 1 }}>{fmt(pred.predicted.median)}</span>
              <span style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>median · {pred.location}</span>
            </div>

            {/* Mini range */}
            <div style={{ height: 6, borderRadius: 3, background: C.s2, marginBottom: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg,${C.blue},${C.amber})`, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, marginBottom: 12 }}>
              <span>{fmt(pred.predicted.min)}</span>
              <span>{fmt(pred.predicted.max)}</span>
            </div>

            {/* Gap pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: gapColor(pred.gapPercent) }}>{gapLabel(pred.gapPercent)}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: gapColor(pred.gapPercent), background: `${gapColor(pred.gapPercent)}12`, borderRadius: 20, padding: '1px 7px' }}>
                {pred.gapPercent >= 0 ? '+' : ''}{pred.gapPercent}% vs market
              </span>
            </div>

            {/* Top simulator scenario */}
            {pred.simulator[0] && (
              <a href={pred.simulator[0].href} style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${C.green}08`, border: `1px solid ${C.green}20`, borderRadius: 9, padding: '8px 11px', textDecoration: 'none' }}>
                <span style={{ fontSize: 12 }}>🚀</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{pred.simulator[0].label}</div>
                  <div style={{ fontSize: 10, color: C.green, marginTop: 1 }}>+{fmt(pred.simulator[0].increase)} potential</div>
                </div>
                <span style={{ fontSize: 10, color: C.muted }}>→</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}