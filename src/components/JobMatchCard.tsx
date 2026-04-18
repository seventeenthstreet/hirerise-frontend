'use client';
import { getAuthToken } from '@/lib/getToken';
/**
 * components/JobMatchCard.tsx
 *
 * Reusable job match card that calls POST /api/jobs/match on demand.
 * Shows match %, breakdown bars, missing skills, insights, and a
 * context-sensitive CTA (Fix Resume / Improve Match / Apply Now).
 *
 * Connects to Auto-Fix: when ctaType === 'fix_resume' the button
 * navigates to /resume-builder pre-seeded with the target role so
 * auto-fix runs in job-specific mode.
 */

import React, { useState, useCallback } from 'react';
import type { ResumeContent, AtsBreakdown } from '@/lib/supabase';
import { AutoApplyButton } from '@/components/AutoApply';

// ─── Types (mirrors route output) ────────────────────────────────────────────
export interface JobInput {
  title:            string;
  description?:     string;
  requiredSkills?:  string[];
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'any';
}

interface JobMatchBreakdown {
  skillsMatch:     number;
  keywordMatch:    number;
  experienceMatch: number;
  atsScore:        number;
}

interface JobMatchResult {
  matchScore:      number;
  breakdown:       JobMatchBreakdown;
  missingSkills:   string[];
  matchedSkills:   string[];
  missingKeywords: string[];
  insights:        string[];
  ctaType:         'fix_resume' | 'improve_match' | 'apply_now';
  ctaLabel:        string;
  ctaHref:         string;
  atsBreakdown:    AtsBreakdown;
}

// ─── Design tokens (dark theme matching resume-builder) ───────────────────────
const C = {
  bg:   '#0b0f1a', s0: '#10151f', s1: '#161c2c', s2: '#1c2438',
  border: 'rgba(255,255,255,0.07)', borderB: 'rgba(255,255,255,0.12)',
  text: '#dde4ef', muted: '#5a6882',
  green: '#18d98b', blue: '#3b71f8', amber: '#f5a623',
  red: '#f04d3c', purple: '#9b7cf7', pink: '#e96caa',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreColor(v: number) {
  return v >= 75 ? C.green : v >= 50 ? C.blue : v >= 35 ? C.amber : C.red;
}

function scoreLabel(v: number) {
  return v >= 75 ? 'Strong match' : v >= 50 ? 'Good match' : v >= 35 ? 'Moderate match' : 'Weak match';
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

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 34, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const col = scoreColor(score);
  return (
    <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
      <svg width={84} height={84} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={42} cy={42} r={r} fill="none" stroke={C.s2} strokeWidth={7} />
        <circle cx={42} cy={42} r={r} fill="none" stroke={col} strokeWidth={7}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray .9s cubic-bezier(.4,0,.2,1), stroke .4s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: col, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, color: C.muted, fontWeight: 700 }}>/100</span>
      </div>
    </div>
  );
}

// ─── Dimension bar ────────────────────────────────────────────────────────────
function DimBar({ label, value, weight, color }: { label: string; value: number; weight: string; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 3 }}>
        <span style={{ color: C.muted }}>{label}</span>
        <span style={{ color: C.muted }}>
          <span style={{ fontWeight: 700, color }}>{value}%</span>
          <span style={{ marginLeft: 4, opacity: 0.5 }}>{weight}</span>
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: C.s2 }}>
        <div style={{ height: 4, borderRadius: 4, background: color, width: `${value}%`, transition: 'width .9s cubic-bezier(.4,0,.2,1)' }} />
      </div>
    </div>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────
function CtaButton({ type, label, href }: { type: JobMatchResult['ctaType']; label: string; href: string }) {
  const bg = type === 'fix_resume' ? C.pink : type === 'apply_now' ? C.green : C.blue;
  return (
    <a href={href} style={{
      display: 'block', textAlign: 'center', padding: '10px 16px', borderRadius: 10,
      background: bg, color: '#fff', fontWeight: 800, fontSize: 12, textDecoration: 'none',
      transition: 'opacity .15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {label}
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface JobMatchCardProps {
  job:         JobInput & { companyName?: string; jobUrl?: string };
  resumeData?: ResumeContent | null;
  resumeId?:   string | null;
  /** If true, runs match automatically on mount */
  autoRun?:   boolean;
  /** Visual style — 'compact' shows just score + CTA, 'full' shows all details */
  variant?:   'compact' | 'full';
}

export function JobMatchCard({
  job, resumeData, resumeId, autoRun = false, variant = 'full',
}: JobMatchCardProps) {
  const [result,   setResult]   = useState<JobMatchResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const runMatch = useCallback(async () => {
    if (!resumeData) { setError('No resume data available. Upload your CV first.'); return; }
    setLoading(true); setError(null);
    try {
      const res = await authPost<JobMatchResult>('/api/jobs/match', { resumeData, job });
      setResult(res);
      setExpanded(true);
    } catch (e: any) {
      setError(e.message ?? 'Match calculation failed');
    } finally {
      setLoading(false);
    }
  }, [resumeData, job]);

  // Auto-run on mount if requested
  React.useEffect(() => { if (autoRun && resumeData) runMatch(); }, [autoRun]);

  const col = result ? scoreColor(result.matchScore) : C.muted;

  return (
    <div style={{
      background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14,
      overflow: 'hidden', transition: 'box-shadow .2s',
    }}>
      {/* Top accent line — colour by match tier */}
      {result && (
        <div style={{ height: 3, background: col }} />
      )}

      <div style={{ padding: '16px 18px' }}>

        {/* Header row: job info + score ring */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {job.title}
            </p>
            {job.experienceLevel && job.experienceLevel !== 'any' && (
              <p style={{ margin: '2px 0 0', fontSize: 10, color: C.muted, textTransform: 'capitalize' }}>
                {job.experienceLevel} level
              </p>
            )}
            {result && (
              <span style={{
                display: 'inline-block', marginTop: 6,
                padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                background: `${col}18`, border: `1px solid ${col}30`, color: col,
              }}>
                {scoreLabel(result.matchScore)}
              </span>
            )}
          </div>
          {result ? <ScoreRing score={result.matchScore} /> : (
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: C.s1,
              border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: C.muted, textAlign: 'center', lineHeight: 1.4 }}>Not<br/>scored</span>
            </div>
          )}
        </div>

        {/* Required skills chips */}
        {job.requiredSkills && job.requiredSkills.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.muted, marginBottom: 5 }}>
              Required skills
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {job.requiredSkills.slice(0, 8).map(skill => {
                const matched = result?.matchedSkills.includes(skill);
                const missing = result?.missingSkills.includes(skill);
                return (
                  <span key={skill} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                    background: matched ? `${C.green}18` : missing ? `${C.red}12` : C.s1,
                    border: `1px solid ${matched ? C.green + '30' : missing ? C.red + '25' : C.border}`,
                    color: matched ? C.green : missing ? C.red : C.muted,
                  }}>
                    {matched ? '✓ ' : missing ? '✕ ' : ''}{skill}
                  </span>
                );
              })}
              {job.requiredSkills.length > 8 && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, color: C.muted, background: C.s1, border: `1px solid ${C.border}` }}>
                  +{job.requiredSkills.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ fontSize: 11, color: C.red, background: `${C.red}0a`, border: `1px solid ${C.red}25`,
            borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* Analyse button (pre-result) */}
        {!result && !loading && (
          <button onClick={runMatch} disabled={!resumeData} style={{
            width: '100%', padding: '10px', borderRadius: 10, border: 'none',
            background: `${C.blue}18`, color: C.blue, fontWeight: 800, fontSize: 12,
            cursor: resumeData ? 'pointer' : 'not-allowed', opacity: resumeData ? 1 : 0.4,
            fontFamily: 'inherit', transition: 'background .15s',
          }}>
            🎯 Check My Match
          </button>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, padding: '10px', color: C.muted, fontSize: 12 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%',
              border: `2px solid ${C.blue}40`, borderTopColor: C.blue,
              animation: 'spin .65s linear infinite' }} />
            Calculating match…
          </div>
        )}

        {/* Result */}
        {result && variant === 'full' && (
          <>
            {/* Expand / collapse breakdown */}
            <button onClick={() => setExpanded(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 0', marginBottom: expanded ? 10 : 0,
            }}>
              {expanded ? 'Hide' : 'Show'} breakdown
              <span style={{ display: 'inline-block', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>

            {expanded && (
              <div style={{ animation: 'rise .2s ease-out' }}>
                {/* Dimension bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14,
                  background: C.s1, borderRadius: 10, padding: '12px 14px' }}>
                  <DimBar label="Skills match"  value={result.breakdown.skillsMatch}     weight="40%" color={C.blue} />
                  <DimBar label="Keyword match"  value={result.breakdown.keywordMatch}    weight="30%" color={C.purple} />
                  <DimBar label="Experience"     value={result.breakdown.experienceMatch} weight="20%" color={C.amber} />
                  <DimBar label="ATS score"      value={result.breakdown.atsScore}        weight="10%" color={C.green} />
                </div>

                {/* Missing skills */}
                {result.missingSkills.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.1em', color: C.red, marginBottom: 5 }}>
                      Missing skills ({result.missingSkills.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {result.missingSkills.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
                          background: `${C.red}10`, border: `1px solid ${C.red}25`, color: C.red }}>
                          ✕ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing keywords */}
                {result.missingKeywords.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.1em', color: C.amber, marginBottom: 5 }}>
                      Missing keywords
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {result.missingKeywords.slice(0, 6).map(kw => (
                        <span key={kw} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20,
                          background: `${C.amber}10`, border: `1px solid ${C.amber}25`, color: C.amber }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Insights */}
                {result.insights.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.1em', color: C.muted, marginBottom: 6 }}>
                      Insights
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {result.insights.map((ins, i) => (
                        <li key={i} style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>{ins}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <AutoApplyButton
                job={job}
                resumeData={resumeData}
                resumeId={resumeId}
                size="sm"
              />
              <CtaButton type={result.ctaType} label={result.ctaLabel} href={result.ctaHref} />
            </div>

            {/* Re-check link */}
            <button onClick={runMatch} disabled={loading} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 10, color: C.muted, display: 'block', width: '100%',
              textAlign: 'center', marginTop: 8, padding: '2px',
            }}>
              ↻ Recalculate
            </button>
          </>
        )}

        {/* Compact variant — just CTA */}
        {result && variant === 'compact' && (
          <CtaButton type={result.ctaType} label={result.ctaLabel} href={result.ctaHref} />
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

// ─── Job Match Checker (standalone full-page widget) ─────────────────────────
// Drop this anywhere to let users paste a job and instantly check their match.
export function JobMatchChecker({ resumeData }: { resumeData?: ResumeContent | null }) {
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [skillsRaw,   setSkillsRaw]   = useState('');
  const [expLevel,    setExpLevel]    = useState<JobInput['experienceLevel']>('any');
  const [submitted,   setSubmitted]   = useState(false);

  const job: JobInput = {
    title,
    description: description || undefined,
    requiredSkills: skillsRaw ? skillsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    experienceLevel: expLevel,
  };

  if (submitted && title) {
    return (
      <div>
        <button onClick={() => setSubmitted(false)} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 11, color: '#5a6882', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ← Back to form
        </button>
        <JobMatchCard job={job} resumeData={resumeData} autoRun variant="full" />
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#161c2c', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#dde4ef',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: '#10151f', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em', color: '#5a6882', marginBottom: 12 }}>
        Job Match Checker
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#5a6882', marginBottom: 4 }}>Job Title *</div>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Senior Software Engineer" style={inputStyle} />
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#5a6882', marginBottom: 4 }}>Required Skills (comma-separated)</div>
          <input value={skillsRaw} onChange={e => setSkillsRaw(e.target.value)}
            placeholder="React, TypeScript, Node.js, SQL" style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#5a6882', marginBottom: 4 }}>Experience Level</div>
            <select value={expLevel} onChange={e => setExpLevel(e.target.value as JobInput['experienceLevel'])}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="any">Any</option>
              <option value="entry">Entry (0-2 yrs)</option>
              <option value="mid">Mid (2-6 yrs)</option>
              <option value="senior">Senior (5-12 yrs)</option>
              <option value="lead">Lead (8+ yrs)</option>
            </select>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#5a6882', marginBottom: 4 }}>Job Description (optional — improves keyword matching)</div>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Paste the job description here…" rows={4}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <button
          onClick={() => { if (title.trim()) setSubmitted(true); }}
          disabled={!title.trim() || !resumeData}
          style={{
            padding: '10px', borderRadius: 10, border: 'none', cursor: title.trim() && resumeData ? 'pointer' : 'not-allowed',
            background: title.trim() && resumeData ? '#3b71f8' : 'rgba(59,113,248,0.3)',
            color: '#fff', fontWeight: 800, fontSize: 12, fontFamily: 'inherit', transition: 'opacity .15s',
          }}
        >
          {!resumeData ? 'Upload your CV first' : '🎯 Check My Match'}
        </button>
      </div>
    </div>
  );
}