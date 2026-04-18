/**
 * pages/EducationOnboarding.js
 * Route: /education/onboarding
 *
 * Main shell for the Education Intelligence onboarding flow.
 * Renders the correct step page based on currentStep.
 * Resumes from the user's last saved step on return visits.
 */

import { useEffect }        from 'react';
import Head                 from 'next/head';
import { useAuth }          from '@/hooks/useAuth';
import { useEducation }     from '../hooks/useEducation';
import AcademicMarksPage    from './AcademicMarksPage';
import ActivitiesPage       from './ActivitiesPage';
import CognitiveTestPage    from './CognitiveTestPage';
import { ProfileForm }      from '../components/EducationForm';

const STEP_LABELS = {
  profile:   'Your Profile',
  academics: 'Academic Marks',
  activities:'Activities',
  cognitive: 'Cognitive Test',
  complete:  'Complete',
};

export default function EducationOnboarding() {
  const { user }   = useAuth();
  const education  = useEducation();
  const { currentStep, stepIndex, progressPct, loadProfile } = education;

  // Resume from last saved step
  useEffect(() => {
    if (user?.uid) {
      loadProfile(user.uid).catch(() => {
        // 404 = new user → stays on 'profile' step, handled in hook
      });
    }
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Head>
        <title>Education Onboarding — HireRise</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div style={S.root}>
        {/* ── Progress header ─────────────────────────────────────────────── */}
        <header style={S.header}>
          <div style={S.headerRow}>
            <span style={S.brand}>🎓 Education Intelligence</span>
            <span style={S.stepLabel}>{STEP_LABELS[currentStep] ?? currentStep}</span>
          </div>

          {/* Progress bar */}
          <div style={S.progressTrack}>
            <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
          </div>

          {/* Step dots */}
          <div style={S.dots}>
            {['profile', 'academics', 'activities', 'cognitive'].map((step, i) => (
              <div key={step} style={S.dotGroup}>
                <div style={{
                  ...S.dot,
                  ...(currentStep === step ? S.dotActive : {}),
                  ...(stepIndex > i         ? S.dotDone  : {}),
                }}>
                  {stepIndex > i ? '✓' : i + 1}
                </div>
                <span style={S.dotLabel}>{STEP_LABELS[step]}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── Step content ────────────────────────────────────────────────── */}
        <main style={S.main}>
          {currentStep === 'profile'    && <ProfileForm    education={education} />}
          {currentStep === 'academics'  && <AcademicMarksPage education={education} />}
          {currentStep === 'activities' && <ActivitiesPage    education={education} />}
          {currentStep === 'cognitive'  && <CognitiveTestPage education={education} />}
          {currentStep === 'complete'   && <CompleteCard />}
        </main>
      </div>

      <style>{GLOBAL_STYLES}</style>
    </>
  );
}

function CompleteCard() {
  return (
    <div className="edu-card" style={{ textAlign: 'center', padding: '60px 32px' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
      <h2 style={{ fontFamily: 'Syne, sans-serif', color: '#f9fafb', fontSize: 26, marginBottom: 10 }}>
        Onboarding Complete!
      </h2>
      <p style={{ color: '#6b7280', maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
        Your data has been saved. Stream analysis will be available once the AI engines are activated.
      </p>
    </div>
  );
}

// ─── Shared inline styles ─────────────────────────────────────────────────────

const S = {
  root:          { minHeight: '100vh', background: '#080c14', fontFamily: "'DM Sans', sans-serif", color: '#f9fafb' },
  header:        { background: '#0d1117', borderBottom: '1px solid #1f2937', padding: '16px 24px 0', position: 'sticky', top: 0, zIndex: 50 },
  headerRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 820, margin: '0 auto', paddingBottom: 12 },
  brand:         { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 },
  stepLabel:     { fontSize: 13, color: '#6b7280' },
  progressTrack: { height: 3, background: '#1f2937' },
  progressFill:  { height: '100%', background: 'linear-gradient(90deg, #06b6d4, #6366f1)', transition: 'width 0.4s ease' },
  dots:          { display: 'flex', justifyContent: 'center', gap: 40, padding: '12px 0', maxWidth: 820, margin: '0 auto' },
  dotGroup:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  dot:           { width: 28, height: 28, borderRadius: '50%', border: '2px solid #374151', background: 'transparent', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, transition: 'all 0.2s' },
  dotActive:     { borderColor: '#06b6d4', color: '#06b6d4', background: 'rgba(6,182,212,0.1)' },
  dotDone:       { borderColor: '#22c55e', background: '#22c55e', color: '#000' },
  dotLabel:      { fontSize: 10, color: '#4b5563', whiteSpace: 'nowrap' },
  main:          { maxWidth: 820, margin: '0 auto', padding: '36px 24px' },
};

// ─── Global CSS shared by all step pages ─────────────────────────────────────
// Import this component in _app.js OR inject via <style> in each step page.

export const GLOBAL_STYLES = `
  .edu-card {
    background: #111827;
    border: 1.5px solid #1f2937;
    border-radius: 18px;
    padding: 32px;
  }
  .edu-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px;
  }
  .edu-input {
    width: 100%;
    background: #0d1117;
    border: 1.5px solid #1f2937;
    border-radius: 10px;
    padding: 11px 14px;
    color: #f9fafb;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .edu-input:focus { border-color: #06b6d4; }
  .edu-btn {
    padding: 13px 28px;
    border-radius: 11px;
    border: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .edu-btn-primary {
    background: linear-gradient(135deg, #06b6d4, #6366f1);
    color: white;
  }
  .edu-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .edu-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
  .edu-btn-secondary {
    background: transparent;
    color: #6b7280;
    border: 1.5px solid #1f2937;
  }
  .edu-btn-secondary:hover { color: #9ca3af; border-color: #374151; }
  .edu-error {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 10px;
    padding: 11px 16px;
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 18px;
  }
  .edu-row-grid-3 { display: grid; gap: 8px; align-items: center; }
  .edu-col-header { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  @media (max-width: 600px) {
    .edu-card { padding: 20px 16px; }
  }
`;
