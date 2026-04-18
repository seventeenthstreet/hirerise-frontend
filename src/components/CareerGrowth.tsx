'use client';
import { getAuthToken } from '@/lib/getToken';
/**
 * components/CareerGrowth.tsx
 *
 * Career Growth Engine — full dashboard widget.
 *
 * Reads scores from props (already fetched by the dashboard),
 * persists a snapshot via POST /api/career/growth,
 * generates weekly insights via POST /api/career/insights,
 * and renders: score ring, chart, tasks, streak, gamification.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  computeCareerScore, computeActivityScore, computeStreak,
  generateTasks, computeImprovement,
  type CareerScoreBreakdown, type CareerMetricSnapshot,
  type GrowthInsight, type CareerTask, type StreakData,
} from '@/lib/careerGrowth';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#060810', s0: '#0b0f1a', s1: '#10151f', s2: '#161c2c',
  border: 'rgba(255,255,255,0.07)', borderB: 'rgba(255,255,255,0.12)',
  text: '#dde4ef', muted: '#5a6882',
  green: '#18d98b', blue: '#3b71f8', amber: '#f5a623',
  red: '#f04d3c', purple: '#9b7cf7', pink: '#e96caa',
} as const;

const KF = `
@keyframes spin  { to { transform: rotate(360deg) } }
@keyframes rise  { from { opacity:0;transform:translateY(6px) } to { opacity:1;transform:none } }
@keyframes pop   { from { opacity:0;transform:scale(.96) } to { opacity:1;transform:none } }
@keyframes barIn { from { transform:scaleY(0) } to { transform:scaleY(1) } }
`;

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface CareerGrowthProps {
  atsScore:            number | null;
  jobMatchScore:       number | null;
  applicationsCount:   number;
  resumeUpdatedDays:   number | null;
  skillsAddedRecently: number;
}

// ─── API helper ─────────────────────────────────────────────────────────────────
async function authPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken();
  const res   = await fetch(path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json.data as T;
}
async function authGet<T>(path: string): Promise<T> {
  const token = await getAuthToken();
  const res   = await fetch(path, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function Spinner({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${color}30`, borderTopColor: color, animation: 'spin .65s linear infinite', flexShrink: 0 }} />;
}

// Score Ring
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = size * 0.38, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const col = score >= 75 ? C.green : score >= 60 ? C.blue : score >= 40 ? C.amber : C.red;
  const label = score >= 75 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Building' : 'Starting';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.s2} strokeWidth={size*0.09} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={size*0.09}
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1), stroke .4s' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: size * 0.26, fontWeight: 900, color: col, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: size * 0.11, color: C.muted, fontWeight: 700 }}>/100</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: col }}>{label}</span>
    </div>
  );
}

// Mini chart
function GrowthChart({ history }: { history: CareerMetricSnapshot[] }) {
  if (history.length < 2) {
    return (
      <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 11, color: C.muted, margin: 0, textAlign: 'center' }}>
          Chart builds as you use HireRise — come back tomorrow!
        </p>
      </div>
    );
  }

  const pts = history.slice(-14); // last 14 data points
  const min = Math.max(0,   Math.min(...pts.map(p => p.composite)) - 5);
  const max = Math.min(100, Math.max(...pts.map(p => p.composite)) + 5);
  const range = max - min || 1;
  const W = 320, H = 80, pad = 8;

  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (W - pad * 2));
  const ys = pts.map(p => H - pad - ((p.composite - min) / range) * (H - pad * 2));

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const area = `${path} L${xs[xs.length-1]},${H} L${xs[0]},${H} Z`;

  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const delta = last.composite - prev.composite;
  const trendCol = delta >= 0 ? C.green : C.red;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted }}>14-day trend</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: trendCol }}>
          {delta >= 0 ? `+${delta}` : delta} pts
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, overflow: 'visible' }}>
        <defs>
          <linearGradient id="cg_grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[25, 50, 75].map(v => {
          const y = H - pad - ((v - min) / range) * (H - pad * 2);
          return y > 0 && y < H ? (
            <line key={v} x1={pad} y1={y} x2={W-pad} y2={y}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          ) : null;
        })}
        {/* Area fill */}
        <path d={area} fill="url(#cg_grad)" />
        {/* Line */}
        <path d={path} fill="none" stroke={C.blue} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {/* Latest dot */}
        <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="4"
          fill={C.blue} stroke={C.s0} strokeWidth="2" />
        {/* Label */}
        <text x={xs[xs.length-1]} y={ys[ys.length-1] - 8}
          fill={C.text} fontSize="9" fontWeight="700" textAnchor="middle">
          {last.composite}
        </text>
      </svg>
      {/* Date range */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, marginTop: 2 }}>
        <span>{new Date(pts[0].recorded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// Dimension bars
function DimBars({ breakdown }: { breakdown: CareerScoreBreakdown }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {([
        { label: 'ATS Score',     value: breakdown.ats,       weight: '40%', color: C.blue   },
        { label: 'Job Match',     value: breakdown.jobMatch,  weight: '30%', color: C.purple },
        { label: 'Interview',     value: breakdown.interview, weight: '20%', color: C.green  },
        { label: 'Activity',      value: breakdown.activity,  weight: '10%', color: C.amber  },
      ] as const).map(d => (
        <div key={d.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 3 }}>
            <span style={{ color: C.muted }}>{d.label} <span style={{ opacity: 0.5 }}>({d.weight})</span></span>
            <span style={{ fontWeight: 700, color: d.color }}>{d.value}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 4, background: C.s2 }}>
            <div style={{ height: 4, borderRadius: 4, background: d.color, width: `${d.value}%`, transition: 'width 1s cubic-bezier(.4,0,.2,1)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Insight card
const INSIGHT_COLORS: Record<GrowthInsight['type'], string> = {
  improvement:  C.green,
  suggestion:   C.blue,
  warning:      C.amber,
  celebration:  C.pink,
};

function InsightCard({ insight }: { insight: GrowthInsight }) {
  const col = INSIGHT_COLORS[insight.type];
  return (
    <div style={{ background: `${col}08`, border: `1px solid ${col}20`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{ fontSize: 16 }}>{insight.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{insight.title}</span>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{insight.body}</p>
    </div>
  );
}

// Task row
function TaskRow({ task }: { task: CareerTask }) {
  const priCol = task.priority === 'high' ? C.red : task.priority === 'medium' ? C.amber : C.muted;
  return (
    <a href={task.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: `1px solid ${C.border}`, textDecoration: 'none', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: priCol, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, color: C.text }}>{task.label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: `${C.green}18`, borderRadius: 20, padding: '2px 8px', flexShrink: 0 }}>
        +{task.points} pts
      </span>
      <span style={{ fontSize: 10, color: C.muted }}>→</span>
    </a>
  );
}

// Streak badge
function StreakBadge({ streak }: { streak: StreakData }) {
  if (streak.currentStreak === 0) return null;
  const fire = streak.currentStreak >= 7 ? '🔥' : streak.currentStreak >= 3 ? '⚡' : '✨';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${C.amber}12`, border: `1px solid ${C.amber}25`, borderRadius: 9, padding: '5px 10px' }}>
      <span style={{ fontSize: 14 }}>{fire}</span>
      <div>
        <span style={{ fontSize: 12, fontWeight: 900, color: C.amber }}>{streak.currentStreak}</span>
        <span style={{ fontSize: 10, color: C.muted }}> day streak</span>
      </div>
      {streak.longestStreak > streak.currentStreak && (
        <span style={{ fontSize: 9, color: C.muted, marginLeft: 4 }}>best: {streak.longestStreak}</span>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export function CareerGrowthWidget({
  atsScore, jobMatchScore, applicationsCount,
  resumeUpdatedDays, skillsAddedRecently,
}: CareerGrowthProps) {
  const [history,    setHistory]    = useState<CareerMetricSnapshot[]>([]);
  const [breakdown,  setBreakdown]  = useState<CareerScoreBreakdown | null>(null);
  const [insights,   setInsights]   = useState<GrowthInsight[]>([]);
  const [weeklyMsg,  setWeeklyMsg]  = useState('');
  const [tasks,      setTasks]      = useState<CareerTask[]>([]);
  const [streak,     setStreak]     = useState<StreakData>({ currentStreak: 0, longestStreak: 0, lastActiveDate: null });
  const [tab,        setTab]        = useState<'score' | 'chart' | 'insights' | 'tasks'>('score');
  const [loading,    setLoading]    = useState(true);
  const [insLoading, setInsLoading] = useState(false);
  const didLoad = useRef(false);

  const interviewScore = React.useMemo(() => {
    try {
      const sessions = JSON.parse(sessionStorage.getItem('interview_prep_v1') ?? '[]');
      if (!sessions.length) return null;
      return Math.round(sessions.slice(0, 5).reduce((s: number, r: {score: number}) => s + r.score, 0) / Math.min(sessions.length, 5));
    } catch { return null; }
  }, []);

  // ── localStorage history management ───────────────────────────────────────
  const HISTORY_KEY = 'career_growth_history';
  function loadLocalHistory(): CareerMetricSnapshot[] {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
  }
  function saveLocalSnapshot(bd: CareerScoreBreakdown) {
    try {
      const prev = loadLocalHistory();
      // Dedup: skip if same composite in last hour
      const last = prev[prev.length - 1];
      const oneHourAgo = Date.now() - 3_600_000;
      if (last && last.composite === bd.composite && new Date(last.recorded_at).getTime() > oneHourAgo) return prev;
      const snap: CareerMetricSnapshot = {
        user_id: 'local', composite: bd.composite,
        ats_score: bd.ats, job_match: bd.jobMatch,
        interview_score: bd.interview, activity_score: bd.activity,
        recorded_at: new Date().toISOString(),
      };
      const next = [...prev, snap].slice(-30); // keep last 30
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    } catch { return loadLocalHistory(); }
  }

  const load = useCallback(async () => {
    if (didLoad.current) return;
    didLoad.current = true;
    setLoading(true);
    try {
      const actScore = computeActivityScore({
        applicationsCount,
        resumeUpdatedDays,
        skillsAddedRecently,
        interviewSessionsDone: (() => {
          try { return JSON.parse(sessionStorage.getItem('interview_prep_v1') ?? '[]').length; } catch { return 0; }
        })(),
      });

      // POST to API for score computation (non-fatal if fails)
      let bd: CareerScoreBreakdown;
      try {
        const result = await authPost<{ breakdown: CareerScoreBreakdown }>('/api/career/growth', {
          atsScore, jobMatchScore, interviewScore, activityScore: actScore,
        });
        bd = result.breakdown;
      } catch {
        // Compute locally if API unavailable
        bd = computeCareerScore({ atsScore, jobMatchScore, interviewScore, activityScore: actScore });
      }

      // Persist snapshot to localStorage + load history
      const hist = saveLocalSnapshot(bd);
      setHistory(hist);
      setBreakdown(bd);
      setTasks(generateTasks(bd, applicationsCount));
      setStreak(computeStreak(hist));
    } catch (e) {
      // Full fallback
      const actScore = computeActivityScore({ applicationsCount, resumeUpdatedDays, skillsAddedRecently, interviewSessionsDone: 0 });
      const bd = computeCareerScore({ atsScore, jobMatchScore, interviewScore, activityScore: actScore });
      setBreakdown(bd);
      setTasks(generateTasks(bd, applicationsCount));
    } finally {
      setLoading(false);
    }
  }, [atsScore, jobMatchScore, interviewScore, applicationsCount, resumeUpdatedDays, skillsAddedRecently]);

  useEffect(() => { load(); }, [load]);

  const loadInsights = useCallback(async () => {
    if (!breakdown || insLoading || insights.length > 0) return;
    setInsLoading(true);
    try {
      const result = await authPost<{ insights: GrowthInsight[]; weeklyMessage: string }>('/api/career/insights', {
        breakdown, history, applicationsCount, streak: streak.currentStreak,
      });
      setInsights(result.insights);
      setWeeklyMsg(result.weeklyMessage);
    } catch { /* non-fatal */ }
    finally { setInsLoading(false); }
  }, [breakdown, history, applicationsCount, streak, insLoading, insights.length]);

  // Load insights when user switches to insights tab
  useEffect(() => { if (tab === 'insights') loadInsights(); }, [tab, loadInsights]);

  if (loading || !breakdown) {
    return (
      <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Spinner size={14} color={C.blue} />
          <span style={{ fontSize: 12, color: C.muted }}>Computing career score…</span>
        </div>
      </div>
    );
  }

  const prev = history.length >= 2 ? history[history.length - 2].composite : null;
  const improvement = computeImprovement(breakdown.composite, prev);

  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <style>{KF}</style>

      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📈</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Career Growth</div>
              <div style={{ fontSize: 9, color: C.muted }}>Composite score · updated now</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {improvement !== null && (
              <span style={{ fontSize: 11, fontWeight: 800, color: improvement >= 0 ? C.green : C.red, background: `${improvement >= 0 ? C.green : C.red}14`, borderRadius: 20, padding: '2px 8px' }}>
                {improvement >= 0 ? `+${improvement}%` : `${improvement}%`}
              </span>
            )}
            <StreakBadge streak={streak} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, padding: '6px 8px', background: C.s1, borderBottom: `1px solid ${C.border}` }}>
        {([
          { id: 'score' as const,    label: '🎯 Score'    },
          { id: 'chart' as const,    label: '📊 Chart'    },
          { id: 'insights' as const, label: '✨ Insights' },
          { id: 'tasks' as const,    label: '✅ Tasks'    },
        ]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '5px 4px', border: 'none', borderRadius: 7, cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 10, transition: 'all .15s',
            background: tab === t.id ? C.s0 : 'transparent',
            color: tab === t.id ? C.text : C.muted,
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,.3)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: '14px 16px', animation: 'rise .2s ease-out' }} key={tab}>

        {/* Score tab */}
        {tab === 'score' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <ScoreRing score={breakdown.composite} size={96} />
              <div style={{ flex: 1 }}>
                <DimBars breakdown={breakdown} />
              </div>
            </div>
            {/* Gamification milestones */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {[
                { threshold: 40,  label: '🌱 Started',  reached: breakdown.composite >= 40  },
                { threshold: 60,  label: '⚡ Building',  reached: breakdown.composite >= 60  },
                { threshold: 75,  label: '🚀 Strong',    reached: breakdown.composite >= 75  },
                { threshold: 90,  label: '🏆 Elite',     reached: breakdown.composite >= 90  },
              ].map(m => (
                <span key={m.threshold} style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                  background: m.reached ? `${C.green}18` : C.s2,
                  color: m.reached ? C.green : C.muted,
                  border: `1px solid ${m.reached ? C.green + '30' : C.border}`,
                  opacity: m.reached ? 1 : 0.5,
                }}>{m.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Chart tab */}
        {tab === 'chart' && <GrowthChart history={history} />}

        {/* Insights tab */}
        {tab === 'insights' && (
          <div>
            {insLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Spinner size={13} color={C.pink} />
                <span style={{ fontSize: 11, color: C.muted }}>Ava is generating insights…</span>
              </div>
            )}
            {weeklyMsg && (
              <div style={{ background: `${C.pink}0a`, border: `1px solid ${C.pink}22`, borderRadius: 10, padding: '9px 12px', marginBottom: 12, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14 }}>🤖</span>
                <p style={{ margin: 0, fontSize: 11, color: C.text, lineHeight: 1.5, fontStyle: 'italic' }}>{weeklyMsg}</p>
              </div>
            )}
            {insights.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {insights.map(ins => <InsightCard key={ins.id} insight={ins} />)}
              </div>
            ) : !insLoading ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>Click the tab to load weekly insights from Ava.</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Tasks tab */}
        {tab === 'tasks' && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: C.muted, marginBottom: 8 }}>
              Actions that will improve your score
            </div>
            {tasks.length > 0 ? tasks.map(t => <TaskRow key={t.id} task={t} />) : (
              <p style={{ fontSize: 12, color: C.muted, margin: 0, textAlign: 'center', padding: '16px 0' }}>
                Your profile is strong — keep applying and practising!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}