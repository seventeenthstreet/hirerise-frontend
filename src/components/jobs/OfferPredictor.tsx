'use client';

/**
 * @file OfferPredictor.tsx
 * @description Offer Probability Predictor UI with live simulation.
 *
 * Exports:
 *  - OfferPredictor       — full predictor with simulator + Ava insights
 *  - OfferPredictorCard   — compact dashboard card (plug-in integration)
 *
 * Calls POST /api/jobs/offer-probability internally.
 * Reuses Job Match + Interview system outputs via the API.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FC,
  type CSSProperties,
} from 'react';

// ---------------------------------------------------------------------------
// Types  (mirrors API contract)
// ---------------------------------------------------------------------------

export interface OfferPredictorInput {
  jobId: string;
  userProfile: {
    skills:          string[];
    experience:      number;
    targetRole:      string;
    currentRole?:    string;
    atsScore?:       number;
    interviewScore?: number;
  };
}

interface ScoreBreakdown {
  jobMatchFactor:  number;
  atsFactor:       number;
  interviewFactor: number;
  skillMatch:      number;
  experienceFit:   number;
  marketAdvantage: number;
}

interface PredictionResult {
  jobId:             string;
  probability:       number;
  confidenceLevel:   'low' | 'medium' | 'high';
  riskFactors:       string[];
  explanation:       string;
  improvements:      string[];
  strategy:          string[];
  scoreBreakdown:    ScoreBreakdown;
  marketCompetition: number;
  meta: {
    jobMatchScore:  number;
    atsScore:       number;
    interviewScore: number;
    cachedAt:       string;
  };
}

interface SimState {
  atsScore:       number;
  interviewScore: number;
  addedSkills:    string[];
}

type Tier = 'high' | 'medium' | 'low';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const tok = {
  bg:        '#faf8f4',
  surface:   '#f2efe8',
  border:    '#e2ddd5',
  text:      '#1a1714',
  muted:     '#8c8882',
  accent:    '#c4622d',
  accentBg:  'rgba(196,98,45,0.08)',
  monoFont:  "'DM Mono', 'Courier New', monospace",
  dispFont:  "'Barlow Condensed', 'Arial Narrow', sans-serif",
  bodyFont:  "'Lora', Georgia, serif",
  track:     '#e2ddd5',
  tier: { high: '#2e7d55', medium: '#b06d1a', low: '#c0392b' } as Record<Tier, string>,
  highBg:    'rgba(46,125,85,0.08)',
  midBg:     'rgba(176,109,26,0.08)',
  lowBg:     'rgba(192,57,43,0.08)',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTier(p: number): Tier {
  return p > 75 ? 'high' : p >= 50 ? 'medium' : 'low';
}

function getTierLabel(p: number): string {
  return p > 75 ? 'High Chance' : p >= 50 ? 'Moderate' : 'Low Chance';
}

function getCtaConfig(tier: Tier) {
  if (tier === 'high')   return [{ label: 'Apply to More Jobs',  href: '/jobs',      primary: true  }];
  if (tier === 'medium') return [{ label: 'Improve Skills',      href: '/skills',    primary: true  },
                                  { label: 'Practice Interview',  href: '/interview', primary: false }];
  return                        [{ label: 'Fix Resume',          href: '/resume',    primary: true  },
                                  { label: 'Practice Interview',  href: '/interview', primary: false }];
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

async function fetchPrediction(input: OfferPredictorInput): Promise<PredictionResult> {
  const res = await fetch('/api/jobs/offer-probability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useAnimatedValue(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const start = prev.current;
    const t0 = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(start + (target - start) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else { setValue(target); prev.current = target; }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const HeroScore: FC<{ value: number }> = ({ value }) => {
  const animated = useAnimatedValue(value);
  const tier = getTier(value);
  const tierColors: Record<Tier, string> = {
    high: tok.tier.high, medium: tok.tier.medium, low: tok.tier.low,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ fontFamily: tok.dispFont, fontSize: 88, fontWeight: 700, lineHeight: 1,
        letterSpacing: '-0.03em', color: tierColors[tier], transition: 'color 0.4s' }}>
        {Math.round(animated)}<span style={{ fontSize: 40, fontWeight: 400 }}>%</span>
      </div>
      <span style={{ fontFamily: tok.monoFont, fontSize: 10, letterSpacing: '.12em',
        padding: '3px 10px', borderRadius: 3, border: '1px solid',
        color: tierColors[tier], borderColor: tierColors[tier],
        background: tier === 'high' ? tok.highBg : tier === 'medium' ? tok.midBg : tok.lowBg }}>
        {getTierLabel(value)}
      </span>
    </div>
  );
};

const ScoreArc: FC<{ value: number; size?: number }> = ({ value, size = 110 }) => {
  const animated = useAnimatedValue(value);
  const tier = getTier(value);
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(animated, 100) / 100) * circ;
  const color = tok.tier[tier];
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={tok.track} strokeWidth={7} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
        style={{ transition: 'stroke 0.4s' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`,
          fontFamily: tok.monoFont, fontSize: size * 0.19, fontWeight: 700, fill: color }}>
        {Math.round(animated)}%
      </text>
    </svg>
  );
};

const FactorBar: FC<{ label: string; value: number }> = ({ label, value }) => {
  const pct  = Math.round(value * 100);
  const tier = getTier(pct);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontFamily: tok.monoFont, fontSize: 10, letterSpacing: '.08em',
          color: tok.muted }}>{label}</span>
        <span style={{ fontFamily: tok.monoFont, fontSize: 10,
          color: tok.tier[tier], transition: 'color 0.3s' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: tok.track, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2,
          background: tok.tier[tier],
          transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }} />
      </div>
    </div>
  );
};

const DeltaDisplay: FC<{ before: number; after: number }> = ({ before, after }) => {
  const delta    = after - before;
  const pos      = delta >= 0;
  const animated = useAnimatedValue(after);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '7px 14px', borderRadius: 5, border: '1px solid', flexWrap: 'wrap',
      background: pos ? tok.highBg : tok.lowBg,
      borderColor: pos ? tok.tier.high : tok.tier.low }}>
      <span style={{ fontFamily: tok.monoFont, fontSize: 10, color: tok.muted }}>Before</span>
      <span style={{ fontFamily: tok.dispFont, fontSize: 18, fontWeight: 700,
        color: tok.text }}>{before.toFixed(1)}%</span>
      <span style={{ fontFamily: tok.monoFont, fontSize: 12, color: tok.muted }}>→</span>
      <span style={{ fontFamily: tok.monoFont, fontSize: 10, color: tok.muted }}>After</span>
      <span style={{ fontFamily: tok.dispFont, fontSize: 18, fontWeight: 700,
        color: tok.tier[getTier(after)] }}>{Math.round(animated)}%</span>
      <span style={{ fontFamily: tok.monoFont, fontSize: 11, padding: '2px 6px',
        borderRadius: 3,
        background: pos ? 'rgba(46,125,85,0.12)' : 'rgba(192,57,43,0.12)',
        color: pos ? tok.tier.high : tok.tier.low }}>
        {pos ? '+' : ''}{delta.toFixed(1)}%
      </span>
    </div>
  );
};

const SliderInput: FC<{
  label: string; sub?: string; value: number;
  min?: number; max?: number; onChange: (v: number) => void;
}> = ({ label, sub, value, min = 0, max = 100, onChange }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontFamily: tok.monoFont, fontSize: 10, letterSpacing: '.08em',
        color: tok.muted }}>
        {label}{sub && <span style={{ opacity: 0.6 }}> {sub}</span>}
      </span>
      <span style={{ fontFamily: tok.monoFont, fontSize: 11, color: tok.text }}>{value}</span>
    </div>
    <input type="range" min={min} max={max} step={1} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: tok.accent, cursor: 'pointer' }} />
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface OfferPredictorProps {
  input:          OfferPredictorInput;
  initialResult?: PredictionResult;
}

export const OfferPredictor: FC<OfferPredictorProps> = ({ input, initialResult }) => {
  const [result,     setResult]     = useState<PredictionResult | null>(initialResult ?? null);
  const [loading,    setLoading]    = useState(!initialResult);
  const [error,      setError]      = useState<string | null>(null);
  const [simOpen,    setSimOpen]    = useState(false);
  const [simState,   setSimState]   = useState<SimState>({
    atsScore:       input.userProfile.atsScore       ?? 60,
    interviewScore: input.userProfile.interviewScore ?? 60,
    addedSkills:    [],
  });
  const [skillDraft, setSkillDraft] = useState('');
  const [simResult,  setSimResult]  = useState<PredictionResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialResult) return;
    setLoading(true);
    fetchPrediction(input)
      .then(setResult)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [input, initialResult]);

  const runSim = useCallback((s: SimState) => {
    if (!result) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSimLoading(true);
      try {
        const r = await fetchPrediction({
          ...input,
          userProfile: {
            ...input.userProfile,
            skills:         [...input.userProfile.skills, ...s.addedSkills],
            atsScore:       s.atsScore,
            interviewScore: s.interviewScore,
          },
        });
        setSimResult(r);
      } catch { /* silent */ }
      finally { setSimLoading(false); }
    }, 500);
  }, [input, result]);

  const patchSim = (patch: Partial<SimState>) => {
    const next = { ...simState, ...patch };
    setSimState(next);
    runSim(next);
  };

  const addSkill = () => {
    const v = skillDraft.trim();
    if (!v || simState.addedSkills.includes(v)) return;
    setSkillDraft('');
    patchSim({ addedSkills: [...simState.addedSkills, v] });
  };

  const openSim = () => { setSimOpen(o => !o); if (!simResult) runSim(simState); };

  if (loading) return <SkeletonLoader />;
  if (error || !result) return <ErrorState message={error ?? 'Prediction unavailable.'} />;

  const tier = getTier(result.probability);
  const ctas = getCtaConfig(tier);
  const sb   = result.scoreBreakdown;

  return (
    <>
      <style>{CSS}</style>
      <article className="op-root op-fadein">

        {/* Header */}
        <header className="op-header">
          <div>
            <p className="op-eyebrow">OFFER PREDICTOR</p>
            <h1 className="op-title">{input.userProfile.targetRole}</h1>
            <p className="op-subtitle">Job&nbsp;ID:&nbsp;{result.jobId}</p>
          </div>
          <span className={`op-conf op-conf--${result.confidenceLevel}`}>
            {result.confidenceLevel.toUpperCase()}&nbsp;CONFIDENCE
          </span>
        </header>

        {/* Hero + Breakdown */}
        <section className="op-score-section">
          <HeroScore value={result.probability} />
          <div className="op-breakdown">
            <p className="op-sec-label">FACTOR BREAKDOWN</p>
            <FactorBar label="Job Match"   value={sb.jobMatchFactor} />
            <FactorBar label="Interview"   value={sb.interviewFactor} />
            <FactorBar label="ATS Score"   value={sb.atsFactor} />
            <FactorBar label="Skill Match" value={sb.skillMatch} />
            <FactorBar label="Experience"  value={sb.experienceFit} />
            <FactorBar label="Market Adv." value={sb.marketAdvantage} />
          </div>
        </section>

        {/* Risk factors */}
        {result.riskFactors.length > 0 && (
          <section className="op-section">
            <p className="op-sec-label">RISK FACTORS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.riskFactors.map((r, i) => (
                <span key={i} className="op-risk-tag">{r}</span>
              ))}
            </div>
          </section>
        )}

        {/* Ava insights */}
        <section className="op-section op-ava">
          <div className="op-ava-head">
            <span className="op-ava-dot" />
            <p className="op-sec-label" style={{ marginBottom: 0 }}>
              AVA&nbsp;·&nbsp;CAREER STRATEGIST
            </p>
          </div>
          <p className="op-ava-exp">{result.explanation}</p>
          <div className="op-ava-cols">
            {result.improvements.length > 0 && (
              <div>
                <p className="op-ava-glabel">IMPROVEMENTS</p>
                {result.improvements.map((item, i) => (
                  <div key={i} className="op-ava-item">
                    <span style={{ color: tok.accent, fontFamily: tok.monoFont, flexShrink: 0,
                      marginTop: 1 }}>→</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
            {result.strategy.length > 0 && (
              <div>
                <p className="op-ava-glabel">STRATEGY</p>
                {result.strategy.map((item, i) => (
                  <div key={i} className="op-ava-item">
                    <span style={{ color: tok.tier.high, fontFamily: tok.monoFont, flexShrink: 0,
                      marginTop: 1 }}>✦</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Simulator */}
        <section className="op-section">
          <button className="op-sim-toggle" onClick={openSim}>
            <span>⟳&nbsp;Simulate Improvements</span>
            <span style={{ fontSize: 10 }}>{simOpen ? '▲ collapse' : '▼ expand'}</span>
          </button>

          {simOpen && (
            <div className="op-simulator op-fadein">
              {simResult && (
                <div className="op-sim-top">
                  <DeltaDisplay before={result.probability} after={simResult.probability} />
                  {simLoading && <span className="op-spinner" />}
                  <span style={{ fontFamily: tok.monoFont, fontSize: 10, color: tok.muted }}>
                    Confidence:&nbsp;
                    <strong style={{ color: tok.tier[getTier(simResult.probability)] }}>
                      {getTierLabel(simResult.probability)}
                    </strong>
                  </span>
                </div>
              )}

              <SliderInput label="ATS Score"
                sub={`(was ${result.meta.atsScore})`}
                value={simState.atsScore}
                onChange={v => patchSim({ atsScore: v })} />

              <SliderInput label="Interview Score"
                sub={`(was ${result.meta.interviewScore})`}
                value={simState.interviewScore}
                onChange={v => patchSim({ interviewScore: v })} />

              <div style={{ marginTop: 6 }}>
                <p className="op-sec-label" style={{ marginBottom: 8 }}>ADD A SKILL</p>
                <div style={{ display: 'flex', gap: 7 }}>
                  <input className="op-input" placeholder="e.g. Kubernetes, Figma…"
                    value={skillDraft}
                    onChange={e => setSkillDraft(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSkill()} />
                  <button className="op-btn-add" onClick={addSkill}>+ Add</button>
                </div>
                {simState.addedSkills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {simState.addedSkills.map(sk => (
                      <button key={sk} className="op-skill-chip"
                        onClick={() => patchSim({ addedSkills: simState.addedSkills.filter(x => x !== sk) })}>
                        ✦ {sk} ✕
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {simResult && (
                <div className="op-sim-rings">
                  <div className="op-ring-col">
                    <p className="op-sec-label" style={{ textAlign: 'center' }}>BEFORE</p>
                    <ScoreArc value={result.probability} size={96} />
                  </div>
                  <span style={{ fontFamily: tok.monoFont, fontSize: 16, color: tok.muted }}>→</span>
                  <div className="op-ring-col">
                    <p className="op-sec-label" style={{ textAlign: 'center' }}>AFTER</p>
                    <ScoreArc value={simResult.probability} size={96} />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* CTAs */}
        <footer style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ctas.map((cta, i) => (
            <a key={i} href={cta.href}
              className={`op-cta ${cta.primary ? `op-cta--primary op-cta--${tier}` : 'op-cta--ghost'}`}>
              {cta.label}
            </a>
          ))}
        </footer>

      </article>
    </>
  );
};

// ---------------------------------------------------------------------------
// Dashboard card
// ---------------------------------------------------------------------------

export interface OfferPredictorCardProps {
  jobTitle:    string;
  probability: number;
  onExpand?:   () => void;
}

export const OfferPredictorCard: FC<OfferPredictorCardProps> = ({
  jobTitle, probability, onExpand,
}) => {
  const tier = getTier(probability);
  const cta  = getCtaConfig(tier)[0];
  return (
    <>
      <style>{CSS}</style>
      <div className="op-card op-fadein">
        <div className="op-card-top">
          <div>
            <p className="op-eyebrow">OFFER CHANCES</p>
            <p className="op-card-title">{jobTitle}</p>
          </div>
          <span className={`op-conf op-conf--${tier}`}>{getTierLabel(probability)}</span>
        </div>
        <div className="op-card-body">
          <ScoreArc value={probability} size={84} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
            <button className="op-card-expand" onClick={onExpand}>View Analysis →</button>
            <a href={cta.href}
              className={`op-cta op-cta--primary op-cta--${tier}`}
              style={{ padding: '7px 14px', fontSize: 11 }}>
              {cta.label}
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Skeleton / Error states
// ---------------------------------------------------------------------------

const SkeletonLoader: FC = () => (
  <><style>{CSS}</style>
    <div className="op-root" style={{ opacity: 0.5 }}>
      {[40, 65, 100, 55, 30].map((w, i) => (
        <div key={i} className="op-skel-line" style={{ width: `${w}%` }} />
      ))}
    </div>
  </>
);

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <><style>{CSS}</style>
    <div className="op-root" style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ fontSize: 26, color: tok.tier.low }}>⚠</div>
      <p style={{ fontFamily: tok.dispFont, fontSize: 14, fontWeight: 600,
        margin: '10px 0 3px' }}>{message}</p>
      <p style={{ fontFamily: tok.monoFont, fontSize: 11, color: tok.muted,
        margin: 0 }}>Check your connection and try again.</p>
    </div>
  </>
);

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700&family=DM+Mono:wght@400;500&family=Lora:wght@400;500&display=swap');

  .op-root { font-family:${tok.bodyFont}; background:${tok.bg}; border:1px solid ${tok.border};
    border-radius:10px; padding:28px; max-width:580px; width:100%; color:${tok.text};
    box-sizing:border-box; }
  .op-fadein { animation:op-fade .4s ease both; }
  @keyframes op-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }

  .op-header { display:flex; justify-content:space-between; align-items:flex-start;
    gap:12px; margin-bottom:24px; }
  .op-eyebrow { font-family:${tok.monoFont}; font-size:9px; letter-spacing:.16em;
    color:${tok.muted}; margin:0 0 5px; }
  .op-title { font-family:${tok.dispFont}; font-size:26px; font-weight:700;
    letter-spacing:-.01em; margin:0 0 2px; line-height:1.1; }
  .op-subtitle { font-family:${tok.monoFont}; font-size:10px; color:${tok.muted}; margin:0; }
  .op-conf { font-family:${tok.monoFont}; font-size:9px; letter-spacing:.1em;
    padding:3px 8px; border-radius:3px; border:1px solid; white-space:nowrap; flex-shrink:0; }
  .op-conf--high   { color:${tok.tier.high};   border-color:${tok.tier.high};   background:${tok.highBg}; }
  .op-conf--medium { color:${tok.tier.medium}; border-color:${tok.tier.medium}; background:${tok.midBg};  }
  .op-conf--low    { color:${tok.tier.low};    border-color:${tok.tier.low};    background:${tok.lowBg};  }

  .op-score-section { display:flex; gap:28px; align-items:flex-start; margin-bottom:24px; }
  .op-breakdown { flex:1; min-width:0; padding-top:4px; }

  .op-section { margin-bottom:22px; }
  .op-sec-label { font-family:${tok.monoFont}; font-size:9px; letter-spacing:.16em;
    color:${tok.muted}; margin:0 0 10px; }

  .op-risk-tag { display:block; padding:5px 10px; border-radius:3px;
    font-family:${tok.bodyFont}; font-size:11px; line-height:1.55; color:${tok.text};
    background:rgba(192,57,43,0.05); border:1px solid rgba(192,57,43,0.16); }

  .op-ava { background:${tok.surface}; border:1px solid ${tok.border}; border-radius:7px; padding:16px; }
  .op-ava-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .op-ava-dot  { width:6px; height:6px; border-radius:50%; background:${tok.accent};
    flex-shrink:0; animation:op-pulse 2.4s ease-in-out infinite; }
  @keyframes op-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
  .op-ava-exp  { font-size:13px; line-height:1.7; margin:0 0 14px; }
  .op-ava-cols { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media(max-width:460px){ .op-ava-cols { grid-template-columns:1fr; } }
  .op-ava-glabel { font-family:${tok.monoFont}; font-size:8px; letter-spacing:.14em;
    color:${tok.muted}; margin:0 0 7px; }
  .op-ava-item { display:flex; gap:7px; font-size:12px; line-height:1.6; margin-bottom:5px; }

  .op-sim-toggle { width:100%; display:flex; justify-content:space-between; align-items:center;
    background:none; border:1px dashed ${tok.border}; border-radius:5px; padding:9px 13px;
    font-family:${tok.monoFont}; font-size:11px; letter-spacing:.05em; color:${tok.muted};
    cursor:pointer; transition:border-color .2s, color .2s; }
  .op-sim-toggle:hover { border-color:${tok.accent}; color:${tok.accent}; }

  .op-simulator { margin-top:12px; background:${tok.surface}; border:1px solid ${tok.border};
    border-radius:7px; padding:16px; }
  .op-sim-top { display:flex; align-items:center; gap:12px; flex-wrap:wrap;
    margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid ${tok.border}; }
  .op-spinner { display:inline-block; width:13px; height:13px; border:2px solid ${tok.border};
    border-top-color:${tok.accent}; border-radius:50%; animation:op-spin .6s linear infinite; }
  @keyframes op-spin { to{transform:rotate(360deg)} }

  .op-input { flex:1; background:${tok.bg}; border:1px solid ${tok.border}; border-radius:4px;
    padding:7px 10px; font-family:${tok.monoFont}; font-size:12px; color:${tok.text};
    outline:none; transition:border-color .2s; }
  .op-input:focus { border-color:${tok.accent}; }
  .op-input::placeholder { color:${tok.muted}; }
  .op-btn-add { background:${tok.accent}; border:none; border-radius:4px; padding:7px 12px;
    font-family:${tok.monoFont}; font-size:11px; color:#fff; cursor:pointer;
    white-space:nowrap; transition:opacity .2s; }
  .op-btn-add:hover { opacity:.85; }
  .op-skill-chip { background:${tok.accentBg}; border:1px solid ${tok.accent}; border-radius:3px;
    padding:2px 9px; font-family:${tok.monoFont}; font-size:10px; color:${tok.accent};
    cursor:pointer; transition:opacity .2s; }
  .op-skill-chip:hover { opacity:.7; }

  .op-sim-rings { display:flex; align-items:center; justify-content:center; gap:14px;
    margin-top:16px; padding-top:16px; border-top:1px solid ${tok.border}; }
  .op-ring-col  { display:flex; flex-direction:column; align-items:center; gap:5px; }

  .op-cta { display:inline-flex; align-items:center; justify-content:center;
    padding:11px 20px; border-radius:5px; font-family:${tok.dispFont}; font-size:13px;
    font-weight:600; letter-spacing:.04em; text-decoration:none; cursor:pointer;
    border:1px solid; transition:opacity .2s, transform .15s; flex:1; text-align:center; }
  .op-cta:hover { opacity:.85; transform:translateY(-1px); }
  .op-cta--primary.op-cta--high   { background:${tok.highBg}; color:${tok.tier.high};   border-color:${tok.tier.high};   }
  .op-cta--primary.op-cta--medium { background:${tok.midBg};  color:${tok.tier.medium}; border-color:${tok.tier.medium}; }
  .op-cta--primary.op-cta--low    { background:${tok.lowBg};  color:${tok.tier.low};    border-color:${tok.tier.low};    }
  .op-cta--ghost { background:transparent; color:${tok.muted}; border-color:${tok.border}; }
  .op-cta--ghost:hover { border-color:${tok.accent}; color:${tok.accent}; }

  .op-card { background:${tok.bg}; border:1px solid ${tok.border}; border-radius:8px;
    padding:18px; max-width:300px; width:100%; box-sizing:border-box; }
  .op-card-top { display:flex; justify-content:space-between; align-items:flex-start;
    gap:10px; margin-bottom:14px; }
  .op-card-title { font-family:${tok.dispFont}; font-size:16px; font-weight:600;
    letter-spacing:-.01em; margin:0; line-height:1.2; }
  .op-card-body  { display:flex; align-items:center; gap:14px; }
  .op-card-expand { background:none; border:1px solid ${tok.border}; border-radius:4px;
    padding:6px 11px; font-family:${tok.bodyFont}; font-size:12px; color:${tok.muted};
    cursor:pointer; text-align:left; transition:border-color .2s, color .2s; }
  .op-card-expand:hover { border-color:${tok.accent}; color:${tok.accent}; }

  .op-skel-line { height:14px; border-radius:4px; background:${tok.surface};
    margin-bottom:12px; animation:op-shimmer 1.4s ease infinite; }
  @keyframes op-shimmer { 0%,100%{opacity:.4} 50%{opacity:.9} }

  @media(max-width:480px){
    .op-root { padding:18px; }
    .op-score-section { flex-direction:column; align-items:center; }
    .op-breakdown { width:100%; }
    .op-title { font-size:20px; }
    footer { flex-direction:column; }
  }
`;