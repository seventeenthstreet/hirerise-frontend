/**
 * pages/AcademicMarksPage.js — Step 2
 * Collects subject marks via the AcademicTable component.
 */

import { useState }     from 'react';
import { AcademicTable } from '../components/AcademicTable';
import { GLOBAL_STYLES } from './EducationOnboarding';

export default function AcademicMarksPage({ education }) {
  const { submitAcademics, goBack, loading, error, clearError } = education;

  const [rows, setRows] = useState([
    { subject: '', class_level: '', marks: '' },
  ]);

  const isValid = rows.every(r => r.subject && r.class_level && r.marks !== '');

  const handleSubmit = async () => {
    if (!isValid) return;
    clearError();
    await submitAcademics(
      rows.map(r => ({
        subject:     r.subject,
        class_level: r.class_level,
        marks:       parseFloat(r.marks),
      }))
    );
  };

  return (
    <>
      <div className="edu-card">
        <h2 style={heading}>Academic Marks</h2>
        <p style={subtext}>Enter your subject marks. Add one row per subject.</p>

        {error && <div className="edu-error">{error}</div>}

        <AcademicTable rows={rows} onChange={setRows} />

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
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
