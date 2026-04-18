'use client';
import { getAuthToken } from '@/lib/getToken';
/**
 * components/InterviewPrep.tsx
 *
 * Complete Interview Prep Engine UI.
 *
 * Exports:
 *   InterviewPrepWidget   — compact dashboard card (score + quick-start CTA)
 *   InterviewPrepFull     — full-page experience (questions + mock interview)
 *
 * Modes:
 *   'browse'  — read question cards with suggested answers & tips
 *   'mock'    — sequential mock interview: type answer → get scored feedback
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { ResumeContent } from '@/lib/supabase';
import type { InterviewQuestion, QuestionCategory, GenerateInterviewResult, EvaluationResult } from '@/lib/interviewTypes';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:   '#060810', s0: '#0b0f1a', s1: '#10151f', s2: '#161c2c', s3: '#1c2438',
  border: 'rgba(255,255,255,0.07)', borderB: 'rgba(255,255,255,0.12)',
  text: '#dde4ef', muted: '#5a6882',
  green: '#18d98b', blue: '#3b71f8', amber: '#f5a623',
  red: '#f04d3c', purple: '#9b7cf7', pink: '#e96caa',
} as const;

const KF = `
@keyframes spin  { to { transform: rotate(360deg) } }
@keyframes rise  { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:none } }
@keyframes pop   { from { opacity:0;transform:scale(.96) } to { opacity:1;transform:none } }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
`;

// ─── Session storage for score history ─────────────────────────────────────────
const PREP_KEY = 'interview_prep_v1';
interface PrepSession { role: string; score: number; date: string; questionsAnswered: number }
function loadSessions(): PrepSession[] {
  try { const r = sessionStorage.getItem(PREP_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveSession(s: PrepSession) {
  try {
    const prev = loadSessions();
    sessionStorage.setItem(PREP_KEY, JSON.stringify([s, ...prev].slice(0, 20)));
  } catch { /* noop */ }
}

// ─── Shared API helper ─────────────────────────────────────────────────────────
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

// ─── Atoms ─────────────────────────────────────────────────────────────────────
function Spinner({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${color}30`, borderTopColor: color, animation: 'spin .65s linear infinite', flexShrink: 0 }} />;
}

function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = size * 0.4, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const col = score >= 75 ? C.green : score >= 60 ? C.blue : score >= 40 ? C.amber : C.red;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.s2} strokeWidth={size * 0.1} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={size * 0.1}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray .9s cubic-bezier(.4,0,.2,1), stroke .4s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.28, fontWeight: 900, color: col, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size * 0.12, color: C.muted, fontWeight: 700 }}>/100</span>
      </div>
    </div>
  );
}

const CATEGORY_META: Record<QuestionCategory, { label: string; icon: string; color: string }> = {
  behavioural:  { label: 'Behavioural',  icon: '🧠', color: C.purple },
  technical:    { label: 'Technical',    icon: '⚙️', color: C.blue   },
  situational:  { label: 'Situational',  icon: '🎭', color: C.amber  },
  motivation:   { label: 'Motivation',   icon: '🎯', color: C.green  },
  strength_gap: { label: 'Strengths',    icon: '💪', color: C.pink   },
};

const GRADE_COLORS: Record<EvaluationResult['grade'], string> = {
  A: C.green, B: C.blue, C: C.amber, D: '#f97316', F: C.red,
};

// ─── Job input form ─────────────────────────────────────────────────────────────
interface JobSetup {
  title:           string;
  description:     string;
  requiredSkills:  string;
  experienceLevel: string;
}

function JobSetupForm({ onStart, loading }: { onStart: (job: JobSetup) => void; loading: boolean }) {
  const [job, setJob] = useState<JobSetup>({ title: '', description: '', requiredSkills: '', experienceLevel: 'mid' });
  const inp: React.CSSProperties = { width: '100%', background: C.s1, border: `1px solid ${C.borderB}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px', animation: 'rise .3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 22 }}>🎤</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Interview Prep with Ava</div>
          <div style={{ fontSize: 11, color: C.muted }}>Get personalised questions and coaching for your target role</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Target Role *</div>
          <input value={job.title} onChange={e => setJob(j => ({ ...j, title: e.target.value }))} placeholder="e.g. Senior Software Engineer" style={inp} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Experience Level</div>
            <select value={job.experienceLevel} onChange={e => setJob(j => ({ ...j, experienceLevel: e.target.value }))}
              style={{ ...inp, cursor: 'pointer' }}>
              <option value="entry">Entry (0-2 yrs)</option>
              <option value="mid">Mid (2-6 yrs)</option>
              <option value="senior">Senior (6+ yrs)</option>
              <option value="lead">Lead / Manager</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Key Skills (comma-sep)</div>
            <input value={job.requiredSkills} onChange={e => setJob(j => ({ ...j, requiredSkills: e.target.value }))} placeholder="React, SQL, Leadership" style={inp} />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 4 }}>Job Description (optional — improves personalisation)</div>
          <textarea value={job.description} onChange={e => setJob(j => ({ ...j, description: e.target.value }))}
            placeholder="Paste the job description…" rows={3} style={{ ...inp, resize: 'vertical' }} />
        </div>
        <button
          onClick={() => job.title.trim() && onStart(job)}
          disabled={!job.title.trim() || loading}
          style={{
            padding: '11px', borderRadius: 10, border: 'none', fontFamily: 'inherit',
            background: job.title.trim() && !loading ? `linear-gradient(135deg, ${C.blue}, ${C.purple})` : C.s2,
            color: '#fff', fontWeight: 800, fontSize: 13,
            cursor: job.title.trim() && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {loading ? <><Spinner size={14} /> Ava is preparing your questions…</> : '🎤 Generate Interview Questions'}
        </button>
      </div>
    </div>
  );
}

// ─── Question card (browse mode) ───────────────────────────────────────────────
function QuestionCard({ q, index, onPractice }: { q: InterviewQuestion; index: number; onPractice: (q: InterviewQuestion) => void }) {
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[q.category] ?? CATEGORY_META.behavioural;
  const diffCol = q.difficulty === 'hard' ? C.red : q.difficulty === 'medium' ? C.amber : C.green;
  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header */}
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left' }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${meta.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{meta.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '.08em' }}>{meta.label}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: diffCol, background: `${diffCol}12`, borderRadius: 20, padding: '1px 6px' }}>{q.difficulty}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: C.muted }}>Q{index + 1}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.45 }}>{q.question}</div>
        </div>
        <span style={{ color: C.muted, fontSize: 10, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▾</span>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '0 16px 16px', animation: 'rise .2s ease-out' }}>
          <div style={{ height: 1, background: C.border, marginBottom: 12 }} />

          {/* Intent */}
          <div style={{ fontSize: 10, color: C.muted, fontStyle: 'italic', marginBottom: 12, padding: '6px 10px', background: C.s1, borderRadius: 7 }}>
            🎯 <strong>What they're testing:</strong> {q.intent}
          </div>

          {/* Suggested answer */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: C.green, marginBottom: 6 }}>💬 Suggested Answer</div>
            <p style={{ margin: 0, fontSize: 12, color: C.text, lineHeight: 1.65, background: `${C.green}08`, border: `1px solid ${C.green}20`, borderRadius: 8, padding: '10px 12px' }}>{q.suggestedAnswer}</p>
          </div>

          {/* Key points */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: C.blue, marginBottom: 6 }}>✅ Key Points to Cover</div>
            <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {q.keyPoints.map((p: string, i: number) => <li key={i} style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>{p}</li>)}
            </ul>
          </div>

          {/* Tips */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: C.amber, marginBottom: 6 }}>💡 Tips</div>
            <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {q.tips.map((t: string, i: number) => <li key={i} style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>{t}</li>)}
            </ul>
          </div>

          <button onClick={() => onPractice(q)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: `${C.blue}18`, color: C.blue, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            🎤 Practice This Question
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Evaluation result view ─────────────────────────────────────────────────────
function EvalView({ eval: ev, question, onNext }: { eval: EvaluationResult; question: InterviewQuestion; onNext: () => void }) {
  const gradeCol = GRADE_COLORS[ev.grade];
  return (
    <div style={{ animation: 'rise .3s ease-out' }}>
      {/* Score header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, background: C.s1, borderRadius: 12, padding: '14px 16px' }}>
        <ScoreRing score={ev.score} size={72} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: gradeCol }}>{ev.grade}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
              {ev.score >= 90 ? 'Exceptional answer!' : ev.score >= 75 ? 'Strong answer' : ev.score >= 60 ? 'Good, room to grow' : ev.score >= 40 ? 'Needs improvement' : 'Keep practising'}
            </span>
          </div>
          {/* Key points coverage */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {question.keyPoints.map((kp: string, i: number) => (
              <span key={i} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: ev.keyPointsHit[i] ? `${C.green}18` : `${C.red}12`, color: ev.keyPointsHit[i] ? C.green : C.red }}>
                {ev.keyPointsHit[i] ? '✓' : '✕'} Point {i + 1}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Strengths */}
      {ev.strengths.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: C.green, marginBottom: 6 }}>💪 What You Did Well</div>
          <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ev.strengths.map((s, i) => <li key={i} style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {ev.improvements.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: C.amber, marginBottom: 6 }}>⬆ Improvements</div>
          <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ev.improvements.map((s, i) => <li key={i} style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Better answer */}
      {ev.betterAnswer && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: C.blue, marginBottom: 6 }}>✨ Stronger Version</div>
          <p style={{ margin: 0, fontSize: 12, color: C.text, lineHeight: 1.65, background: `${C.blue}08`, border: `1px solid ${C.blue}20`, borderRadius: 8, padding: '10px 12px' }}>{ev.betterAnswer}</p>
        </div>
      )}

      {/* Ava coaching */}
      {ev.avaCoaching && (
        <div style={{ marginBottom: 16, background: `${C.pink}0a`, border: `1px solid ${C.pink}25`, borderRadius: 10, padding: '10px 13px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>🤖</span>
          <p style={{ margin: 0, fontSize: 11, color: C.text, lineHeight: 1.5, fontStyle: 'italic' }}>Ava: {ev.avaCoaching}</p>
        </div>
      )}

      <button onClick={onNext} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
        Next Question →
      </button>
    </div>
  );
}

// ─── Mock interview mode ────────────────────────────────────────────────────────
function MockInterview({
  questions, resumeData, onComplete,
}: {
  questions:  InterviewQuestion[];
  resumeData: ResumeContent;
  onComplete: (scores: number[]) => void;
}) {
  const [idx,        setIdx]        = useState(0);
  const [answer,     setAnswer]     = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [scores,     setScores]     = useState<number[]>([]);
  const [error,      setError]      = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const q = questions[idx];
  const meta = CATEGORY_META[q?.category ?? 'behavioural'] ?? CATEGORY_META.behavioural;
  const progress = `${idx + 1} / ${questions.length}`;

  const handleEvaluate = useCallback(async () => {
    if (!answer.trim()) return;
    setEvaluating(true); setError(null);
    try {
      const result = await authPost<EvaluationResult>('/api/interview/evaluate', { question: q, userAnswer: answer, resumeData });
      setEvalResult(result);
      setScores(prev => [...prev, result.score]);
    } catch (e: any) {
      setError(e.message ?? 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  }, [answer, q, resumeData]);

  const handleNext = () => {
    const newScores = scores; // already updated in handleEvaluate
    if (idx >= questions.length - 1) {
      onComplete(newScores);
    } else {
      setIdx(i => i + 1);
      setAnswer('');
      setEvalResult(null);
      setTimeout(() => textRef.current?.focus(), 100);
    }
  };

  if (!q) return null;

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginBottom: 5 }}>
          <span>Question {progress}</span>
          {scores.length > 0 && <span>Running avg: {Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}/100</span>}
        </div>
        <div style={{ height: 4, borderRadius: 4, background: C.s2 }}>
          <div style={{ height: 4, borderRadius: 4, background: C.blue, width: `${((idx + 1) / questions.length) * 100}%`, transition: 'width .4s' }} />
        </div>
      </div>

      {!evalResult ? (
        <div>
          {/* Question */}
          <div style={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{meta.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '.08em' }}>{meta.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.55 }}>{q.question}</p>
            <p style={{ margin: '6px 0 0', fontSize: 10, color: C.muted, fontStyle: 'italic' }}>Tip: {q.tips[0]}</p>
          </div>

          {/* Answer input */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 5 }}>Your Answer</div>
            <textarea
              ref={textRef}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Type your answer here… Use the STAR method: Situation, Task, Action, Result"
              rows={6}
              style={{ width: '100%', background: C.s1, border: `1px solid ${C.borderB}`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.text, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{answer.split(/\s+/).filter(Boolean).length} words</div>
          </div>

          {error && <div style={{ fontSize: 11, color: C.red, marginBottom: 10 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleEvaluate} disabled={!answer.trim() || evaluating}
              style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', fontFamily: 'inherit',
                background: answer.trim() && !evaluating ? C.blue : C.s2,
                color: '#fff', fontWeight: 800, fontSize: 12,
                cursor: answer.trim() && !evaluating ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {evaluating ? <><Spinner size={13} /> Ava is evaluating…</> : '📊 Submit & Get Feedback'}
            </button>
            <button onClick={handleNext} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip
            </button>
          </div>
        </div>
      ) : (
        <EvalView eval={evalResult} question={q} onNext={handleNext} />
      )}
    </div>
  );
}

// ─── Session results screen ─────────────────────────────────────────────────────
function SessionResults({ scores, role, onRestart, onBrowse }: { scores: number[]; role: string; onRestart: () => void; onBrowse: () => void }) {
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const col = avg >= 75 ? C.green : avg >= 60 ? C.blue : avg >= 40 ? C.amber : C.red;
  return (
    <div style={{ textAlign: 'center', animation: 'pop .3s ease-out' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>{avg >= 75 ? '🎉' : avg >= 60 ? '💪' : '📈'}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 4 }}>Mock Interview Complete!</div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>{role}</div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <ScoreRing score={avg} size={96} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Questions', value: String(scores.length) },
          { label: 'Avg Score', value: `${avg}/100` },
          { label: 'Top Score', value: `${Math.max(...scores)}/100` },
        ].map(s => (
          <div key={s.label} style={{ background: C.s1, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 8px' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: col }}>{s.value}</div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: `${C.pink}0a`, border: `1px solid ${C.pink}25`, borderRadius: 10, padding: '10px 14px', marginBottom: 18, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <span>🤖</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: C.pink }}>Ava's coaching</span>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: C.text, lineHeight: 1.55 }}>
          {avg >= 75
            ? "Excellent performance! Focus on quantifying achievements more to push scores above 90."
            : avg >= 60
            ? "Good foundation. Practice the STAR method (Situation, Task, Action, Result) for behavioural questions."
            : "Keep practising — repetition builds confidence. Focus on specific examples from your experience."}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onRestart} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: C.blue, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          🔄 Practice Again
        </button>
        <button onClick={onBrowse} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Browse Questions
        </button>
      </div>
    </div>
  );
}

// ─── InterviewPrepFull ──────────────────────────────────────────────────────────
type ViewMode = 'setup' | 'browse' | 'mock' | 'results';

export interface InterviewPrepFullProps {
  resumeData?: ResumeContent | null;
}

export function InterviewPrepFull({ resumeData }: InterviewPrepFullProps) {
  const [mode,      setMode]      = useState<ViewMode>('setup');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [prepData,  setPrepData]  = useState<GenerateInterviewResult | null>(null);
  const [mockScores, setMockScores] = useState<number[]>([]);
  const [filter,    setFilter]    = useState<QuestionCategory | 'all'>('all');
  const [practiceQ, setPracticeQ] = useState<InterviewQuestion | null>(null);

  const handleSetup = useCallback(async (job: { title: string; description: string; requiredSkills: string; experienceLevel: string }) => {
    if (!resumeData) { setError('Upload your CV first to enable personalised questions.'); return; }
    setLoading(true); setError(null);
    try {
      const result = await authPost<GenerateInterviewResult>('/api/interview/generate', {
        resumeData,
        job: {
          title:           job.title,
          description:     job.description || undefined,
          requiredSkills:  job.requiredSkills ? job.requiredSkills.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          experienceLevel: job.experienceLevel,
        },
        count: 8,
      });
      setPrepData(result);
      setMode('browse');
    } catch (e: any) {
      setError(e.message ?? 'Failed to generate questions');
    } finally {
      setLoading(false);
    }
  }, [resumeData]);

  const filteredQs = prepData?.questions.filter((q: InterviewQuestion) => filter === 'all' || q.category === filter) ?? [];

  if (mode === 'setup' || !prepData) {
    return (
      <div>
        <style>{KF}</style>
        {error && <div style={{ fontSize: 11, color: C.red, background: `${C.red}0a`, border: `1px solid ${C.red}25`, borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>{error}</div>}
        <JobSetupForm onStart={handleSetup} loading={loading} />
      </div>
    );
  }

  if (mode === 'mock') {
    return (
      <div>
        <style>{KF}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button onClick={() => { setMode('browse'); setPracticeQ(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 11, fontFamily: 'inherit', padding: '4px 0' }}>← Back</button>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{practiceQ ? 'Practice Mode' : 'Mock Interview'}</span>
        </div>
        <MockInterview
          questions={practiceQ ? [practiceQ] : prepData.questions}
          resumeData={resumeData!}
          onComplete={(scores) => { setMockScores(scores); setMode('results'); saveSession({ role: prepData.role, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), date: new Date().toISOString(), questionsAnswered: scores.length }); }}
        />
      </div>
    );
  }

  if (mode === 'results') {
    return (
      <div>
        <style>{KF}</style>
        <SessionResults scores={mockScores} role={prepData.role} onRestart={() => { setMode('mock'); setPracticeQ(null); }} onBrowse={() => setMode('browse')} />
      </div>
    );
  }

  // Browse mode
  return (
    <div>
      <style>{KF}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{prepData.role}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{prepData.questions.length} questions · {prepData.difficulty} level</div>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={() => { setMode('mock'); setPracticeQ(null); }} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: `linear-gradient(135deg,${C.blue},${C.purple})`, color: '#fff', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            🎤 Start Mock Interview
          </button>
          <button onClick={() => setMode('setup')} style={{ padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.border}`, background: 'none', color: C.muted, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            New Role
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['all', ...Object.keys(CATEGORY_META)] as ('all' | QuestionCategory)[]).map(cat => {
          const active = filter === cat;
          const meta = cat === 'all' ? null : CATEGORY_META[cat];
          return (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${active ? (meta?.color ?? C.blue) : C.border}`, background: active ? `${meta?.color ?? C.blue}18` : 'none', color: active ? (meta?.color ?? C.blue) : C.muted, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {cat === 'all' ? 'All' : `${meta?.icon} ${meta?.label}`}
            </button>
          );
        })}
      </div>

      {/* Question cards */}
      {filteredQs.map((q, i) => (
        <QuestionCard key={q.id} q={q} index={i} onPractice={(q) => { setPracticeQ(q); setMode('mock'); }} />
      ))}
    </div>
  );
}

// ─── InterviewPrepWidget (dashboard card) ───────────────────────────────────────
export function InterviewPrepWidget({ resumeData }: { resumeData?: ResumeContent | null }) {
  const sessions = loadSessions();
  const lastScore = sessions[0]?.score ?? null;
  const avgScore  = sessions.length ? Math.round(sessions.reduce((s, r) => s + r.score, 0) / sessions.length) : null;

  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <style>{KF}</style>

      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎤</span>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.text }}>Interview Prep</div>
          </div>
          <a href="/interview-prep" style={{ fontSize: 10, color: C.blue, textDecoration: 'none', fontWeight: 600 }}>
            Open →
          </a>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {sessions.length > 0 ? (
          <>
            {/* Score summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Last Score',   value: lastScore  !== null ? `${lastScore}/100`  : '—', col: lastScore  !== null ? (lastScore  >= 75 ? C.green : C.amber) : C.muted },
                { label: 'Avg Score',    value: avgScore   !== null ? `${avgScore}/100`   : '—', col: avgScore   !== null ? (avgScore   >= 75 ? C.green : C.amber) : C.muted },
              ].map(s => (
                <div key={s.label} style={{ background: C.s1, borderRadius: 9, padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: s.col }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Session history mini-list */}
            <div style={{ marginBottom: 12 }}>
              {sessions.slice(0, 3).map((s: PrepSession, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: i < 2 ? `1px solid ${C.border}` : 'none' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{s.role}</div>
                    <div style={{ fontSize: 9, color: C.muted }}>{new Date(s.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {s.questionsAnswered}Q</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: s.score >= 75 ? C.green : s.score >= 60 ? C.blue : C.amber }}>{s.score}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🎤</div>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: C.text }}>Ready to prep?</p>
            <p style={{ margin: '0 0 12px', fontSize: 11, color: C.muted }}>Ava will generate personalised interview questions from your resume.</p>
          </div>
        )}

        {/* Ava nudge */}
        <div style={{ background: `${C.pink}0a`, border: `1px solid ${C.pink}20`, borderRadius: 9, padding: '8px 11px', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12 }}>🤖</span>
            <p style={{ margin: 0, fontSize: 10, color: C.text, lineHeight: 1.5 }}>
              {sessions.length === 0
                ? "Practice makes perfect. Let Ava prep you with role-specific questions."
                : avgScore && avgScore >= 75
                ? "You're performing well! Try harder questions or a new role."
                : "Keep practising — each session improves your confidence."}
            </p>
          </div>
        </div>

        <a href="/interview-prep" style={{ display: 'block', textAlign: 'center', padding: '9px', borderRadius: 9, background: `linear-gradient(135deg,${C.blue},${C.purple})`, color: '#fff', fontWeight: 800, fontSize: 12, textDecoration: 'none' }}>
          {sessions.length > 0 ? '🔄 Practice Again' : '🎤 Start Interview Prep'}
        </a>
      </div>
    </div>
  );
}