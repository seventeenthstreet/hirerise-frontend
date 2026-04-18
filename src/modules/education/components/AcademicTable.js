/**
 * components/AcademicTable.js
 *
 * Reusable editable table for entering academic subject marks.
 * Used by AcademicMarksPage.
 *
 * Props:
 *   rows    — [{ subject, class_level, marks }]
 *   onChange(rows) — called whenever any row changes
 */

import { GLOBAL_STYLES } from '../pages/EducationOnboarding';

const SUBJECTS = [
  'Mathematics', 'English', 'Second Language',
  'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'Accountancy', 'Business Studies', 'Economics', 'Statistics',
  'History', 'Geography', 'Political Science', 'Sociology', 'Psychology', 'Fine Arts',
];

const CLASS_LEVELS = [
  { value: 'class_8',  label: 'Class 8'  },
  { value: 'class_9',  label: 'Class 9'  },
  { value: 'class_10', label: 'Class 10' },
  { value: 'class_11', label: 'Class 11' },
  { value: 'class_12', label: 'Class 12' },
];

export function AcademicTable({ rows, onChange }) {
  const update = (i, field, value) => {
    const next = rows.map((row, idx) => idx === i ? { ...row, [field]: value } : row);
    onChange(next);
  };

  const addRow = () => onChange([...rows, { subject: '', class_level: '', marks: '' }]);

  const removeRow = (i) => {
    if (rows.length === 1) return;
    onChange(rows.filter((_, idx) => idx !== i));
  };

  return (
    <>
      {/* Column headers */}
      <div className="edu-row-grid-3" style={{ gridTemplateColumns: '2fr 1.4fr 1fr 32px', marginBottom: 8 }}>
        <span className="edu-col-header">Subject</span>
        <span className="edu-col-header">Class</span>
        <span className="edu-col-header">Marks (%)</span>
        <span />
      </div>

      {/* Data rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {rows.map((row, i) => (
          <div key={i} className="edu-row-grid-3" style={{ gridTemplateColumns: '2fr 1.4fr 1fr 32px' }}>
            <select className="edu-input" value={row.subject} onChange={e => update(i, 'subject', e.target.value)}>
              <option value="">Subject…</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select className="edu-input" value={row.class_level} onChange={e => update(i, 'class_level', e.target.value)}>
              <option value="">Class…</option>
              {CLASS_LEVELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>

            <input
              className="edu-input"
              type="number" min="0" max="100" placeholder="85"
              value={row.marks}
              onChange={e => update(i, 'marks', e.target.value)}
            />

            <button
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
              style={{ background: 'none', border: 'none', color: '#4b5563', cursor: rows.length === 1 ? 'not-allowed' : 'pointer', fontSize: 15, padding: 0 }}
            >✕</button>
          </div>
        ))}
      </div>

      <button className="edu-btn edu-btn-secondary" style={{ width: '100%' }} onClick={addRow}>
        + Add Subject
      </button>

      <style>{GLOBAL_STYLES}</style>
    </>
  );
}
