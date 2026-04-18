'use client';

/**
 * src/modules/school-dashboard/pages/StudentsPage.tsx
 *
 * Student management page for school admins and counselors.
 *
 * Features:
 *   - Full student list with assessment status
 *   - CSV bulk import modal
 *   - Per-student "Run Assessment" trigger
 *   - "View Report" navigation
 */

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StudentTable from '../components/StudentTable';
import { schoolApi, type SchoolStudent, type ImportResult } from '../services/school.api';

interface StudentsPageProps {
  schoolId:        string;
  schoolName?:     string;
  userRole?:       string;
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

interface ImportModalProps {
  schoolId:  string;
  onClose:   () => void;
  onSuccess: (result: ImportResult) => void;
}

function ImportModal({ schoolId, onClose, onSuccess }: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file,      setFile]      = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const res = await schoolApi.importStudentsCSV(schoolId, file);
      setResult(res);
      if (res.imported > 0) onSuccess(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={M.backdrop} onClick={onClose}>
      <div style={M.modal} onClick={e => e.stopPropagation()}>
        <div style={M.header}>
          <div style={M.title}>📥 Import Students via CSV</div>
          <button style={M.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={M.body}>
          <div style={M.hint}>
            <strong>Required columns:</strong> name, email<br />
            <strong>Optional columns:</strong> class, section<br />
            Max 1,000 rows per import.
          </div>

          {/* File picker */}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] || null)}
          />
          <div style={M.filePicker} onClick={() => fileRef.current?.click()}>
            {file ? (
              <div style={M.fileName}>📄 {file.name}</div>
            ) : (
              <div style={M.filePlaceholder}>Click to choose a CSV file</div>
            )}
          </div>

          {/* Sample CSV */}
          <div style={M.sample}>
            <div style={M.sampleLabel}>Sample CSV format:</div>
            <pre style={M.sampleCode}>{`name,email,class,section\nArjun Sharma,arjun@school.edu,11,A\nPriya Patel,priya@school.edu,12,B`}</pre>
          </div>

          {error && <div style={M.error}>{error}</div>}

          {result && (
            <div style={M.results}>
              <div style={M.resultRow}><span style={M.resultGreen}>✓ Imported</span> {result.imported} students</div>
              {result.skipped > 0 && <div style={M.resultRow}><span style={M.resultYellow}>⚠ Skipped</span> {result.skipped} rows</div>}
              {result.errors.length > 0 && (
                <div style={M.errList}>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <div key={i} style={M.errRow}>Row {e.row}: {e.email} — {e.reason}</div>
                  ))}
                  {result.errors.length > 5 && <div style={M.errRow}>…and {result.errors.length - 5} more</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={M.footer}>
          <button style={M.cancelBtn} onClick={onClose}>Close</button>
          <button
            style={{ ...M.importBtn, opacity: (!file || importing) ? 0.5 : 1 }}
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? 'Importing…' : 'Import Students'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentsPage({ schoolId, schoolName, userRole }: StudentsPageProps) {
  const router = useRouter();

  const [students,     setStudents]     = useState<SchoolStudent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showImport,   setShowImport]   = useState(false);
  const [assessingIds, setAssessingIds] = useState<Set<string>>(new Set());
  const [toast,        setToast]        = useState<string | null>(null);

  const isAdmin = userRole === 'school_admin';

  async function loadStudents() {
    try {
      const res = await schoolApi.listStudents(schoolId);
      setStudents(res.students);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (schoolId) loadStudents(); }, [schoolId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleRunAssessment(studentId: string) {
    setAssessingIds(prev => new Set(prev).add(studentId));
    try {
      await schoolApi.runAssessment(schoolId, studentId);
      showToast('✅ Assessment complete!');
      await loadStudents(); // refresh status
    } catch (err: unknown) {
      showToast(`❌ ${err instanceof Error ? err.message : 'Assessment failed.'}`);
    } finally {
      setAssessingIds(prev => { const next = new Set(prev); next.delete(studentId); return next; });
    }
  }

  function handleViewReport(studentId: string) {
    router.push(`/school/student-report/${studentId}?schoolId=${schoolId}`);
  }

  function handleImportSuccess(result: ImportResult) {
    showToast(`✅ Imported ${result.imported} students successfully.`);
    setShowImport(false);
    loadStudents();
  }

  return (
    <>
      <style>{CSS}</style>

      <div style={S.root}>
        {/* Header */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.left}>
              <button style={S.backBtn} onClick={() => router.push(`/school/dashboard?schoolId=${schoolId}`)}>← Dashboard</button>
              <span style={S.sep}>·</span>
              <span style={S.brand}>🎓 {schoolName || 'School'}</span>
              <span style={S.sep}>·</span>
              <span style={S.pageTitle}>Students</span>
            </div>
            {isAdmin && (
              <button style={S.importBtn} onClick={() => setShowImport(true)}>
                📥 Import CSV
              </button>
            )}
          </div>
        </header>

        {/* Summary strip */}
        <div style={S.strip}>
          <div style={S.stripInner}>
            <div style={S.stripStat}>
              <span style={S.stripNum}>{students.length}</span>
              <span style={S.stripLabel}>Total Students</span>
            </div>
            <div style={S.stripStat}>
              <span style={{ ...S.stripNum, color: '#6ee7b7' }}>{students.filter(s => s.assessment_done).length}</span>
              <span style={S.stripLabel}>Assessed</span>
            </div>
            <div style={S.stripStat}>
              <span style={{ ...S.stripNum, color: '#fcd34d' }}>{students.filter(s => !s.assessment_done).length}</span>
              <span style={S.stripLabel}>Pending</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={S.tableCard}>
          <StudentTable
            students={students}
            schoolId={schoolId}
            isLoading={loading}
            onRunAssessment={handleRunAssessment}
            onViewReport={handleViewReport}
            assessingIds={assessingIds}
          />
        </div>

        {/* Import modal */}
        {showImport && (
          <ImportModal
            schoolId={schoolId}
            onClose={() => setShowImport(false)}
            onSuccess={handleImportSuccess}
          />
        )}

        {/* Toast */}
        {toast && (
          <div style={S.toast}>{toast}</div>
        )}
      </div>
    </>
  );
}

// ─── Modal styles ─────────────────────────────────────────────────────────────

const M: Record<string, React.CSSProperties> = {
  backdrop:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal:      { background: '#0d1117', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 18, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  title:      { fontSize: 16, fontWeight: 700, color: '#e2e8f0' },
  closeBtn:   { background: 'transparent', border: 'none', color: '#6b7280', fontSize: 16, cursor: 'pointer', padding: 4 },
  body:       { padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },
  hint:       { fontSize: 13, color: '#64748b', lineHeight: 1.65, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' },
  filePicker: { border: '2px dashed rgba(99,102,241,0.35)', borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' },
  fileName:   { fontSize: 13.5, color: '#a5b4fc', fontWeight: 600 },
  filePlaceholder:{ fontSize: 13.5, color: '#475569' },
  sample:     { display: 'flex', flexDirection: 'column', gap: 6 },
  sampleLabel:{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' },
  sampleCode: { fontSize: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 14px', color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'pre' },
  error:      { fontSize: 13, color: '#fca5a5', background: 'rgba(239,68,68,0.10)', borderRadius: 8, padding: '10px 14px' },
  results:    { display: 'flex', flexDirection: 'column', gap: 6 },
  resultRow:  { fontSize: 13.5, color: '#cbd5e1', display: 'flex', gap: 8, alignItems: 'center' },
  resultGreen:{ color: '#6ee7b7', fontWeight: 700 },
  resultYellow:{ color: '#fcd34d', fontWeight: 700 },
  errList:    { background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 },
  errRow:     { fontSize: 12, color: '#94a3b8' },
  footer:     { display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.07)' },
  cancelBtn:  { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 9, color: '#94a3b8', fontSize: 13.5, fontWeight: 600, padding: '9px 18px', cursor: 'pointer' },
  importBtn:  { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13.5, fontWeight: 700, padding: '9px 20px', cursor: 'pointer' },
};

// ─── Page styles ──────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes shimmer { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
  @keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform:none; opacity:1; } }
  button:hover { opacity:0.85; }
`;

const S: Record<string, React.CSSProperties> = {
  root:       { minHeight: '100vh', background: '#080c14', fontFamily: "'DM Sans', sans-serif", color: '#f9fafb' },
  header:     { background: '#0d1117', borderBottom: '1px solid #1f2937', position: 'sticky', top: 0, zIndex: 40 },
  headerInner:{ maxWidth: 1200, margin: '0 auto', padding: '13px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  left:       { display: 'flex', alignItems: 'center', gap: 10 },
  backBtn:    { background: 'transparent', border: '1.5px solid #1f2937', borderRadius: 8, color: '#6b7280', fontSize: 12, fontWeight: 600, padding: '5px 12px', cursor: 'pointer' },
  sep:        { color: '#374151', fontSize: 14 },
  brand:      { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: '#f9fafb' },
  pageTitle:  { fontSize: 13, color: '#6b7280' },
  importBtn:  { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },

  strip:      { background: '#0a0f1e', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  stripInner: { maxWidth: 1200, margin: '0 auto', padding: '14px 24px', display: 'flex', gap: 40 },
  stripStat:  { display: 'flex', alignItems: 'baseline', gap: 8 },
  stripNum:   { fontSize: 22, fontWeight: 800, color: '#f9fafb' },
  stripLabel: { fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' },

  tableCard:  { maxWidth: 1200, margin: '24px auto', padding: '0 24px' },
  tableWrap:  { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' },

  toast:      { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: '#e2e8f0', fontSize: 13.5, fontWeight: 600, padding: '12px 20px', zIndex: 9999, animation: 'slideUp 0.25s ease', whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
};
