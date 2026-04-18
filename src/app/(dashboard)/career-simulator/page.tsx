'use client';

// app/(dashboard)/career-simulator/page.tsx
// Phase 7 — Career Probability Engine + Interactive Simulator
//
// Architecture: page → useCareerHealth() + useProfile() → calculateCareerProbability()
// No direct fetch calls. All data from existing hooks.

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useProfile } from '@/hooks/useProfile';
import { CareerProbabilityBreakdown } from '@/components/career/CareerProbabilityBreakdown';
import { AICareerGuidance } from '@/components/career/AICareerGuidance';
import {
  calculateCareerProbability,
  SCENARIO_PRESETS,
  EDUCATION_LABELS,
  EXPERIENCE_LABELS,
  type EducationLevel,
  type ExperienceLevel,
  type SimulatorOverrides,
  type ProbabilityResult,
} from '@/lib/careerProbability';
import { cn } from '@/utils/cn';

// ─── Gauge arc ────────────────────────────────────────────────────────────────

function GaugeArc({ score, size = 160, label }: { score: number; size?: number; label?: string }) {
  const r      = size * 0.38;
  const cx     = size / 2;
  const cy     = size * 0.54;
  const circ   = Math.PI * r;
  const pct    = Math.min(100, Math.max(0, score));
  const filled = (pct / 100) * circ;
  const color  = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#f87171';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#f1f3f9" strokeWidth={size * 0.07} strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke={color} strokeWidth={size * 0.07} strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x={cx} y={cy - size * 0.04} textAnchor="middle"
          fontSize={size * 0.24} fontWeight="900" fill={color} fontFamily="inherit">
          {pct}%
        </text>
      </svg>
      {label && (
        <span className="text-xs font-medium text-surface-500 mt-1">{label}</span>
      )}
    </div>
  );
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ base, current }: { base: number; current: number }) {
  const delta = current - base;
  if (Math.abs(delta) < 1) return null;
  return (
    <span className={cn(
      'rounded-full px-2.5 py-1 text-xs font-black',
      delta > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500',
    )}>
      {delta > 0 ? '+' : ''}{Math.round(delta)}%
    </span>
  );
}

// ─── Scenario preset buttons ──────────────────────────────────────────────────

function ScenarioButtons({
  active,
  onSelect,
}: {
  active:   string;
  onSelect: (id: string, overrides: SimulatorOverrides) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SCENARIO_PRESETS.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id, s.overrides)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all',
            active === s.id
              ? 'border-hr-300 bg-hr-50 text-hr-700 shadow-sm'
              : 'border-surface-100 bg-white text-surface-600 hover:border-surface-200 hover:bg-surface-50',
          )}
        >
          <span>{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ─── Select field ─────────────────────────────────────────────────────────────

function SimSelect<T extends string>({
  label, value, options, onChange,
}: {
  label:    string;
  value:    T;
  options:  Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-surface-400 mb-1.5">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2.5 text-sm font-medium text-surface-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-hr-300 focus:border-hr-300 transition-colors"
      >
        {(Object.entries(options) as [T, string][]).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Skill toggle chip ────────────────────────────────────────────────────────

function SkillToggle({
  name,
  active,
  onToggle,
  priority,
}: {
  name:     string;
  active:   boolean;
  onToggle: () => void;
  priority: string;
}) {
  const dot =
    priority === 'critical' ? 'bg-red-400' :
    priority === 'high'     ? 'bg-amber-400' :
                              'bg-yellow-400';

  return (
    <button
      onClick={onToggle}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
        active
          ? 'border-hr-300 bg-hr-500 text-white shadow-sm'
          : 'border-surface-100 bg-white text-surface-600 hover:border-hr-200 hover:bg-hr-50',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', active ? 'bg-white' : dot)} />
      {name}
      {active && (
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

// ─── Comparison row ───────────────────────────────────────────────────────────

function ComparisonBar({
  label, base, simulated,
}: {
  label:     string;
  base:      number;
  simulated: number;
}) {
  const maxVal = Math.max(base, simulated, 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-xs font-semibold text-surface-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-surface-400">{base}→</span>
          <span className={cn(
            'text-xs font-black',
            simulated > base ? 'text-green-600' : simulated < base ? 'text-red-500' : 'text-surface-500',
          )}>
            {simulated}
          </span>
        </div>
      </div>
      <div className="relative h-3 rounded-full bg-surface-100 overflow-hidden">
        {/* Base bar */}
        <div
          className="absolute top-0 left-0 h-full rounded-full bg-surface-200 transition-all duration-500"
          style={{ width: `${(base / 100) * 100}%` }}
        />
        {/* Simulated bar */}
        <div
          className={cn(
            'absolute top-0 left-0 h-full rounded-full transition-all duration-700',
            simulated >= base ? 'bg-hr-500' : 'bg-red-400',
          )}
          style={{ width: `${(simulated / 100) * 100}%`, opacity: 0.8 }}
        />
      </div>
    </div>
  );
}

// ─── What-if chip input ───────────────────────────────────────────────────────

const WHAT_IF_SCENARIOS = [
  { id: 'learn_docker',    label: 'I learn Docker',             overrides: { addedSkills: ['Docker'] as string[] } },
  { id: 'learn_python',    label: 'I learn Python',             overrides: { addedSkills: ['Python'] as string[] } },
  { id: 'internship',      label: 'I get an internship',        overrides: { experience: 'junior' as ExperienceLevel } },
  { id: 'bsc',             label: 'I complete my BSc',          overrides: { education: 'bachelors' as EducationLevel } },
  { id: 'msc',             label: 'I complete my MSc',          overrides: { education: 'masters' as EducationLevel } },
  { id: 'mid_exp',         label: 'I gain 3 years experience',  overrides: { experience: 'mid' as ExperienceLevel } },
  { id: 'senior_exp',      label: 'I gain 6+ years experience', overrides: { experience: 'senior' as ExperienceLevel } },
  { id: 'learn_k8s',       label: 'I learn Kubernetes',         overrides: { addedSkills: ['Kubernetes'] as string[] } },
  { id: 'learn_sysdesign', label: 'I learn System Design',      overrides: { addedSkills: ['System Design'] as string[] } },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CareerSimulatorPage() {
  const { data: chi,     isLoading: chiLoading  } = useCareerHealth();
  const { data: profile, isLoading: profLoading } = useProfile();

  const user       = profile?.user;
  const isLoading  = chiLoading || profLoading;

  // ── Simulator state ─────────────────────────────────────────────────────────
  const [activePreset, setActivePreset]       = useState('base');
  const [education, setEducation]             = useState<EducationLevel>('bachelors');
  const [experience, setExperience]           = useState<ExperienceLevel>('junior');
  const [addedSkills, setAddedSkills]         = useState<string[]>([]);
  const [activeWhatIf, setActiveWhatIf]       = useState<string | null>(null);

  // Merge all overrides
  const currentOverrides: SimulatorOverrides = useMemo(() => {
    const whatIf = WHAT_IF_SCENARIOS.find(w => w.id === activeWhatIf);
    return {
      education,
      experience,
      addedSkills,
      ...(whatIf?.overrides ?? {}),
    };
  }, [education, experience, addedSkills, activeWhatIf]);

  // ── Calculations ────────────────────────────────────────────────────────────
  const baseResult      = useMemo(() => calculateCareerProbability(chi, user, {}), [chi, user]);
  const simulatedResult = useMemo(() => calculateCareerProbability(chi, user, currentOverrides), [chi, user, currentOverrides]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const applyPreset = useCallback((id: string, overrides: SimulatorOverrides) => {
    setActivePreset(id);
    if (overrides.education)  setEducation(overrides.education);
    if (overrides.experience) setExperience(overrides.experience);
    setAddedSkills([]);
    setActiveWhatIf(null);
  }, []);

  const toggleSkill = useCallback((name: string) => {
    setAddedSkills(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  }, []);

  const toggleWhatIf = useCallback((id: string) => {
    setActiveWhatIf(prev => prev === id ? null : id);
  }, []);

  const reset = useCallback(() => {
    setEducation('bachelors');
    setExperience('junior');
    setAddedSkills([]);
    setActivePreset('base');
    setActiveWhatIf(null);
  }, []);

  const hasChanges = education !== 'bachelors' || experience !== 'junior'
    || addedSkills.length > 0 || activeWhatIf !== null;

  return (
    <div className="animate-slide-up space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-surface-900">Career Simulator</h2>
            <span className="rounded-full bg-hr-50 border border-hr-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-hr-600">
              Phase 7
            </span>
          </div>
          <p className="mt-0.5 text-sm text-surface-400">
            Simulate career scenarios and understand what drives your probability.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-xs font-semibold text-hr-500 hover:text-hr-700 transition-colors mt-1"
        >
          ← Dashboard
        </Link>
      </div>

      {/* ── Hero comparison ── */}
      <div className="rounded-2xl border border-hr-100 bg-gradient-to-br from-hr-50 via-white to-white p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">

          {/* Base gauge */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">Current</p>
            {isLoading ? (
              <div className="h-20 w-32 animate-pulse rounded bg-surface-100" />
            ) : (
              <GaugeArc score={baseResult.probability} size={140} />
            )}
            <p className="text-xs font-medium text-surface-500">{baseResult.label}</p>
          </div>

          {/* Arrow + delta */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <svg className="h-6 w-6 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            {!isLoading && (
              <DeltaBadge base={baseResult.probability} current={simulatedResult.probability} />
            )}
            <p className="text-[10px] text-surface-400 text-center">
              {hasChanges ? 'Simulated scenario' : 'Adjust inputs to simulate'}
            </p>
          </div>

          {/* Simulated gauge */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">
              {hasChanges ? 'Simulated' : 'No Change'}
            </p>
            {isLoading ? (
              <div className="h-20 w-32 animate-pulse rounded bg-surface-100" />
            ) : (
              <GaugeArc score={simulatedResult.probability} size={140} />
            )}
            <p className="text-xs font-medium text-surface-500">{simulatedResult.label}</p>
          </div>
        </div>

        {/* Target role */}
        {user?.targetRole && (
          <p className="mt-4 text-center text-xs text-surface-400">
            Target: <span className="font-semibold text-surface-700">{user.targetRole}</span>
          </p>
        )}
      </div>

      {/* ── Simulator controls ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Left: inputs */}
        <div className="lg:col-span-1 space-y-5">

          <div className="rounded-xl border border-surface-100 bg-white shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400">
                Simulator Inputs
              </h3>
              {hasChanges && (
                <button
                  onClick={reset}
                  className="text-[10px] font-semibold text-surface-400 hover:text-surface-700 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="space-y-4">
              <SimSelect<EducationLevel>
                label="Education Level"
                value={education}
                options={EDUCATION_LABELS}
                onChange={v => { setEducation(v); setActivePreset('custom'); }}
              />
              <SimSelect<ExperienceLevel>
                label="Experience Level"
                value={experience}
                options={EXPERIENCE_LABELS}
                onChange={v => { setExperience(v); setActivePreset('custom'); }}
              />
            </div>
          </div>

          {/* Scenario presets */}
          <div className="rounded-xl border border-surface-100 bg-white shadow-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-3">
              Scenario Presets
            </h3>
            <ScenarioButtons active={activePreset} onSelect={applyPreset} />
          </div>
        </div>

        {/* Right: skill toggles + what-if */}
        <div className="lg:col-span-2 space-y-4">

          {/* Skill gap toggles */}
          {chi?.isReady && chi.skillGaps.length > 0 && (
            <div className="rounded-xl border border-surface-100 bg-white shadow-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400">
                  Simulate Learning Skills
                </h3>
                <span className="text-[10px] text-surface-400">Click to toggle</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {chi.skillGaps.slice(0, 10).map(gap => (
                  <SkillToggle
                    key={gap.skillName}
                    name={gap.skillName}
                    active={addedSkills.includes(gap.skillName)}
                    onToggle={() => toggleSkill(gap.skillName)}
                    priority={gap.priority}
                  />
                ))}
              </div>
              {addedSkills.length > 0 && (
                <p className="mt-3 text-xs text-surface-400">
                  Simulating: you have learned{' '}
                  <span className="font-semibold text-hr-600">{addedSkills.join(', ')}</span>
                </p>
              )}
            </div>
          )}

          {/* What-if scenarios */}
          <div className="rounded-xl border border-surface-100 bg-white shadow-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-3">
              What-If Scenarios
            </h3>
            <div className="flex flex-wrap gap-2">
              {WHAT_IF_SCENARIOS.map(w => {
                const testResult = calculateCareerProbability(chi, user, {
                  ...currentOverrides,
                  ...w.overrides,
                });
                const delta = testResult.probability - baseResult.probability;

                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWhatIf(w.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all',
                      activeWhatIf === w.id
                        ? 'border-hr-300 bg-hr-50 text-hr-700 font-semibold shadow-sm'
                        : 'border-surface-100 bg-white text-surface-600 hover:border-surface-200 hover:bg-surface-50',
                    )}
                  >
                    <span>What if {w.label}?</span>
                    {delta !== 0 && (
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                        delta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
                      )}>
                        {delta > 0 ? '+' : ''}{Math.round(delta)}%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Factor comparison bars */}
          <div className="rounded-xl border border-surface-100 bg-white shadow-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-4">
              Factor Comparison
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Skills Match',   base: baseResult.breakdown.skills,     sim: simulatedResult.breakdown.skills },
                { label: 'Education',      base: baseResult.breakdown.education,  sim: simulatedResult.breakdown.education },
                { label: 'Market Demand',  base: baseResult.breakdown.demand,     sim: simulatedResult.breakdown.demand },
                { label: 'Experience',     base: baseResult.breakdown.experience, sim: simulatedResult.breakdown.experience },
              ].map(r => (
                <ComparisonBar key={r.label} label={r.label} base={r.base} simulated={r.sim} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Probability breakdown + AI Guidance ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CareerProbabilityBreakdown
          overrideBreakdown={simulatedResult.breakdown}
          baseBreakdown={baseResult.breakdown}
          showDelta={hasChanges}
        />
        <AICareerGuidance
          externalResult={simulatedResult}
          contextLabel={hasChanges ? 'Simulated' : undefined}
        />
      </div>

    </div>
  );
}