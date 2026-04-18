'use client';
import { getAuthToken } from '@/lib/getToken';
/**
 * components/career/CareerPathSection.tsx
 *
 * Dashboard section widget for Career Path Simulation.
 * Owns baseline fetch + "What If" simulation panel.
 *
 * "What If" rules:
 *   - Simulated data is NEVER persisted — it lives in component state only
 *   - Re-calls POST /api/career/simulate with modified inputs
 *   - Computes per-role deltas (timelineMonths, salaryAtReadiness.mid)
 *   - Passes a deltaMap down to PathTimeline so each card can show +/- badges
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PathTimeline }       from '@/components/career/PathTimeline';
import { getAllSkills }        from '@/lib/data/roleSkills';
import type { SimulatedPathStep } from '@/lib/services/careerPathService';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  s0: '#0d1117', s1: '#111822', s2: '#161f2e',
  border: 'rgba(255,255,255,0.07)', borderB: 'rgba(255,255,255,0.11)',
  text: '#dde4ef', muted: '#5f6d87',
  green: '#1fd8a0', blue: '#3c72f8', amber: '#f4a928',
  red: '#ef5b48', purple: '#9b7cf7', pink: '#e96caa',
} as const;

// ─── Auth helper ──────────────────────────────────────────────────────────────
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

// ─── Delta types (passed to PathTimeline) ─────────────────────────────────────
export interface StepDelta {
  timelineDelta: number;   // negative = faster (better)
  salaryDelta:   number;   // positive = higher (better)
  readinessDelta: number;  // positive = more ready (better)
}
export type DeltaMap = Record<string, StepDelta>; // keyed by step.role

function computeDeltas(
  baseline: SimulatedPathStep[],
  simulated: SimulatedPathStep[],
): DeltaMap {
  const map: DeltaMap = {};
  for (const base of baseline) {
    const sim = simulated.find(s => s.role === base.role);
    if (!sim) continue;
    map[base.role] = {
      timelineDelta:  sim.timelineMonths       - base.timelineMonths,
      salaryDelta:    sim.salaryAtReadiness.mid - base.salaryAtReadiness.mid,
      readinessDelta: sim.readinessPct          - base.readinessPct,
    };
  }
  return map;
}

// ─── What-If simulator panel ──────────────────────────────────────────────────

interface SimulatorPanelProps {
  baseSkills:     string[];
  baseAts:        number | null;
  currentRole:    string;
  experience:     number;
  onRun:          (addedSkills: string[], improvedAts: number | null) => void;
  onReset:        () => void;
  isRunning:      boolean;
  hasResult:      boolean;
}

function SimulatorPanel({
  baseSkills, baseAts, currentRole,
  onRun, onReset, isRunning, hasResult,
}: SimulatorPanelProps) {
  // Lazy-load the full skill list only when the panel opens (avoids parsing on mount)
  const [allSkills]     = useState<string[]>(() => getAllSkills());
  const [skillInput,    setSkillInput]    = useState('');
  const [addedSkills,   setAddedSkills]   = useState<string[]>([]);
  const [improvedAts,   setImprovedAts]   = useState<number>(
    baseAts != null ? Math.min(100, Math.round(baseAts + 10)) : 75,
  );
  const [useAtsBoost,   setUseAtsBoost]   = useState(false);

  const addSkill = useCallback(() => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    // Prevent duplicates (case-insensitive) and skills already owned
    const lower = trimmed.toLowerCase();
    const alreadyHas  = baseSkills.some(s => s.toLowerCase() === lower);
    const alreadyAdded = addedSkills.some(s => s.toLowerCase() === lower);
    if (!alreadyHas && !alreadyAdded) {
      setAddedSkills(prev => [...prev, trimmed]);
    }
    setSkillInput('');
  }, [skillInput, baseSkills, addedSkills]);

  const removeAdded = (skill: string) =>
    setAddedSkills(prev => prev.filter(s => s !== skill));

  const canRun = addedSkills.length > 0 || useAtsBoost;

  const handleRun = () => {
    if (!canRun) return;
    onRun(addedSkills, useAtsBoost ? improvedAts : null);
  };

  const handleReset = () => {
    setAddedSkills([]);
    setUseAtsBoost(false);
    setImprovedAts(baseAts != null ? Math.min(100, Math.round(baseAts + 10)) : 75);
    onReset();
  };

  const inp: React.CSSProperties = {
    background: C.s2, border: `1px solid ${C.borderB}`, borderRadius: 7,
    padding: '6px 10px', fontSize: 11, color: C.text,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{
      margin: '0 18px 14px',
      background: `${C.purple}08`,
      border: `1px solid ${C.purple}25`,
      borderRadius: 11,
      padding: '14px 15px',
    }}>
      <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.12em', color: C.purple }}>
        🔮 What If Simulator
      </p>

      {/* ── Add skills ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: C.muted }}>
          Simulate adding new skills
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              list="whatif-skills"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSkill()}
              placeholder="Type a skill and press Enter…"
              style={{ ...inp, width: '100%' }}
            />
            <datalist id="whatif-skills">
              {allSkills
                .filter(s => !baseSkills.some(b => b.toLowerCase() === s.toLowerCase()))
                .slice(0, 100)
                .map(s => <option key={s} value={s} />)}
            </datalist>
          </div>
          <button onClick={addSkill} disabled={!skillInput.trim()} style={{
            padding: '6px 12px', borderRadius: 7, border: 'none',
            background: skillInput.trim() ? C.blue : C.s2,
            color: '#fff', fontSize: 11, fontWeight: 700,
            cursor: skillInput.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', flexShrink: 0,
          }}>
            Add
          </button>
        </div>
        {/* Added skills chips */}
        {addedSkills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
            {addedSkills.map(s => (
              <span key={s} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 10, padding: '3px 8px', borderRadius: 20,
                background: `${C.green}15`, border: `1px solid ${C.green}30`, color: C.green,
              }}>
                + {s}
                <button onClick={() => removeAdded(s)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.green, fontSize: 13, lineHeight: 1,
                  padding: 0, fontFamily: 'inherit',
                }} aria-label={`Remove ${s}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── ATS boost ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={useAtsBoost}
            onChange={e => setUseAtsBoost(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: C.blue, width: 13, height: 13 }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>
            Simulate improved ATS score
          </span>
        </label>
        {useAtsBoost && (
          <div style={{ marginTop: 8, paddingLeft: 21 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min={baseAts ?? 0}
                max={100}
                value={improvedAts}
                onChange={e => setImprovedAts(Number(e.target.value))}
                style={{ flex: 1, accentColor: C.blue, cursor: 'pointer' }}
              />
              <span style={{
                fontSize: 13, fontWeight: 900, color: C.blue,
                minWidth: 36, textAlign: 'right',
              }}>
                {improvedAts}
              </span>
            </div>
            {baseAts != null && (
              <p style={{ margin: '3px 0 0', fontSize: 10, color: C.muted }}>
                Current: {baseAts} → Simulated: {improvedAts}
                {' '}
                <span style={{ color: C.green, fontWeight: 700 }}>
                  (+{improvedAts - baseAts} pts)
                </span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        <button
          onClick={handleRun}
          disabled={!canRun || isRunning}
          style={{
            padding: '7px 16px', borderRadius: 8, border: 'none',
            background: canRun && !isRunning ? C.purple : C.s2,
            color: '#fff', fontSize: 11, fontWeight: 800,
            cursor: canRun && !isRunning ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          {isRunning ? (
            <>
              <div style={{
                width: 11, height: 11, borderRadius: '50%',
                border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff',
                animation: 'cps-spin .65s linear infinite', flexShrink: 0,
              }} />
              Simulating…
            </>
          ) : '🔮 Run Simulation'}
        </button>
        {(hasResult || addedSkills.length > 0 || useAtsBoost) && (
          <button
            onClick={handleReset}
            style={{
              padding: '7px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: 'none',
              color: C.muted, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface CareerPathSectionProps {
  currentRole?:  string | null;
  userSkills?:   string[];
  experience?:   number;
  atsScore?:     number | null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CareerPathSection({
  currentRole,
  userSkills  = [],
  experience  = 0,
  atsScore    = null,
}: CareerPathSectionProps) {
  // ── Baseline state ─────────────────────────────────────────────────────────
  const [path,        setPath]        = useState<SimulatedPathStep[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [fetched,     setFetched]     = useState(false);

  // ── What-If state (never persisted) ───────────────────────────────────────
  const [showSim,     setShowSim]     = useState(false);
  const [simRunning,  setSimRunning]  = useState(false);
  const [simPath,     setSimPath]     = useState<SimulatedPathStep[] | null>(null);
  const [deltaMap,    setDeltaMap]    = useState<DeltaMap | null>(null);
  const [simError,    setSimError]    = useState<string | null>(null);

  // ── Baseline fetch (once) ──────────────────────────────────────────────────
  useEffect(() => {
    if (!currentRole || fetched) return;
    setIsLoading(true);
    setError(null);

    authPost<{ path: SimulatedPathStep[] }>('/api/career/simulate', {
      currentRole, userSkills, experience, atsScore,
    })
      .then(data => { setPath(data.path); setFetched(true); })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Could not load career path.';
        setError(msg.includes('not found') ? null : msg);
        setFetched(true);
      })
      .finally(() => setIsLoading(false));
  }, [currentRole, fetched]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── What-If run ────────────────────────────────────────────────────────────
  const runSimulation = useCallback(async (
    addedSkills: string[],
    improvedAts: number | null,
  ) => {
    if (!currentRole) return;
    setSimRunning(true);
    setSimError(null);

    const simulatedSkills = [...new Set([...userSkills, ...addedSkills])];
    const simulatedAts    = improvedAts ?? atsScore;

    try {
      const data = await authPost<{ path: SimulatedPathStep[] }>('/api/career/simulate', {
        currentRole,
        userSkills: simulatedSkills,
        experience,
        atsScore:   simulatedAts,
      });
      setSimPath(data.path);
      setDeltaMap(computeDeltas(path, data.path));
    } catch (err: unknown) {
      setSimError(err instanceof Error ? err.message : 'Simulation failed.');
    } finally {
      setSimRunning(false);
    }
  }, [currentRole, userSkills, atsScore, experience, path]);

  const resetSimulation = useCallback(() => {
    setSimPath(null);
    setDeltaMap(null);
    setSimError(null);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: C.s0, border: `1px solid ${C.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <style>{`@keyframes cps-spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 18px 12px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>🗺️</span>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.text }}>
              Career Path
              {simPath && (
                <span style={{
                  marginLeft: 8, fontSize: 9, fontWeight: 800,
                  padding: '2px 7px', borderRadius: 20,
                  background: `${C.purple}20`, color: C.purple,
                  border: `1px solid ${C.purple}30`,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  verticalAlign: 'middle',
                }}>
                  What If
                </span>
              )}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: C.muted }}>
              {simPath
                ? 'Showing simulated improvements — not saved'
                : 'Next roles based on your profile'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Simulate Improvement toggle */}
          {fetched && path.length > 0 && (
            <button
              onClick={() => setShowSim(v => !v)}
              style={{
                padding: '5px 11px', borderRadius: 8, fontFamily: 'inherit',
                border: `1px solid ${showSim ? C.purple + '60' : C.border}`,
                background: showSim ? `${C.purple}15` : 'none',
                color: showSim ? C.purple : C.muted,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {showSim ? '▲ Hide simulator' : '🔮 Simulate Improvement'}
            </button>
          )}
          <a href="/resume-builder" style={{
            fontSize: 10, color: C.blue, textDecoration: 'none', fontWeight: 600,
          }}>
            Update role →
          </a>
        </div>
      </div>

      {/* ── What-If panel ──────────────────────────────────────────────── */}
      {showSim && (
        <>
          <div style={{ height: 1, background: C.border }} />
          <SimulatorPanel
            baseSkills={userSkills}
            baseAts={atsScore}
            currentRole={currentRole ?? ''}
            experience={experience}
            onRun={runSimulation}
            onReset={resetSimulation}
            isRunning={simRunning}
            hasResult={!!simPath}
          />
          {simError && (
            <p style={{
              margin: '0 18px 12px', fontSize: 11, color: C.red,
              background: `${C.red}0a`, border: `1px solid ${C.red}20`,
              borderRadius: 8, padding: '7px 10px',
            }}>
              {simError}
            </p>
          )}
        </>
      )}

      {/* ── Timeline ───────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 18px' }}>
        <PathTimeline
          path={simPath ?? path}
          baselinePath={simPath ? path : undefined}
          deltaMap={deltaMap ?? undefined}
          currentRole={currentRole ?? undefined}
          isLoading={isLoading || simRunning}
          error={error}
        />
      </div>
    </div>
  );
}