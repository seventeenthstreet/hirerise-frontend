'use client';
import { getAuthToken } from '@/lib/getToken';
/**
 * components/AutoApply.tsx
 *
 * Exports:
 *   AutoApplyButton        — "Auto Apply with Ava" button + flow modal
 *   MyApplicationsTracker  — dashboard tracker widget
 */

import React, { useState, useCallback } from 'react';
import { useApplications, useUpdateApplication, useDeleteApplication } from '@/hooks/useApplications';
import type { Application, ApplicationStatus } from '@/hooks/useApplications';
import type { ResumeContent } from '@/lib/supabase';
import type { JobInput } from '@/components/JobMatchCard';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:   '#060810', s0: '#0b0f1a', s1: '#10151f', s2: '#161c2c', s3: '#1c2438',
  border: 'rgba(255,255,255,0.07)', borderB: 'rgba(255,255,255,0.12)',
  text: '#dde4ef', muted: '#5a6882',
  green: '#18d98b', blue: '#3b71f8', amber: '#f5a623',
  red: '#f04d3c', purple: '#9b7cf7', pink: '#e96caa',
} as const;

// ─── Shared API helper ────────────────────────────────────────────────────────
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

// ─── Auto-apply result type ───────────────────────────────────────────────────
interface AutoApplyResult {
  applicationId:       string;
  tailoredResume:      ResumeContent;
  matchBefore:         number;
  matchAfter:          number;
  scoreIncrease:       number;
  improvementsSummary: string[];
  avaFollowUp:         string[];
}

// ─── Loading steps ────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'tailor',   label: 'Tailoring resume for this role…',  icon: '📝' },
  { id: 'keywords', label: 'Optimizing ATS keywords…',         icon: '🔑' },
  { id: 'submit',   label: 'Saving application record…',       icon: '📤' },
] as const;

type StepId = typeof STEPS[number]['id'];

function LoadingSteps({ current }: { current: StepId | 'done' }) {
  const stepIds = STEPS.map(s => s.id);
  const currentIdx = current === 'done' ? stepIds.length : stepIds.indexOf(current);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
      {STEPS.map((step, i) => {
        const done    = i < currentIdx || current === 'done';
        const active  = i === currentIdx;
        const pending = i > currentIdx;
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              background: done   ? `${C.green}20`  : active ? `${C.blue}20`  : C.s2,
              border:     done   ? `1px solid ${C.green}40` : active ? `1px solid ${C.blue}40` : `1px solid ${C.border}`,
              transition: 'all .3s',
            }}>
              {done ? '✓' : active ? (
                <div style={{ width: 12, height: 12, borderRadius: '50%',
                  border: `2px solid ${C.blue}40`, borderTopColor: C.blue,
                  animation: 'spin .65s linear infinite' }} />
              ) : step.icon}
            </div>
            <span style={{
              fontSize: 12, fontWeight: active ? 700 : 500,
              color: done ? C.green : active ? C.text : C.muted,
              transition: 'color .3s',
            }}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────
function SuccessScreen({
  result, jobTitle, onClose, onApplyMore,
}: {
  result:     AutoApplyResult;
  jobTitle:   string;
  onClose:    () => void;
  onApplyMore: () => void;
}) {
  const scoreCol = result.matchAfter >= 75 ? C.green : result.matchAfter >= 50 ? C.blue : C.amber;

  return (
    <div style={{ animation: 'rise .3s ease-out' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: C.text, marginBottom: 4 }}>
          Application Submitted!
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>
          Ava tailored your resume for <strong style={{ color: C.text }}>{jobTitle}</strong>
        </div>
      </div>

      {/* Score improvement */}
      <div style={{
        background: C.s1, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '.12em', color: C.muted, marginBottom: 10 }}>
          Match Score
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.muted, lineHeight: 1 }}>
              {result.matchBefore}
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>Before</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.muted }}>→</div>
            {result.scoreIncrease > 0 && (
              <div style={{
                fontSize: 11, fontWeight: 800, color: C.green,
                background: `${C.green}15`, borderRadius: 20,
                padding: '2px 8px', marginTop: 2, display: 'inline-block',
              }}>
                +{result.scoreIncrease} pts
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: scoreCol, lineHeight: 1 }}>
              {result.matchAfter}
            </div>
            <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>After</div>
          </div>
        </div>
      </div>

      {/* What Ava changed */}
      {result.improvementsSummary.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '.12em', color: C.muted, marginBottom: 7 }}>
            What Ava improved
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {result.improvementsSummary.map((s, i) => (
              <li key={i} style={{ fontSize: 11, color: C.text, lineHeight: 1.5 }}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Ava follow-up */}
      {result.avaFollowUp.length > 0 && (
        <div style={{
          background: `${C.pink}0a`, border: `1px solid ${C.pink}25`,
          borderRadius: 10, padding: '12px 14px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
            <span style={{ fontSize: 14 }}>🤖</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: C.pink }}>Ava's advice</span>
          </div>
          {result.avaFollowUp.slice(0, 2).map((tip, i) => (
            <p key={i} style={{ margin: i === 0 ? '0 0 6px' : '0', fontSize: 11, color: C.text, lineHeight: 1.5 }}>
              {tip}
            </p>
          ))}
        </div>
      )}

      {/* CTAs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onApplyMore} style={{
          flex: 1, padding: '10px', borderRadius: 10, border: 'none',
          background: C.green, color: '#fff', fontWeight: 800, fontSize: 12,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          🚀 Apply to More Jobs
        </button>
        <button onClick={onClose} style={{
          padding: '10px 16px', borderRadius: 10,
          border: `1px solid ${C.border}`, background: 'none',
          color: C.muted, fontWeight: 700, fontSize: 12,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16,
        animation: 'fadeIn .15s ease-out',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: C.s0, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '20px 22px', width: '100%', maxWidth: 400,
        maxHeight: '90vh', overflowY: 'auto', animation: 'pop .2s ease-out',
      }}>
        {children}
      </div>
      <style>{`
        @keyframes spin     { to { transform: rotate(360deg) } }
        @keyframes rise     { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        @keyframes pop      { from { opacity:0; transform:scale(.95) } to { opacity:1; transform:none } }
        @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
      `}</style>
    </div>
  );
}

// ─── AutoApplyButton ─────────────────────────────────────────────────────────
export interface AutoApplyButtonProps {
  job:          JobInput & { companyName?: string; jobUrl?: string };
  resumeData:   ResumeContent | null | undefined;
  resumeId?:    string | null;
  /** Size variant */
  size?:        'sm' | 'md';
  /** Called after successful apply with the result */
  onSuccess?:   (result: AutoApplyResult) => void;
}

export function AutoApplyButton({
  job, resumeData, resumeId, size = 'md', onSuccess,
}: AutoApplyButtonProps) {
  const [open,        setOpen]        = useState(false);
  const [step,        setStep]        = useState<StepId | 'done' | null>(null);
  const [result,      setResult]      = useState<AutoApplyResult | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const pad  = size === 'sm' ? '7px 14px' : '10px 18px';
  const fs   = size === 'sm' ? 11 : 12;

  const handleApply = useCallback(async () => {
    if (!resumeData) {
      setError('Upload your CV first to enable Auto Apply.');
      setOpen(true);
      return;
    }
    setOpen(true);
    setError(null);
    setResult(null);
    setStep('tailor');

    try {
      // Simulate step transitions for UX (actual work happens inside the API)
      const stepTimer = setTimeout(() => setStep('keywords'), 1800);
      const stepTimer2 = setTimeout(() => setStep('submit'), 3600);

      const res = await authPost<AutoApplyResult>('/api/jobs/auto-apply', {
        resumeData,
        job: {
          title:           job.title,
          description:     job.description,
          requiredSkills:  job.requiredSkills,
          experienceLevel: job.experienceLevel,
        },
        companyName: job.companyName,
        jobUrl:      job.jobUrl,
        resumeId,
      });

      clearTimeout(stepTimer);
      clearTimeout(stepTimer2);
      setStep('done');

      // Brief pause on "done" before showing success screen
      await new Promise(r => setTimeout(r, 400));
      setResult(res);
      onSuccess?.(res);

    } catch (e: any) {
      setError(e.message ?? 'Auto-apply failed. Please try again.');
      setStep(null);
    }
  }, [resumeData, job, resumeId, onSuccess]);

  return (
    <>
      <button
        onClick={handleApply}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: pad, borderRadius: 9, border: 'none',
          background: `linear-gradient(135deg, ${C.pink} 0%, ${C.purple} 100%)`,
          color: '#fff', fontWeight: 800, fontSize: fs,
          cursor: resumeData ? 'pointer' : 'not-allowed',
          opacity: resumeData ? 1 : 0.5,
          fontFamily: 'inherit', transition: 'opacity .15s, transform .1s',
          boxShadow: `0 2px 12px ${C.pink}30`,
        }}
        onMouseEnter={e => { if (resumeData) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = resumeData ? '1' : '0.5'; }}
      >
        🤖 Auto Apply with Ava
      </button>

      {open && (
        <Modal onClose={() => { if (result || error) { setOpen(false); setStep(null); } }}>
          {/* Modal header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Auto Apply with Ava</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>{job.title}</div>
              </div>
            </div>
            {(result || error) && (
              <button onClick={() => { setOpen(false); setStep(null); setResult(null); setError(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: C.muted, fontSize: 16, fontFamily: 'inherit' }}>
                ✕
              </button>
            )}
          </div>

          {/* Error state */}
          {error && (
            <div style={{
              background: `${C.red}0a`, border: `1px solid ${C.red}25`,
              borderRadius: 10, padding: '12px 14px',
            }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: C.red }}>{error}</p>
              <button onClick={() => { setError(null); handleApply(); }}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: C.blue, color: '#fff', fontWeight: 700,
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Retry
              </button>
            </div>
          )}

          {/* Loading steps */}
          {step && !result && !error && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                Ava is tailoring your resume for this specific role…
              </div>
              <LoadingSteps current={step} />
            </div>
          )}

          {/* Success */}
          {result && (
            <SuccessScreen
              result={result}
              jobTitle={job.title}
              onClose={() => { setOpen(false); setStep(null); setResult(null); }}
              onApplyMore={() => { setOpen(false); setStep(null); setResult(null); window.location.href = '/job-matches'; }}
            />
          )}
        </Modal>
      )}
    </>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<ApplicationStatus, { label: string; bg: string; color: string }> = {
  applied:               { label: 'Applied',            bg: `${C.blue}18`,   color: C.blue   },
  no_response:           { label: 'No Response',         bg: `${C.muted}18`,  color: C.muted  },
  interview_scheduled:   { label: 'Interview Scheduled', bg: `${C.purple}18`, color: C.purple },
  interview_completed:   { label: 'Interview Done',      bg: `${C.amber}18`,  color: C.amber  },
  offer_received:        { label: 'Offer Received',      bg: `${C.green}18`,  color: C.green  },
  offer_accepted:        { label: 'Accepted ✓',          bg: `${C.green}22`,  color: C.green  },
  offer_rejected:        { label: 'Offer Declined',      bg: `${C.muted}18`,  color: C.muted  },
  rejected:              { label: 'Rejected',            bg: `${C.red}12`,    color: C.red    },
  withdrawn:             { label: 'Withdrawn',           bg: `${C.muted}12`,  color: C.muted  },
};

function StatusBadge({ status, onChange }: { status: ApplicationStatus; onChange?: (s: ApplicationStatus) => void }) {
  const st = STATUS_STYLES[status] ?? STATUS_STYLES.applied;
  if (!onChange) {
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
        background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
        {st.label}
      </span>
    );
  }
  return (
    <select
      value={status}
      onChange={e => onChange(e.target.value as ApplicationStatus)}
      style={{
        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
        background: st.bg, color: st.color, border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', appearance: 'none',
        paddingRight: 16,
      }}
    >
      {Object.entries(STATUS_STYLES).map(([k, v]) => (
        <option key={k} value={k} style={{ background: C.s0, color: C.text }}>{v.label}</option>
      ))}
    </select>
  );
}

// ─── Ava follow-up suggestion banner ─────────────────────────────────────────
function AvaFollowUpBanner({ app }: { app: Application }) {
  const daysSince = Math.floor((Date.now() - new Date(app.appliedDate).getTime()) / 86_400_000);
  if (app.status !== 'applied' || daysSince < 5) return null;
  return (
    <div style={{
      fontSize: 10, color: C.pink, background: `${C.pink}0a`,
      border: `1px solid ${C.pink}20`, borderRadius: 7,
      padding: '5px 8px', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5,
    }}>
      <span>🤖</span>
      {daysSince >= 14
        ? "No response in 2 weeks — consider following up or marking as No Response."
        : `Applied ${daysSince} days ago — consider a brief follow-up email.`}
    </div>
  );
}

// ─── MyApplicationsTracker ───────────────────────────────────────────────────
export function MyApplicationsTracker() {
  const { data, isLoading, isError } = useApplications(20);
  const { mutate: updateApp }  = useUpdateApplication();
  const { mutate: deleteApp }  = useDeleteApplication();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.14em',
          color: C.muted, marginBottom: 12 }}>My Applications</div>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 52, background: C.s1, borderRadius: 10, marginBottom: 8,
            animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: 11, color: C.red }}>Could not load applications.</div>
      </div>
    );
  }

  const apps = data?.applications ?? [];

  // Summary counts
  const counts = apps.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ background: C.s0, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '.14em', color: C.muted }}>
            My Applications
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{apps.length} total</span>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {[
            { status: 'applied',             count: counts['applied']             },
            { status: 'interview_scheduled', count: counts['interview_scheduled'] },
            { status: 'offer_received',      count: counts['offer_received']      },
            { status: 'rejected',            count: counts['rejected']            },
          ].filter(s => s.count).map(s => {
            const st = STATUS_STYLES[s.status as ApplicationStatus];
            return (
              <span key={s.status} style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px',
                borderRadius: 20, background: st.bg, color: st.color }}>
                {st.label}: {s.count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {apps.length === 0 && (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 6px' }}>No applications yet</p>
          <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
            Use "Auto Apply with Ava" on job cards to track applications here.
          </p>
        </div>
      )}

      {/* Application rows */}
      {apps.map(app => (
        <div key={app.id} style={{
          borderBottom: `1px solid ${C.border}`,
          padding: '12px 18px',
          transition: 'background .15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = C.s1)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>

            {/* Company initial badge */}
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: `${C.blue}18`, border: `1px solid ${C.blue}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 900, color: C.blue,
            }}>
              {app.companyName.charAt(0).toUpperCase()}
            </div>

            {/* Main info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {app.jobTitle}
                  </p>
                  <p style={{ margin: '1px 0 0', fontSize: 10, color: C.muted }}>{app.companyName}</p>
                </div>
                <StatusBadge
                  status={app.status}
                  onChange={s => updateApp({ id: app.id, updates: { status: s } })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
                <span style={{ fontSize: 10, color: C.muted }}>
                  {new Date(app.appliedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {app.source && (
                  <span style={{ fontSize: 10, color: C.muted, borderLeft: `1px solid ${C.border}`, paddingLeft: 8 }}>
                    via {app.source}
                  </span>
                )}
                <button
                  onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 10, color: C.muted, fontFamily: 'inherit', padding: '0 4px' }}>
                  {expandedId === app.id ? 'Less ▲' : 'More ▼'}
                </button>
              </div>

              {/* Ava nudge */}
              <AvaFollowUpBanner app={app} />

              {/* Expanded detail */}
              {expandedId === app.id && (
                <div style={{ marginTop: 10, animation: 'rise .2s ease-out' }}>
                  {app.notes && (
                    <p style={{ margin: '0 0 8px', fontSize: 11, color: C.text,
                      background: C.s2, borderRadius: 7, padding: '7px 10px' }}>
                      {app.notes}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a href={`/resume-builder?source=application&role=${encodeURIComponent(app.jobTitle)}`}
                      style={{ fontSize: 10, color: C.blue, textDecoration: 'none', fontWeight: 600 }}>
                      Edit resume for this role →
                    </a>
                    <span style={{ color: C.border }}>·</span>
                    <button
                      onClick={() => { if (confirm('Remove this application?')) deleteApp(app.id); }}
                      style={{ fontSize: 10, color: C.red, background: 'none', border: 'none',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: 0 }}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Footer link */}
      {apps.length > 0 && (
        <div style={{ padding: '10px 18px', textAlign: 'center' }}>
          <a href="/job-matches" style={{ fontSize: 11, color: C.blue, textDecoration: 'none', fontWeight: 600 }}>
            Find more jobs to apply →
          </a>
        </div>
      )}
    </div>
  );
}