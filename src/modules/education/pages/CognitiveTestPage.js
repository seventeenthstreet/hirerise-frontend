/**
 * pages/CognitiveTestPage.js — Step 4 (final)
 * Self-assessment sliders for the five cognitive dimensions.
 */

import { useState }      from 'react';
import { GLOBAL_STYLES } from './EducationOnboarding';

const DIMENSIONS = [
  { key: 'analytical_score',    label: 'Analytical Thinking',  desc: 'How well do you break complex problems into parts?' },
  { key: 'logical_score',       label: 'Logical Reasoning',    desc: 'How well do you spot patterns and draw conclusions?' },
  { key: 'memory_score',        label: 'Memory & Retention',   desc: 'How well do you remember and recall information?' },
  { key: 'communication_score', label: 'Communication',        desc: 'How clearly do you express ideas in writing and speech?' },
  { key: 'creativity_score',    label: 'Creativity',           desc: 'How easily do you generate original ideas?' },
];

const SCORE_LABEL = (v) => {
  if (v < 25) return 'Needs Work';
  if (v < 50) return 'Average';
  if (v < 75) return 'Good';
  if (v < 90) return 'Strong';
  return 'Excellent';
};

const SCORE_COLOR = (v) => {
  if (v < 25) return '#ef4444';
  if (v < 50) return '#f97316';
  if (v < 75) return '#f59e0b';
  if (v < 90) return '#22c55e';
  return '#06b6d4';
};

export default function CognitiveTestPage({ education }) {
  const { submitCognitive, goBack, loading, error, clearError } = education;

  const [scores, setScores] = useState({
    analytical_score: 50,
    logical_score: 50,
    memory_score: 50,
    communication_score: 50,
    creativity_score: 50,
  });

  const setScore = (key, val) => {
    clearError();
    setScores(s => ({ ...s, [key]: Number(val) }));
  };

  const handleSubmit = async () => {
    await submitCognitive({ ...scores, raw_answers: {} });
  };

  return (
    <>
      <div className="edu-card">
        <h2 style={heading}>Cognitive Self-Assessment</h2>
        <p style={subtext}>
          Rate yourself honestly on each dimension.
          Move the slider — 0 is very low, 100 is excellent.
        </p>

        {error && <div className="edu-error">{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginBottom: 32 }}>
          {DIMENSIONS.map(dim => (
            <div key={dim.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: '#f3f4f6', fontSize: 14 }}>{dim.label}</p>
                  <p style={{ margin: '2px 0 0', color: '#4b5563', fontSize: 12 }}>{dim.desc}</p>
                </div>
                <div style={{ textAlign: 'right', minWidth: 72 }}>
                  <span style={{ fontWeight: 700, color: SCORE_COLOR(scores[dim.key]), fontSize: 20 }}>
                    {scores[dim.key]}
                  </span>
                  <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>{SCORE_LABEL(scores[dim.key])}</p>
                </div>
              </div>

              <input
                type="range"
                min={0} max={100} step={5}
                value={scores[dim.key]}
                onChange={e => setScore(dim.key, e.target.value)}
                style={{ width: '100%', accentColor: SCORE_COLOR(scores[dim.key]), cursor: 'pointer' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ fontSize: 10, color: '#374151' }}>0 — Very Low</span>
                <span style={{ fontSize: 10, color: '#374151' }}>100 — Excellent</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="edu-btn edu-btn-secondary" onClick={goBack}>← Back</button>
          <button
            className="edu-btn edu-btn-primary"
            style={{ flex: 1 }}
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? 'Submitting…' : 'Complete Onboarding 🎓'}
          </button>
        </div>
      </div>
      <style>{GLOBAL_STYLES}</style>
    </>
  );
}

const heading = { fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#f9fafb', marginBottom: 6, marginTop: 0 };
const subtext  = { color: '#6b7280', fontSize: 14, marginBottom: 28, marginTop: 0, lineHeight: 1.6 };
