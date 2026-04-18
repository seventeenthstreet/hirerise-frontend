/**
 * pages/ActivitiesPage.js — Step 3
 * Collects extracurricular activities.
 */

import { useState }      from 'react';
import { GLOBAL_STYLES } from './EducationOnboarding';

const ACTIVITY_LEVELS = [
  { value: 'beginner',      label: 'Beginner'       },
  { value: 'intermediate',  label: 'Intermediate'   },
  { value: 'advanced',      label: 'Advanced'       },
  { value: 'national',      label: 'National Level'  },
  { value: 'international', label: 'International Level' },
];

export default function ActivitiesPage({ education }) {
  const { submitActivities, goBack, loading, error, clearError } = education;

  const [rows, setRows] = useState([{ activity_name: '', activity_level: '' }]);

  const update = (i, field, value) => {
    clearError();
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  };

  const addRow    = () => setRows(r => [...r, { activity_name: '', activity_level: '' }]);
  const removeRow = (i) => { if (rows.length > 1) setRows(r => r.filter((_, idx) => idx !== i)); };

  const isValid   = rows.every(r => r.activity_name.trim() && r.activity_level);

  const handleSubmit = async () => {
    if (!isValid) return;
    await submitActivities(
      rows.map(r => ({
        activity_name:  r.activity_name.trim(),
        activity_level: r.activity_level,
      }))
    );
  };

  return (
    <>
      <div className="edu-card">
        <h2 style={heading}>Extracurricular Activities</h2>
        <p style={subtext}>Add sports, arts, clubs, or competitions. Anything beyond academics.</p>

        {error && <div className="edu-error">{error}</div>}

        {/* Column headers */}
        <div className="edu-row-grid-3" style={{ gridTemplateColumns: '2fr 1.6fr 32px', marginBottom: 8 }}>
          <span className="edu-col-header">Activity</span>
          <span className="edu-col-header">Level</span>
          <span />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {rows.map((row, i) => (
            <div key={i} className="edu-row-grid-3" style={{ gridTemplateColumns: '2fr 1.6fr 32px' }}>
              <input
                className="edu-input"
                placeholder="e.g. Chess, Basketball, Robotics"
                value={row.activity_name}
                onChange={e => update(i, 'activity_name', e.target.value)}
              />
              <select
                className="edu-input"
                value={row.activity_level}
                onChange={e => update(i, 'activity_level', e.target.value)}
              >
                <option value="">Level…</option>
                {ACTIVITY_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                style={{ background: 'none', border: 'none', color: '#4b5563', cursor: rows.length === 1 ? 'not-allowed' : 'pointer', fontSize: 15, padding: 0 }}
              >✕</button>
            </div>
          ))}
        </div>

        <button className="edu-btn edu-btn-secondary" style={{ width: '100%', marginBottom: 24 }} onClick={addRow}>
          + Add Activity
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="edu-btn edu-btn-secondary" onClick={goBack}>← Back</button>
          <button
            className="edu-btn edu-btn-primary"
            style={{ flex: 1 }}
            disabled={!isValid || loading}
            onClick={handleSubmit}
          >
            {loading ? 'Saving…' : 'Save & Continue →'}
          </button>
        </div>
      </div>
      <style>{GLOBAL_STYLES}</style>
    </>
  );
}

const heading = { fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#f9fafb', marginBottom: 6, marginTop: 0 };
const subtext  = { color: '#6b7280', fontSize: 14, marginBottom: 24, marginTop: 0 };
