'use client';

/**
 * @file SuccessPredictor.tsx
 * @description Career Success Predictor UI with simulation capability.
 *
 * - Displays probability score, label, timeline, missing skills, Ava insights
 * - Simulator: add skills / adjust ATS / interview scores → before/after comparison
 * - Dashboard card (SuccessPredictorCard) for plug-in integration
 * - Fully self-contained; calls POST /api/career/success internally
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FC,
} from 'react';

// ---------------------------------------------------------------------------
// Types (mirrors API contract)
// ---------------------------------------------------------------------------

export interface SuccessPredictorInput {
  currentRole: string;
  targetRole: string;
  userProfile: {
    skills: string[];
    experience: number;
    atsScore: number;       // 0–100
    interviewScore: number; // 0–100
  };
}

interface ScoreBreakdown {
  skillMatch: number;
  atsFactor: number;
  experienceFit: number;
  marketDemand: number;
  interviewFactor: number;
}

interface PredictionResult {
  probability: number;
  timelineMonths: number;
  missingSkills: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
  explanation: string;
  strengths: string[];
  improvements: string[];
  marketDemand: number;
  scoreBreakdown: ScoreBreakdown;
}

interface SimulatorState {
  addedSkills: string[];
  atsScore: number;
  interviewScore: number;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function fetchPrediction(input: SuccessPredictorInput): Promise<PredictionResult> {
  const res = await fetch('/api/career/success', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLabel(p: number): { text: string; tier: 'high' | 'medium' | 'low' } {
  if (p >= 75) return { text: 'High Chance', tier: 'high' };
  if (p >= 50) return { text: 'Moderate', tier: 'medium' };
  return { text: 'Low Chance', tier: 'low' };
}

function getCtaConfig(tier: 'high' | 'medium' | 'low') {
  if (tier === 'high')   return { label: 'Apply to Jobs',    icon: '→', href: '/jobs' };
  if (tier === 'medium') return { label: 'Improve Skills',   icon: '↑', href: '/skills' };
  return                        { label: 'Fix Resume',       icon: '✦', href: '/resume' };
}

function tierColor(tier: 'high' | 'medium' | 'low') {
  if (tier === 'high')   return 'var(--c-high)';
  if (tier === 'medium') return 'var(--c-mid)';
  return 'var(--c-low)';
}

function fmt(n: number) { return n.toFixed(1); }

// ---------------------------------------------------------------------------
// Animated ring
// ---------------------------------------------------------------------------

const ScoreRing: FC<{ value: number; prev?: number; size?: number }> = ({
  value,
  prev,
  size = 160,
}) => {
  const [displayed, setDisplayed] = useState(prev ?? value);
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const tier = getLabel(value).tier;
  const stroke = tierColor(tier);

  useEffect(() => {
    const start = displayed;
    const end = value;
    const dur = 700;
    const t0 = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * ease);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const dash = (displayed / 100) * circ;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-track)" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke 0.4s' }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{
          transform: 'rotate(90deg)',
          transformOrigin: `${size / 2}px ${size / 2}px`,
          fontFamily: "'DM Mono', 'Courier New', monospace",
          fontSize: size * 0.22,
          fontWeight: 700,
          fill: stroke,
        }}
      >
        {Math.round(displayed)}%
      </text>
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Skill tag
// ---------------------------------------------------------------------------

const SkillTag: FC<{ label: string; added?: boolean }> = ({ label, added }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 4,
      fontSize: 11,
      fontFamily: "'DM Mono', monospace",
      letterSpacing: '0.04em',
      background: added ? 'var(--c-high-bg)' : 'var(--c-chip)',
      color: added ? 'var(--c-high)' : 'var(--c-muted)',
      border: `1px solid ${added ? 'var(--c-high)' : 'var(--c-border)'}`,
    }}
  >
    {added && <span style={{ fontSize: 9 }}>✦</span>}
    {label}
  </span>
);

// ---------------------------------------------------------------------------
// Score bar
// ---------------------------------------------------------------------------

const ScoreBar: FC<{ label: string; value: number }> = ({ label, value }) => {
  const pct = Math.round(value * 100);
  const tier = pct >= 70 ? 'high' : pct >= 45 ? 'medium' : 'low';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--c-muted)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>
          {label.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: tierColor(tier), fontFamily: "'DM Mono', monospace" }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--c-track)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: tierColor(tier),
            borderRadius: 2,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Comparison badge
// ---------------------------------------------------------------------------

const DeltaBadge: FC<{ before: number; after: number }> = ({ before, after }) => {
  const delta = after - before;
  const positive = delta > 0;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 6,
        background: positive ? 'var(--c-high-bg)' : 'var(--c-low-bg)',
        border: `1px solid ${positive ? 'var(--c-high)' : 'var(--c-low)'}`,
      }}
    >
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: 'var(--c-muted)' }}>
        {fmt(before)}% →
      </span>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, color: positive ? 'var(--c-high)' : 'var(--c-low)' }}>
        {fmt(after)}%
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: positive ? 'var(--c-high)' : 'var(--c-low)',
          background: positive ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
          borderRadius: 3,
          padding: '1px 5px',
        }}
      >
        {positive ? '+' : ''}{fmt(delta)}%
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Slider input
// ---------------------------------------------------------------------------

const SliderInput: FC<{
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}> = ({ label, value, min = 0, max = 100, onChange }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--c-muted)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--c-text)', fontFamily: "'DM Mono', monospace" }}>
        {value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: 'var(--c-accent)' }}
    />
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface SuccessPredictorProps {
  input: SuccessPredictorInput;
  /** Optional pre-fetched result — skips initial fetch */
  initialResult?: PredictionResult;
}

export const SuccessPredictor: FC<SuccessPredictorProps> = ({ input, initialResult }) => {
  const [result, setResult] = useState<PredictionResult | null>(initialResult ?? null);
  const [loading, setLoading] = useState(!initialResult);
  const [error, setError] = useState<string | null>(null);

  // simulator state
  const [simOpen, setSimOpen] = useState(false);
  const [simState, setSimState] = useState<SimulatorState>({
    addedSkills: [],
    atsScore: input.userProfile.atsScore,
    interviewScore: input.userProfile.interviewScore,
  });
  const [simSkillInput, setSimSkillInput] = useState('');
  const [simResult, setSimResult] = useState<PredictionResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const simDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // fetch baseline
  useEffect(() => {
    if (initialResult) return;
    setLoading(true);
    fetchPrediction(input)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [input, initialResult]);

  // debounced simulation re-fetch
  const runSimulation = useCallback(
    (s: SimulatorState) => {
      if (!result) return;
      if (simDebounce.current) clearTimeout(simDebounce.current);
      simDebounce.current = setTimeout(async () => {
        setSimLoading(true);
        try {
          const simInput: SuccessPredictorInput = {
            ...input,
            userProfile: {
              ...input.userProfile,
              skills: [...input.userProfile.skills, ...s.addedSkills],
              atsScore: s.atsScore,
              interviewScore: s.interviewScore,
            },
          };
          const r = await fetchPrediction(simInput);
          setSimResult(r);
        } catch { /* silent */ }
        finally { setSimLoading(false); }
      }, 600);
    },
    [input, result]
  );

  const updateSim = useCallback(
    (patch: Partial<SimulatorState>) => {
      setSimState((prev) => {
        const next = { ...prev, ...patch };
        runSimulation(next);
        return next;
      });
    },
    [runSimulation]
  );

  const handleAddSkill = () => {
    const skill = simSkillInput.trim();
    if (!skill || simState.addedSkills.includes(skill)) return;
    setSimSkillInput('');
    updateSim({ addedSkills: [...simState.addedSkills, skill] });
  };

  const handleRemoveSkill = (skill: string) => {
    updateSim({ addedSkills: simState.addedSkills.filter((s) => s !== skill) });
  };

  // open simulator & trigger initial sim fetch
  const handleOpenSimulator = () => {
    setSimOpen(true);
    if (!simResult) runSimulation(simState);
  };

  if (loading) return <SkeletonLoader />;
  if (error || !result) return <ErrorState message={error ?? 'Prediction unavailable.'} />;

  const { text: labelText, tier } = getLabel(result.probability);
  const cta = getCtaConfig(tier);

  return (
    <>
      <style>{CSS}</style>
      <div className="sp-root">

        {/* ── Header ── */}
        <div className="sp-header">
          <div>
            <p className="sp-eyebrow">SUCCESS PREDICTOR</p>
            <h2 className="sp-title">{input.targetRole}</h2>
            <p className="sp-subtitle">from {input.currentRole}</p>
          </div>
          <span className={`sp-badge sp-badge--${tier}`}>{labelText}</span>
        </div>

        {/* ── Score + breakdown ── */}
        <div className="sp-score-row">
          <div className="sp-ring-wrap">
            <ScoreRing value={result.probability} size={160} />
            <p className="sp-timeline">
              {result.timelineMonths === 0
                ? 'Ready now'
                : `~${result.timelineMonths} months`}
            </p>
          </div>

          <div className="sp-breakdown">
            <p className="sp-section-label">SCORE BREAKDOWN</p>
            <ScoreBar label="Skill Match"    value={result.scoreBreakdown.skillMatch} />
            <ScoreBar label="ATS Factor"     value={result.scoreBreakdown.atsFactor} />
            <ScoreBar label="Experience"     value={result.scoreBreakdown.experienceFit} />
            <ScoreBar label="Interview"      value={result.scoreBreakdown.interviewFactor} />
            <ScoreBar label="Market Demand"  value={result.scoreBreakdown.marketDemand} />
          </div>
        </div>

        {/* ── Missing skills ── */}
        {result.missingSkills.length > 0 && (
          <div className="sp-section">
            <p className="sp-section-label">SKILL GAPS</p>
            <div className="sp-tags">
              {result.missingSkills.map((s) => (
                <SkillTag key={s} label={s} />
              ))}
            </div>
          </div>
        )}

        {/* ── Ava insights ── */}
        <div className="sp-section sp-ava">
          <div className="sp-ava-header">
            <span className="sp-ava-dot" />
            <span className="sp-section-label" style={{ marginBottom: 0 }}>AVA · CAREER STRATEGIST</span>
          </div>
          <p className="sp-ava-explanation">{result.explanation}</p>

          {result.strengths.length > 0 && (
            <div className="sp-ava-group">
              <p className="sp-ava-group-label">STRENGTHS</p>
              {result.strengths.map((s, i) => (
                <div key={i} className="sp-ava-item sp-ava-item--strength">
                  <span className="sp-ava-bullet">✓</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}

          {result.improvements.length > 0 && (
            <div className="sp-ava-group">
              <p className="sp-ava-group-label">IMPROVEMENTS</p>
              {result.improvements.map((s, i) => (
                <div key={i} className="sp-ava-item sp-ava-item--improvement">
                  <span className="sp-ava-bullet">→</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Simulator ── */}
        <div className="sp-section">
          <button
            className="sp-sim-toggle"
            onClick={handleOpenSimulator}
          >
            <span>⟳ Simulate Improvements</span>
            <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>
              {simOpen ? '▲ collapse' : '▼ expand'}
            </span>
          </button>

          {simOpen && (
            <div className="sp-simulator">
              {/* Comparison header */}
              {simResult && (
                <div className="sp-sim-compare">
                  <DeltaBadge before={result.probability} after={simResult.probability} />
                  {simResult.timelineMonths !== result.timelineMonths && (
                    <span className="sp-sim-timeline-delta">
                      Timeline: {result.timelineMonths}mo →{' '}
                      <span style={{ color: simResult.timelineMonths < result.timelineMonths ? 'var(--c-high)' : 'var(--c-low)' }}>
                        {simResult.timelineMonths}mo
                      </span>
                    </span>
                  )}
                  {simLoading && <span className="sp-sim-spinner" />}
                </div>
              )}

              {/* Skill adder */}
              <div className="sp-sim-block">
                <p className="sp-section-label">ADD A SKILL</p>
                <div className="sp-sim-skill-input-row">
                  <input
                    className="sp-input"
                    placeholder="e.g. TypeScript, Leadership…"
                    value={simSkillInput}
                    onChange={(e) => setSimSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                  />
                  <button className="sp-btn-add" onClick={handleAddSkill}>+ Add</button>
                </div>
                {simState.addedSkills.length > 0 && (
                  <div className="sp-tags" style={{ marginTop: 8 }}>
                    {simState.addedSkills.map((s) => (
                      <button
                        key={s}
                        className="sp-tag-remove"
                        onClick={() => handleRemoveSkill(s)}
                        title="Remove"
                      >
                        <SkillTag label={s} added />
                        <span style={{ fontSize: 9, marginLeft: 2, color: 'var(--c-muted)' }}>✕</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ATS slider */}
              <div className="sp-sim-block">
                <SliderInput
                  label={`ATS SCORE  (current: ${input.userProfile.atsScore})`}
                  value={simState.atsScore}
                  onChange={(v) => updateSim({ atsScore: v })}
                />
              </div>

              {/* Interview slider */}
              <div className="sp-sim-block">
                <SliderInput
                  label={`INTERVIEW SCORE  (current: ${input.userProfile.interviewScore})`}
                  value={simState.interviewScore}
                  onChange={(v) => updateSim({ interviewScore: v })}
                />
              </div>

              {/* Simulated result ring */}
              {simResult && (
                <div className="sp-sim-result">
                  <div className="sp-sim-result-col">
                    <p className="sp-section-label" style={{ textAlign: 'center' }}>BEFORE</p>
                    <ScoreRing value={result.probability} size={110} />
                  </div>
                  <div className="sp-sim-result-divider">→</div>
                  <div className="sp-sim-result-col">
                    <p className="sp-section-label" style={{ textAlign: 'center' }}>AFTER</p>
                    <ScoreRing value={simResult.probability} prev={result.probability} size={110} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CTA ── */}
        <a href={cta.href} className={`sp-cta sp-cta--${tier}`}>
          <span>{cta.icon}</span>
          <span>{cta.label}</span>
        </a>

      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Dashboard card (plug-in integration)
// ---------------------------------------------------------------------------

export interface SuccessPredictorCardProps {
  targetRole: string;
  probability: number;
  onExpand?: () => void;
}

export const SuccessPredictorCard: FC<SuccessPredictorCardProps> = ({
  targetRole,
  probability,
  onExpand,
}) => {
  const { text, tier } = getLabel(probability);
  const cta = getCtaConfig(tier);

  return (
    <>
      <style>{CSS}</style>
      <div className="sp-card">
        <div className="sp-card-top">
          <div>
            <p className="sp-eyebrow">CAREER SUCCESS</p>
            <p className="sp-card-role">{targetRole}</p>
          </div>
          <span className={`sp-badge sp-badge--${tier}`}>{text}</span>
        </div>

        <div className="sp-card-score-row">
          <ScoreRing value={probability} size={80} />
          <div className="sp-card-actions">
            <button className="sp-card-expand" onClick={onExpand}>
              View Analysis →
            </button>
            <a href={cta.href} className={`sp-cta sp-cta--${tier} sp-cta--sm`}>
              {cta.icon} {cta.label}
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Skeleton + error states
// ---------------------------------------------------------------------------

const SkeletonLoader: FC = () => (
  <>
    <style>{CSS}</style>
    <div className="sp-root sp-skeleton">
      <div className="sp-skel-line sp-skel-line--sm" />
      <div className="sp-skel-line sp-skel-line--lg" />
      <div className="sp-skel-ring" />
      <div className="sp-skel-line" />
      <div className="sp-skel-line sp-skel-line--sm" />
    </div>
  </>
);

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <>
    <style>{CSS}</style>
    <div className="sp-root sp-error">
      <span className="sp-error-icon">⚠</span>
      <p className="sp-error-msg">{message}</p>
      <p className="sp-error-hint">Check your connection and try again.</p>
    </div>
  </>
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');

  :root {
    --c-bg:       #0d0f14;
    --c-surface:  #13161e;
    --c-border:   #1f2433;
    --c-track:    #1c2030;
    --c-text:     #e8eaf0;
    --c-muted:    #5a6280;
    --c-chip:     #171b26;
    --c-accent:   #6c8aff;

    --c-high:     #34d399;
    --c-high-bg:  rgba(52,211,153,0.08);
    --c-mid:      #f59e0b;
    --c-mid-bg:   rgba(245,158,11,0.08);
    --c-low:      #f87171;
    --c-low-bg:   rgba(248,113,113,0.08);
  }

  .sp-root {
    font-family: 'Syne', sans-serif;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: 12px;
    padding: 28px;
    max-width: 560px;
    width: 100%;
    color: var(--c-text);
    box-sizing: border-box;
    animation: sp-fade-in 0.4s ease both;
  }

  @keyframes sp-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Header */
  .sp-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 12px;
  }
  .sp-eyebrow {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: var(--c-muted);
    margin: 0 0 6px;
  }
  .sp-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0 0 2px;
    line-height: 1.2;
  }
  .sp-subtitle {
    font-size: 12px;
    color: var(--c-muted);
    margin: 0;
  }

  /* Badge */
  .sp-badge {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .sp-badge--high   { color: var(--c-high); border-color: var(--c-high); background: var(--c-high-bg); }
  .sp-badge--medium { color: var(--c-mid);  border-color: var(--c-mid);  background: var(--c-mid-bg); }
  .sp-badge--low    { color: var(--c-low);  border-color: var(--c-low);  background: var(--c-low-bg); }

  /* Score row */
  .sp-score-row {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    margin-bottom: 24px;
  }
  .sp-ring-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }
  .sp-timeline {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: var(--c-muted);
    margin: 6px 0 0;
    letter-spacing: 0.05em;
    text-align: center;
  }
  .sp-breakdown {
    flex: 1;
    min-width: 0;
    padding-top: 2px;
  }

  /* Section */
  .sp-section {
    margin-bottom: 20px;
  }
  .sp-section-label {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.14em;
    color: var(--c-muted);
    margin: 0 0 10px;
  }

  /* Tags */
  .sp-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  /* Ava */
  .sp-ava {
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    padding: 16px;
  }
  .sp-ava-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .sp-ava-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c-accent);
    box-shadow: 0 0 8px var(--c-accent);
    flex-shrink: 0;
    animation: sp-pulse 2s ease-in-out infinite;
  }
  @keyframes sp-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  .sp-ava-explanation {
    font-size: 13px;
    line-height: 1.65;
    color: var(--c-text);
    margin: 0 0 14px;
  }
  .sp-ava-group { margin-bottom: 12px; }
  .sp-ava-group:last-child { margin-bottom: 0; }
  .sp-ava-group-label {
    font-family: 'DM Mono', monospace;
    font-size: 8px;
    letter-spacing: 0.14em;
    color: var(--c-muted);
    margin: 0 0 6px;
  }
  .sp-ava-item {
    display: flex;
    gap: 8px;
    font-size: 12px;
    line-height: 1.5;
    margin-bottom: 4px;
  }
  .sp-ava-item--strength    .sp-ava-bullet { color: var(--c-high); }
  .sp-ava-item--improvement .sp-ava-bullet { color: var(--c-accent); }
  .sp-ava-bullet {
    flex-shrink: 0;
    font-family: 'DM Mono', monospace;
    margin-top: 1px;
  }

  /* Simulator toggle */
  .sp-sim-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: 1px dashed var(--c-border);
    border-radius: 6px;
    padding: 10px 14px;
    color: var(--c-muted);
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }
  .sp-sim-toggle:hover {
    border-color: var(--c-accent);
    color: var(--c-accent);
  }

  /* Simulator panel */
  .sp-simulator {
    margin-top: 12px;
    background: var(--c-surface);
    border: 1px solid var(--c-border);
    border-radius: 8px;
    padding: 16px;
    animation: sp-fade-in 0.25s ease both;
  }
  .sp-sim-compare {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--c-border);
  }
  .sp-sim-timeline-delta {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: var(--c-muted);
  }
  .sp-sim-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid var(--c-border);
    border-top-color: var(--c-accent);
    border-radius: 50%;
    animation: sp-spin 0.6s linear infinite;
  }
  @keyframes sp-spin { to { transform: rotate(360deg); } }

  .sp-sim-block {
    margin-bottom: 14px;
  }
  .sp-sim-skill-input-row {
    display: flex;
    gap: 8px;
  }
  .sp-input {
    flex: 1;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: 5px;
    padding: 7px 10px;
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    color: var(--c-text);
    outline: none;
    transition: border-color 0.2s;
  }
  .sp-input:focus { border-color: var(--c-accent); }
  .sp-input::placeholder { color: var(--c-muted); }
  .sp-btn-add {
    background: var(--c-accent);
    border: none;
    border-radius: 5px;
    padding: 7px 12px;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.2s;
  }
  .sp-btn-add:hover { opacity: 0.85; }

  .sp-tag-remove {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }

  .sp-sim-result {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--c-border);
  }
  .sp-sim-result-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .sp-sim-result-divider {
    font-size: 18px;
    color: var(--c-muted);
    font-family: 'DM Mono', monospace;
  }

  /* CTA */
  .sp-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 13px;
    border-radius: 7px;
    border: 1px solid;
    text-decoration: none;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.04em;
    transition: opacity 0.2s, transform 0.15s;
    cursor: pointer;
    box-sizing: border-box;
  }
  .sp-cta:hover { opacity: 0.85; transform: translateY(-1px); }
  .sp-cta--high   { background: var(--c-high-bg); color: var(--c-high); border-color: var(--c-high); }
  .sp-cta--medium { background: var(--c-mid-bg);  color: var(--c-mid);  border-color: var(--c-mid); }
  .sp-cta--low    { background: var(--c-low-bg);  color: var(--c-low);  border-color: var(--c-low); }
  .sp-cta--sm {
    width: auto;
    padding: 7px 14px;
    font-size: 11px;
  }

  /* Dashboard card */
  .sp-card {
    font-family: 'Syne', sans-serif;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: 10px;
    padding: 20px;
    width: 100%;
    max-width: 320px;
    color: var(--c-text);
    box-sizing: border-box;
  }
  .sp-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
    gap: 10px;
  }
  .sp-card-role {
    font-size: 15px;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .sp-card-score-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .sp-card-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }
  .sp-card-expand {
    background: none;
    border: 1px solid var(--c-border);
    border-radius: 5px;
    padding: 7px 12px;
    font-family: 'Syne', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: var(--c-muted);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s, color 0.2s;
  }
  .sp-card-expand:hover { border-color: var(--c-accent); color: var(--c-accent); }

  /* Skeleton */
  .sp-skeleton { opacity: 0.5; }
  .sp-skel-line {
    height: 12px;
    border-radius: 4px;
    background: var(--c-surface);
    margin-bottom: 10px;
    animation: sp-shimmer 1.4s ease infinite;
  }
  .sp-skel-line--sm  { width: 40%; }
  .sp-skel-line--lg  { width: 65%; }
  .sp-skel-ring {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: var(--c-surface);
    margin: 16px auto;
    animation: sp-shimmer 1.4s ease infinite;
  }
  @keyframes sp-shimmer {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 0.8; }
  }

  /* Error */
  .sp-error {
    text-align: center;
    padding: 40px 28px;
  }
  .sp-error-icon { font-size: 28px; color: var(--c-low); }
  .sp-error-msg  { font-size: 14px; font-weight: 600; margin: 12px 0 4px; }
  .sp-error-hint { font-size: 12px; color: var(--c-muted); margin: 0; }

  /* Responsive */
  @media (max-width: 480px) {
    .sp-root { padding: 18px; }
    .sp-score-row { flex-direction: column; align-items: center; }
    .sp-breakdown { width: 100%; }
    .sp-title { font-size: 18px; }
  }
`;