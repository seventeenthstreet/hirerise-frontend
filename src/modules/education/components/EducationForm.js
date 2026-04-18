/**
 * components/EducationForm.js
 *
 * ProfileForm — Step 1 of Education Onboarding.
 * Collects: name, email, education_level.
 */

import { useState } from 'react';
import { GLOBAL_STYLES } from '../pages/EducationOnboarding';

const EDUCATION_LEVELS = [
  { value: 'class_8',       label: 'Class 8'       },
  { value: 'class_9',       label: 'Class 9'       },
  { value: 'class_10',      label: 'Class 10'      },
  { value: 'class_11',      label: 'Class 11'      },
  { value: 'class_12',      label: 'Class 12'      },
  { value: 'undergraduate', label: 'Undergraduate'  },
  { value: 'postgraduate',  label: 'Postgraduate'   },
];

export function ProfileForm({ education }) {
  const { submitProfile, loading, error, clearError } = education;

  const [form, setForm] = useState({ name: '', email: '', education_level: '' });

  const set = (field) => (e) => {
    clearError();
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const isValid = form.name.trim() && form.email.trim() && form.education_level;

  const handleSubmit = async () => {
    if (!isValid) return;
    await submitProfile({
      name:            form.name.trim(),
      email:           form.email.trim(),
      education_level: form.education_level,
    });
  };

  return (
    <>
      <div className="edu-card">
        <h2 style={heading}>Tell us about yourself</h2>
        <p style={subtext}>We'll personalise your stream recommendation based on this.</p>

        {error && <div className="edu-error">{error}</div>}

        <div style={stack}>
          <div>
            <label className="edu-label">Full Name</label>
            <input className="edu-input" placeholder="Arjun Sharma" value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className="edu-label">Email Address</label>
            <input className="edu-input" type="email" placeholder="arjun@example.com" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="edu-label">Current Education Level</label>
            <select className="edu-input" value={form.education_level} onChange={set('education_level')}>
              <option value="">Select level…</option>
              {EDUCATION_LEVELS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          <button
            className="edu-btn edu-btn-primary"
            style={{ marginTop: 8 }}
            disabled={!isValid || loading}
            onClick={handleSubmit}
          >
            {loading ? 'Saving…' : 'Continue →'}
          </button>
        </div>
      </div>
      <style>{GLOBAL_STYLES}</style>
    </>
  );
}

// ─── Shared micro-styles ──────────────────────────────────────────────────────
const heading = { fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#f9fafb', marginBottom: 6, marginTop: 0 };
const subtext  = { color: '#6b7280', fontSize: 14, marginBottom: 28, marginTop: 0 };
const stack    = { display: 'flex', flexDirection: 'column', gap: 20 };
