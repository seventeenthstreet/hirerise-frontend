'use client';

/**
 * app/onboarding/page.tsx — Unified Resume Onboarding (Complete Redesign)
 *
 * FLOW:
 *   Step 1  — Who are you? (Student / Professional)
 *   Step 2  — [Professional only] How to get started? (Upload / Build step-by-step)
 *   Step 3a — CV Upload → parse → pre-fill review
 *   Step 3b — Guided multi-step form (Personal → Experience → Education → Skills → Summary → Projects → Certs)
 *   Step 4  — Unified Review Screen (same component for both paths)
 *   Step 5  — Validation gate (blocks if required fields missing)
 *   Step 6  — Save → dashboard
 *
 * ARCHITECTURE:
 *   - Single ResumeData state shared across all steps
 *   - Validation logic extracted into validateResume() — used by both paths
 *   - ReviewScreen is one reusable component
 *   - ProfileStrengthScore computed from resume completeness
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/components/AuthProvider';
import { apiFetch } from '@/services/apiClient';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:       '#07090f',
  card:     '#0d1117',
  cardAlt:  '#0a0e18',
  border:   'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.14)',
  text:     '#dde4ef',
  muted:    '#5f6d87',
  dim:      '#1e2535',
  blue:     '#3c72f8',
  blueHi:   '#5589ff',
  purple:   '#9b7cf7',
  green:    '#1fd8a0',
  amber:    '#f59e0b',
  red:      '#ef4444',
  redBg:    'rgba(239,68,68,0.08)',
} as const;

// ─── Master Resume Schema ─────────────────────────────────────────────────────

export interface PersonalInfo {
  name:     string;
  email:    string;
  phone:    string;
  location: string;
}

export interface Experience {
  id:          string;
  title:       string;
  company:     string;
  start_date:  string;
  end_date:    string;
  description: string;
}

export interface Education {
  id:          string;
  degree:      string;
  institution: string;
  year:        string;
}

export interface ResumeData {
  personal_info:  PersonalInfo;
  summary:        string;
  skills:         string[];
  experience:     Experience[];
  education:      Education[];
  projects:       string[];
  certifications: string[];
}

const EMPTY_RESUME: ResumeData = {
  personal_info:  { name: '', email: '', phone: '', location: '' },
  summary:        '',
  skills:         [],
  experience:     [],
  education:      [],
  projects:       [],
  certifications: [],
};

// ─── Validation Engine ────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:        boolean;
  missing:      string[];
  improvements: string[];
}

export function validateResume(data: ResumeData): ValidationResult {
  const missing:      string[] = [];
  const improvements: string[] = [];

  if (!data.personal_info.name.trim())  missing.push('Full name');
  if (!data.personal_info.email.trim()) missing.push('Email address');
  if (!data.personal_info.phone.trim()) missing.push('Phone number');

  const hasExp = data.experience.length > 0;
  const hasEdu = data.education.length > 0;
  if (!hasExp && !hasEdu) missing.push('At least one experience or education entry');

  if (data.skills.length < 3)   improvements.push('Add more skills (minimum 3 recommended)');
  if (!data.summary.trim())     improvements.push('Add a professional summary');
  if (data.experience.some(e => e.description.trim().length < 30))
    improvements.push('Expand experience descriptions with more detail');

  return { valid: missing.length === 0, missing, improvements };
}

// ─── Profile Strength Score ───────────────────────────────────────────────────

function profileStrength(data: ResumeData): number {
  let score = 0;
  if (data.personal_info.name.trim())     score += 10;
  if (data.personal_info.email.trim())    score += 10;
  if (data.personal_info.phone.trim())    score += 8;
  if (data.personal_info.location.trim()) score += 5;
  if (data.summary.trim().length > 50)    score += 12;
  if (data.skills.length >= 3)            score += 10;
  if (data.skills.length >= 6)            score += 5;
  if (data.experience.length > 0)         score += 15;
  if (data.experience.length > 1)         score += 5;
  if (data.experience.some(e => e.description.trim().length > 80)) score += 8;
  if (data.education.length > 0)          score += 7;
  if (data.projects.length > 0)           score += 3;
  if (data.certifications.length > 0)     score += 2;
  return Math.min(100, score);
}

function strengthLabel(s: number): { label: string; color: string } {
  if (s >= 80) return { label: 'Excellent',   color: T.green  };
  if (s >= 60) return { label: 'Good',        color: T.blue   };
  if (s >= 40) return { label: 'Fair',        color: T.amber  };
  return              { label: 'Needs work',  color: T.red    };
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Btn({
  children, onClick, disabled = false, variant = 'primary', fullWidth = true, small = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  small?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: T.blue,  color: '#fff',  border: 'none' },
    secondary: { background: 'transparent', color: T.text,  border: `1px solid ${T.border}` },
    ghost:     { background: 'transparent', color: T.muted, border: 'none' },
    danger:    { background: T.redBg, color: T.red,   border: `1px solid rgba(239,68,68,0.3)` },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        width:        fullWidth ? '100%' : 'auto',
        padding:      small ? '8px 16px' : '13px 20px',
        borderRadius: 10,
        fontSize:     small ? 13 : 15,
        fontWeight:   600,
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.5 : 1,
        transition:   'opacity 0.15s, transform 0.1s',
        lineHeight:   1,
      }}
    >
      {children}
    </button>
  );
}

function Input({
  label, value, onChange, placeholder = '', type = 'text', multiline = false, rows = 3,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const shared: React.CSSProperties = {
    width:        '100%',
    background:   T.dim,
    border:       `1px solid ${T.border}`,
    borderRadius: 8,
    padding:      '10px 12px',
    fontSize:     14,
    color:        T.text,
    outline:      'none',
    fontFamily:   'inherit',
    boxSizing:    'border-box',
    resize:       multiline ? 'vertical' : undefined,
  };
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: 'block', fontSize: 12, color: T.muted, marginBottom: 5, fontWeight: 500 }}>{label}</label>}
      {multiline
        ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={shared} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={shared} />
      }
    </div>
  );
}

function SectionHeader({ title, onAdd, addLabel }: { title: string; onAdd?: () => void; addLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 20 }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</h3>
      {onAdd && (
        <button onClick={onAdd} style={{ background: 'none', border: 'none', color: T.blue, fontSize: 13, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
          + {addLabel ?? 'Add'}
        </button>
      )}
    </div>
  );
}

function SkillPill({ skill, onRemove }: { skill: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: `${T.blue}18`, border: `1px solid ${T.blue}40`,
      borderRadius: 20, padding: '4px 10px', fontSize: 12, color: T.blue,
      margin: '3px',
    }}>
      {skill}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: T.muted }}>Step {step} of {total}</span>
        <span style={{ fontSize: 11, color: T.muted }}>{pct}%</span>
      </div>
      <div style={{ height: 3, background: T.dim, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: T.blue, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// ─── Profile Strength Widget ──────────────────────────────────────────────────

function StrengthMeter({ data }: { data: ResumeData }) {
  const score = profileStrength(data);
  const { label, color } = strengthLabel(score);
  return (
    <div style={{ background: T.dim, borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
        <svg width="48" height="48" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke={T.border} strokeWidth="4"/>
          <circle
            cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 20}`}
            strokeDashoffset={`${2 * Math.PI * 20 * (1 - score / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color }}>{score}</span>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color }}>{label}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>Profile strength</div>
      </div>
    </div>
  );
}

// ─── STEP 1: Who are you? ─────────────────────────────────────────────────────

function StepWhoAreYou({ onSelect }: { onSelect: (t: 'student' | 'professional') => void }) {
  const [selected, setSelected] = useState<'student' | 'professional' | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  function handleSelect(role: 'student' | 'professional') {
    setSelected(role);
    setError(null);
    console.log('Selected Role:', role);
  }

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/users/me', {
        method:  'PATCH',
        body:    JSON.stringify({ user_type: selected }),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      // Non-blocking — log but still navigate so the user is never stuck
      console.warn('Failed to persist user_type, continuing anyway:', err);
    } finally {
      setLoading(false);
    }
    onSelect(selected);
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: '0 0 8px', textAlign: 'center' }}>Who are you?</h1>
      <p style={{ color: T.muted, textAlign: 'center', marginBottom: 28, fontSize: 14 }}>
        We'll personalise your experience from the start.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        {([
          { type: 'student'      as const, icon: '🎓', title: 'Student',      desc: 'Explore careers and plan your education path.',      accent: T.purple },
          { type: 'professional' as const, icon: '💼', title: 'Professional', desc: 'Score your resume and accelerate career growth.', accent: T.blue   },
        ]).map(c => (
          <button
            key={c.type}
            type="button"
            onClick={() => handleSelect(c.type)}
            style={{
              background:   selected === c.type ? `${c.accent}15` : T.card,
              border:       `1.5px solid ${selected === c.type ? c.accent : T.border}`,
              borderRadius: 12, padding: '20px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 10 }}>{c.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 5 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>{c.desc}</div>
          </button>
        ))}
      </div>
      {error && (
        <div style={{
          background: T.redBg, border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          color: T.red, fontSize: 13,
        }}>
          {error}
        </div>
      )}
      <Btn onClick={handleContinue} disabled={!selected || loading}>
        {loading ? 'Saving…' : 'Continue →'}
      </Btn>
    </div>
  );
}

// ─── STEP 2: How to get started? (Professional only) ─────────────────────────

function StepGetStarted({ onChoice }: { onChoice: (c: 'upload' | 'guided') => void }) {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: '0 0 8px', textAlign: 'center' }}>How would you like to get started?</h1>
      <p style={{ color: T.muted, textAlign: 'center', marginBottom: 28, fontSize: 14 }}>
        Both paths produce the same result — pick what's easiest.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
        {([
          { key: 'upload' as const, icon: '📄', title: 'Upload Resume', desc: 'Upload your CV for instant analysis and pre-filled review.' },
          { key: 'guided' as const, icon: '✏️', title: 'Build Step-by-Step', desc: 'Enter your details manually with guided prompts.' },
        ]).map(c => (
          <button
            key={c.key}
            onClick={() => onChoice(c.key)}
            style={{
              background: T.card, border: `1.5px solid ${T.border}`, borderRadius: 12,
              padding: '18px 20px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
              display: 'flex', alignItems: 'center', gap: 16,
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = T.blue)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
          >
            <span style={{ fontSize: 28, flexShrink: 0 }}>{c.icon}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{c.title}</div>
              <div style={{ fontSize: 13, color: T.muted }}>{c.desc}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: T.muted, fontSize: 18 }}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── STEP 3a: CV Upload ───────────────────────────────────────────────────────

function StepUpload({ onParsed, onSkip }: {
  onParsed: (data: Partial<ResumeData>) => void;
  onSkip:   () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [file,     setFile]     = useState<File | null>(null);
  const [parsing,  setParsing]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    const ok = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(f.type);
    if (!ok)               { setError('Please upload a PDF or DOCX file.'); return; }
    if (f.size > 10 * 1024 * 1024) { setError('File must be under 10 MB.'); return; }
    setFile(f);
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setParsing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch<{ parsedData?: Partial<ResumeData>; resumeId?: string }>('/resumes', {
        method: 'POST',
        body:   form,
        headers: {},
        skipAuth: false,
      });
      // Map parsed data to our schema
      onParsed(res.parsedData ?? {});
    } catch (e: any) {
      setError(e?.message || 'Upload failed. Please try again.');
      setParsing(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: '0 0 8px', textAlign: 'center' }}>Upload your resume</h1>
      <p style={{ color: T.muted, textAlign: 'center', marginBottom: 24, fontSize: 14 }}>
        We'll parse it and pre-fill your profile for review.
      </p>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        style={{
          border:       `2px dashed ${dragging ? T.blue : file ? T.green : T.border}`,
          borderRadius: 12, padding: '36px 24px', textAlign: 'center',
          cursor: 'pointer', background: dragging ? `${T.blue}08` : 'transparent',
          marginBottom: 16, transition: 'all 0.15s',
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        <div style={{ fontSize: 30, marginBottom: 10 }}>{file ? '📄' : '📋'}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: file ? T.green : T.text, marginBottom: 4 }}>
          {file ? file.name : 'Drop your resume here or click to browse'}
        </div>
        <div style={{ fontSize: 12, color: T.muted }}>
          {file ? `${(file.size / 1024).toFixed(0)} KB` : 'PDF or DOCX · Max 10 MB'}
        </div>
      </div>

      {error && (
        <div style={{ background: T.redBg, border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: T.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      <Btn onClick={handleUpload} disabled={!file || parsing}>
        {parsing ? 'Analysing…' : 'Analyse My Resume →'}
      </Btn>
      <div style={{ marginTop: 10 }}>
        <Btn variant="ghost" onClick={onSkip}>Skip — I'll enter details manually</Btn>
      </div>
    </div>
  );
}

// ─── STEP 3b: Guided Form ─────────────────────────────────────────────────────

const GUIDED_STEPS = ['Personal Info', 'Experience', 'Education', 'Skills', 'Summary', 'Projects', 'Certifications'] as const;
type GuidedStep = typeof GUIDED_STEPS[number];

function GuidedForm({ data, onChange, onComplete }: {
  data:       ResumeData;
  onChange:   (d: ResumeData) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<number>(0);
  const [skillInput, setSkillInput] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [certInput, setCertInput] = useState('');

  const total = GUIDED_STEPS.length;
  const current = GUIDED_STEPS[step];

  function update(patch: Partial<ResumeData>) {
    onChange({ ...data, ...patch });
  }

  function updatePersonal(patch: Partial<PersonalInfo>) {
    onChange({ ...data, personal_info: { ...data.personal_info, ...patch } });
  }

  function addExperience() {
    update({ experience: [...data.experience, { id: Date.now().toString(), title: '', company: '', start_date: '', end_date: '', description: '' }] });
  }

  function updateExp(id: string, patch: Partial<Experience>) {
    update({ experience: data.experience.map(e => e.id === id ? { ...e, ...patch } : e) });
  }

  function removeExp(id: string) {
    update({ experience: data.experience.filter(e => e.id !== id) });
  }

  function addEducation() {
    update({ education: [...data.education, { id: Date.now().toString(), degree: '', institution: '', year: '' }] });
  }

  function updateEdu(id: string, patch: Partial<Education>) {
    update({ education: data.education.map(e => e.id === id ? { ...e, ...patch } : e) });
  }

  function removeEdu(id: string) {
    update({ education: data.education.filter(e => e.id !== id) });
  }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !data.skills.includes(s)) {
      update({ skills: [...data.skills, s] });
      setSkillInput('');
    }
  }

  function addProject() {
    const p = projectInput.trim();
    if (p) { update({ projects: [...data.projects, p] }); setProjectInput(''); }
  }

  function addCert() {
    const c = certInput.trim();
    if (c) { update({ certifications: [...data.certifications, c] }); setCertInput(''); }
  }

  function handleNext() {
    if (step < total - 1) setStep(s => s + 1);
    else onComplete();
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1);
  }

  return (
    <div>
      <ProgressBar step={step + 1} total={total} />
      <h2 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: '0 0 20px' }}>{current}</h2>

      {current === 'Personal Info' && (
        <>
          <Input label="Full Name *"       value={data.personal_info.name}     onChange={v => updatePersonal({ name: v })}     placeholder="Jane Smith" />
          <Input label="Email *"           value={data.personal_info.email}    onChange={v => updatePersonal({ email: v })}    placeholder="jane@example.com" type="email" />
          <Input label="Phone *"           value={data.personal_info.phone}    onChange={v => updatePersonal({ phone: v })}    placeholder="+1 555 000 0000" />
          <Input label="Location"          value={data.personal_info.location} onChange={v => updatePersonal({ location: v })} placeholder="London, UK" />
        </>
      )}

      {current === 'Experience' && (
        <>
          <SectionHeader title="Work Experience" onAdd={addExperience} addLabel="Add Role" />
          {data.experience.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: T.muted, fontSize: 13 }}>
              No experience added yet. Click "+ Add Role" above.
            </div>
          )}
          {data.experience.map((exp, i) => (
            <div key={exp.id} style={{ background: T.dim, borderRadius: 10, padding: '14px', marginBottom: 12, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Role {i + 1}</span>
                <button onClick={() => removeExp(exp.id)} style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 13 }}>Remove</button>
              </div>
              <Input label="Job Title"    value={exp.title}       onChange={v => updateExp(exp.id, { title: v })}       placeholder="Senior Engineer" />
              <Input label="Company"      value={exp.company}     onChange={v => updateExp(exp.id, { company: v })}     placeholder="Acme Corp" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input label="Start Date" value={exp.start_date}  onChange={v => updateExp(exp.id, { start_date: v })} placeholder="Jan 2022" />
                <Input label="End Date"   value={exp.end_date}    onChange={v => updateExp(exp.id, { end_date: v })}   placeholder="Present" />
              </div>
              <Input label="Description" value={exp.description} onChange={v => updateExp(exp.id, { description: v })} placeholder="Describe your key responsibilities and achievements…" multiline rows={3} />
            </div>
          ))}
        </>
      )}

      {current === 'Education' && (
        <>
          <SectionHeader title="Education" onAdd={addEducation} addLabel="Add Entry" />
          {data.education.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: T.muted, fontSize: 13 }}>
              No education added yet. Click "+ Add Entry" above.
            </div>
          )}
          {data.education.map((edu, i) => (
            <div key={edu.id} style={{ background: T.dim, borderRadius: 10, padding: '14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Entry {i + 1}</span>
                <button onClick={() => removeEdu(edu.id)} style={{ background: 'none', border: 'none', color: T.red, cursor: 'pointer', fontSize: 13 }}>Remove</button>
              </div>
              <Input label="Degree / Qualification" value={edu.degree}      onChange={v => updateEdu(edu.id, { degree: v })}      placeholder="BSc Computer Science" />
              <Input label="Institution"            value={edu.institution} onChange={v => updateEdu(edu.id, { institution: v })} placeholder="University of London" />
              <Input label="Year"                   value={edu.year}        onChange={v => updateEdu(edu.id, { year: v })}        placeholder="2021" />
            </div>
          ))}
        </>
      )}

      {current === 'Skills' && (
        <>
          <SectionHeader title="Skills" />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              placeholder="Type a skill and press Enter"
              style={{ flex: 1, background: T.dim, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={addSkill} style={{ background: T.blue, border: 'none', borderRadius: 8, padding: '0 16px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0, marginBottom: 8 }}>
            {data.skills.map(s => (
              <SkillPill key={s} skill={s} onRemove={() => update({ skills: data.skills.filter(x => x !== s) })} />
            ))}
          </div>
          {data.skills.length < 3 && (
            <p style={{ fontSize: 12, color: T.amber, margin: '8px 0 0' }}>⚠ Add at least 3 skills for a strong profile.</p>
          )}
        </>
      )}

      {current === 'Summary' && (
        <>
          <SectionHeader title="Professional Summary" />
          <Input
            label="Write a 2–4 sentence summary of your professional background"
            value={data.summary}
            onChange={v => update({ summary: v })}
            placeholder="Experienced software engineer with 5+ years building scalable web applications…"
            multiline rows={5}
          />
          <p style={{ fontSize: 12, color: T.muted }}>{data.summary.length} characters</p>
        </>
      )}

      {current === 'Projects' && (
        <>
          <SectionHeader title="Projects (Optional)" />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={projectInput}
              onChange={e => setProjectInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addProject())}
              placeholder="Project name or description"
              style={{ flex: 1, background: T.dim, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={addProject} style={{ background: T.blue, border: 'none', borderRadius: 8, padding: '0 16px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
          </div>
          {data.projects.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 13, color: T.text, background: T.dim, borderRadius: 6, padding: '7px 10px' }}>{p}</span>
              <button onClick={() => update({ projects: data.projects.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </>
      )}

      {current === 'Certifications' && (
        <>
          <SectionHeader title="Certifications (Optional)" />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              value={certInput}
              onChange={e => setCertInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCert())}
              placeholder="e.g. AWS Solutions Architect"
              style={{ flex: 1, background: T.dim, border: `1px solid ${T.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={addCert} style={{ background: T.blue, border: 'none', borderRadius: 8, padding: '0 16px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
          </div>
          {data.certifications.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ flex: 1, fontSize: 13, color: T.text, background: T.dim, borderRadius: 6, padding: '7px 10px' }}>{c}</span>
              <button onClick={() => update({ certifications: data.certifications.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {step > 0 && <Btn variant="secondary" fullWidth={false} onClick={handleBack} small>← Back</Btn>}
        <div style={{ flex: 1 }}>
          <Btn onClick={handleNext}>{step === total - 1 ? 'Review My Profile →' : 'Next →'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── STEP 4 + 5: Review Screen (unified, used by both paths) ──────────────────

function ReviewScreen({ data, onChange, onConfirm, saving }: {
  data:      ResumeData;
  onChange:  (d: ResumeData) => void;
  onConfirm: () => void;
  saving:    boolean;
}) {
  const validation = validateResume(data);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState('');

  function update(patch: Partial<ResumeData>) { onChange({ ...data, ...patch }); }
  function updatePersonal(patch: Partial<PersonalInfo>) { onChange({ ...data, personal_info: { ...data.personal_info, ...patch } }); }
  function updateExp(id: string, patch: Partial<Experience>) { update({ experience: data.experience.map(e => e.id === id ? { ...e, ...patch } : e) }); }
  function updateEdu(id: string, patch: Partial<Education>) { update({ education: data.education.map(e => e.id === id ? { ...e, ...patch } : e) }); }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !data.skills.includes(s)) { update({ skills: [...data.skills, s] }); setSkillInput(''); }
  }

  function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    const isEditing = editingSection === id;
    return (
      <div style={{ borderBottom: `1px solid ${T.border}`, paddingBottom: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</span>
          <button
            onClick={() => setEditingSection(isEditing ? null : id)}
            style={{ background: 'none', border: 'none', color: isEditing ? T.green : T.blue, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            {isEditing ? '✓ Done' : '✏ Edit'}
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: '0 0 4px', textAlign: 'center' }}>Review Your Profile</h1>
      <p style={{ color: T.muted, textAlign: 'center', marginBottom: 20, fontSize: 13 }}>
        Check and edit your details before saving.
      </p>

      <StrengthMeter data={data} />

      {/* Validation alert */}
      {(!validation.valid || validation.improvements.length > 0) && (
        <div style={{ background: validation.valid ? `${T.amber}10` : T.redBg, border: `1px solid ${validation.valid ? T.amber + '40' : 'rgba(239,68,68,0.25)'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          {!validation.valid && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 8 }}>⚠ Missing required fields</div>
              {validation.missing.map((m: string) => (
                <div key={m} style={{ fontSize: 12, color: T.red, marginBottom: 3 }}>• {m}</div>
              ))}
            </>
          )}
          {validation.improvements.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.amber, marginTop: validation.valid ? 0 : 12, marginBottom: 8 }}>💡 Improvements</div>
              {validation.improvements.map((i: string) => (
                <div key={i} style={{ fontSize: 12, color: T.amber, marginBottom: 3 }}>• {i}</div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Personal Info */}
      <Section id="personal" title="Personal Info">
        {editingSection === 'personal' ? (
          <>
            <Input label="Full Name *"  value={data.personal_info.name}     onChange={v => updatePersonal({ name: v })}     placeholder="Jane Smith" />
            <Input label="Email *"      value={data.personal_info.email}    onChange={v => updatePersonal({ email: v })}    placeholder="jane@example.com" />
            <Input label="Phone *"      value={data.personal_info.phone}    onChange={v => updatePersonal({ phone: v })}    placeholder="+1 555 000 0000" />
            <Input label="Location"     value={data.personal_info.location} onChange={v => updatePersonal({ location: v })} placeholder="London, UK" />
          </>
        ) : (
          <div style={{ fontSize: 13, color: T.text }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{data.personal_info.name || <span style={{ color: T.red }}>Name missing</span>}</div>
            <div style={{ color: T.muted }}>{[data.personal_info.email, data.personal_info.phone, data.personal_info.location].filter(Boolean).join(' · ') || <span style={{ color: T.red }}>Contact details missing</span>}</div>
          </div>
        )}
      </Section>

      {/* Summary */}
      <Section id="summary" title="Summary">
        {editingSection === 'summary'
          ? <Input value={data.summary} onChange={v => update({ summary: v })} placeholder="Professional summary…" multiline rows={4} />
          : <p style={{ fontSize: 13, color: data.summary ? T.text : T.red, margin: 0, lineHeight: 1.6 }}>{data.summary || 'No summary added'}</p>
        }
      </Section>

      {/* Skills */}
      <Section id="skills" title={`Skills (${data.skills.length})`}>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {data.skills.map(s => (
            <SkillPill key={s} skill={s} onRemove={() => update({ skills: data.skills.filter(x => x !== s) })} />
          ))}
          {data.skills.length === 0 && <span style={{ fontSize: 13, color: T.red }}>No skills added</span>}
        </div>
        {editingSection === 'skills' && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              placeholder="Add skill + Enter"
              style={{ flex: 1, background: T.dim, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={addSkill} style={{ background: T.blue, border: 'none', borderRadius: 8, padding: '0 14px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Add</button>
          </div>
        )}
      </Section>

      {/* Experience */}
      <Section id="experience" title={`Experience (${data.experience.length})`}>
        {data.experience.length === 0 && <span style={{ fontSize: 13, color: T.muted }}>No experience added</span>}
        {data.experience.map((exp, i) => (
          <div key={exp.id} style={{ marginBottom: editingSection === 'experience' ? 14 : 10 }}>
            {editingSection === 'experience' ? (
              <div style={{ background: T.dim, borderRadius: 8, padding: 12 }}>
                <Input label="Title"   value={exp.title}       onChange={v => updateExp(exp.id, { title: v })}       placeholder="Job Title" />
                <Input label="Company" value={exp.company}     onChange={v => updateExp(exp.id, { company: v })}     placeholder="Company" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Input label="From" value={exp.start_date} onChange={v => updateExp(exp.id, { start_date: v })} placeholder="Jan 2022" />
                  <Input label="To"   value={exp.end_date}   onChange={v => updateExp(exp.id, { end_date: v })}   placeholder="Present" />
                </div>
                <Input label="Description" value={exp.description} onChange={v => updateExp(exp.id, { description: v })} multiline rows={3} />
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{exp.title || 'Untitled'} {exp.company && <span style={{ color: T.muted, fontWeight: 400 }}>@ {exp.company}</span>}</div>
                {(exp.start_date || exp.end_date) && <div style={{ fontSize: 12, color: T.muted }}>{exp.start_date} – {exp.end_date}</div>}
                {exp.description && <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>{exp.description.slice(0, 100)}{exp.description.length > 100 ? '…' : ''}</div>}
              </div>
            )}
          </div>
        ))}
        {editingSection === 'experience' && (
          <button onClick={() => update({ experience: [...data.experience, { id: Date.now().toString(), title: '', company: '', start_date: '', end_date: '', description: '' }] })}
            style={{ background: 'none', border: `1px dashed ${T.border}`, borderRadius: 8, padding: '8px', color: T.muted, cursor: 'pointer', fontSize: 13, width: '100%', marginTop: 4 }}>
            + Add Experience
          </button>
        )}
      </Section>

      {/* Education */}
      <Section id="education" title={`Education (${data.education.length})`}>
        {data.education.length === 0 && <span style={{ fontSize: 13, color: T.muted }}>No education added</span>}
        {data.education.map((edu) => (
          <div key={edu.id} style={{ marginBottom: editingSection === 'education' ? 14 : 8 }}>
            {editingSection === 'education' ? (
              <div style={{ background: T.dim, borderRadius: 8, padding: 12 }}>
                <Input label="Degree"      value={edu.degree}      onChange={v => updateEdu(edu.id, { degree: v })}      placeholder="BSc Computer Science" />
                <Input label="Institution" value={edu.institution} onChange={v => updateEdu(edu.id, { institution: v })} placeholder="University name" />
                <Input label="Year"        value={edu.year}        onChange={v => updateEdu(edu.id, { year: v })}        placeholder="2021" />
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{edu.degree || 'Untitled'}</div>
                <div style={{ fontSize: 12, color: T.muted }}>{edu.institution}{edu.year ? ` · ${edu.year}` : ''}</div>
              </div>
            )}
          </div>
        ))}
        {editingSection === 'education' && (
          <button onClick={() => update({ education: [...data.education, { id: Date.now().toString(), degree: '', institution: '', year: '' }] })}
            style={{ background: 'none', border: `1px dashed ${T.border}`, borderRadius: 8, padding: '8px', color: T.muted, cursor: 'pointer', fontSize: 13, width: '100%', marginTop: 4 }}>
            + Add Education
          </button>
        )}
      </Section>

      {/* CTA */}
      <div style={{ paddingTop: 8 }}>
        <Btn onClick={onConfirm} disabled={!validation.valid || saving}>
          {saving ? 'Saving…' : validation.valid ? 'Confirm & Go to Dashboard →' : 'Complete required fields to continue'}
        </Btn>
        {!validation.valid && (
          <p style={{ textAlign: 'center', fontSize: 12, color: T.red, marginTop: 8 }}>
            Please fill in the required fields highlighted above.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Shell / Page layout ──────────────────────────────────────────────────────

type FlowStage =
  | 'loading'
  | 'who-are-you'
  | 'get-started'
  | 'upload'
  | 'guided'
  | 'review';

type UserType = 'student' | 'professional';

// ─── Auto-save hook ───────────────────────────────────────────────────────────
// Debounces progress saves so we don't hammer the API on every keystroke.

function useAutoSave(stage: FlowStage, resume: ResumeData) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((step: string, data: ResumeData) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      apiFetch('/onboarding/progress', {
        method:  'PATCH',
        body:    JSON.stringify({ step, resume_data: data }),
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => { /* non-fatal */ });
    }, 1200);
  }, []);

  useEffect(() => {
    if (stage === 'loading' || stage === 'who-are-you') return;
    save(stage, resume);
  }, [stage, resume, save]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UnifiedOnboardingPage() {
  const router = useRouter();
  const auth   = useAuth();

  const [stage,    setStage]    = useState<FlowStage>('loading');
  const [userType, setUserType] = useState<UserType>('professional');
  const [resume,   setResume]   = useState<ResumeData>(EMPTY_RESUME);
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState<string | null>(null);

  // ── Auto-save on every stage / resume change ────────────────────────────
  useAutoSave(stage, resume);

  // ── On mount: restore progress or redirect if already complete ──────────
  useEffect(() => {
    async function init() {
      try {
        const res = await apiFetch<{
          data: {
            resume_data:          ResumeData | null;
            onboarding_step:      string | null;
            onboarding_completed: boolean;
          };
        }>('/onboarding/resume');

        // Already complete — skip the flow entirely
        if (res.data.onboarding_completed) {
          const dest = (auth?.user?.user_type === 'student')
            ? '/student-dashboard'
            : '/career-dashboard';
          router.replace(dest);
          return;
        }

        // Restore saved resume data
        if (res.data.resume_data) {
          setResume(res.data.resume_data);
        }

        // Resume from last saved step
        const savedStepRaw = res.data.onboarding_step;
        const validStages: FlowStage[] = ['who-are-you', 'get-started', 'upload', 'guided', 'review'];
        if (savedStepRaw && validStages.includes(savedStepRaw as FlowStage)) {
          setStage(savedStepRaw as FlowStage);
        } else {
          setStage('who-are-you');
        }
      } catch {
        // New user or fetch failed — start from scratch
        setStage('who-are-you');
      }
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Merge parsed CV data and jump to review ─────────────────────────────
  function handleParsed(parsed: Partial<ResumeData>) {
    setResume(prev => ({
      personal_info:  { ...prev.personal_info,  ...(parsed.personal_info  ?? {}) },
      summary:        parsed.summary                   ?? prev.summary,
      skills:         parsed.skills?.length             ? parsed.skills         : prev.skills,
      experience:     parsed.experience?.length         ? parsed.experience     : prev.experience,
      education:      parsed.education?.length          ? parsed.education      : prev.education,
      projects:       parsed.projects?.length           ? parsed.projects       : prev.projects,
      certifications: parsed.certifications?.length     ? parsed.certifications : prev.certifications,
    }));
    setStage('review');
  }

  // ── Completion: validate server-side, persist, mark done ───────────────
  async function handleConfirm() {
    setSaving(true);
    setSaveErr(null);
    try {
      const result = await apiFetch<{
        success:         boolean;
        alreadyComplete: boolean;
        profileStrength: number;
        missing?:        string[];
        message:         string;
      }>('/onboarding/complete', {
        method:  'POST',
        body:    JSON.stringify({ resume_data: resume }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!result.success) {
        setSaveErr(`Please complete: ${result.missing?.join(', ')}`);
        setSaving(false);
        return;
      }

      // Update AuthProvider state instantly (no extra network round-trip).
      // completeOnboarding() sets onboardingCompleted = true in local state,
      // so AuthGuard on the destination page renders children immediately
      // instead of redirecting back to /onboarding.
      auth.completeOnboarding();

      router.replace(userType === 'student' ? '/student-dashboard' : '/career-dashboard');

    } catch (err: any) {
      setSaveErr(err?.message ?? 'Save failed. Please try again.');
      setSaving(false);
    }
  }

  // ── Loading splash ──────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: T.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 32, height: 32,
            border: `2px solid ${T.blue}`, borderTopColor: 'transparent',
            borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: T.muted, fontSize: 13 }}>Loading your profile…</p>
        </div>
      </div>
    );
  }

  // ── Stage → progress bar mapping ───────────────────────────────────────
  const stageProgress: Record<Exclude<FlowStage, 'loading'>, { step: number; total: number }> = {
    'who-are-you': { step: 1, total: 4 },
    'get-started': { step: 2, total: 4 },
    'upload':      { step: 3, total: 4 },
    'guided':      { step: 3, total: 4 },
    'review':      { step: 4, total: 4 },
  };

  const { step: progressStep, total: progressTotal } =
    stageProgress[stage as Exclude<FlowStage, 'loading'>] ?? { step: 1, total: 4 };

  return (
    <div style={{
      minHeight: '100vh', background: T.bg,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '32px 16px 60px',
    }}>
      <div style={{
        width: '100%', maxWidth: 500,
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 18, padding: '36px 32px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: '-0.5px' }}>
            Hire<span style={{ color: T.blue }}>Rise</span>
          </span>
        </div>

        {/* Top-level progress (guided form has its own sub-progress) */}
        {stage !== 'guided' && (
          <ProgressBar step={progressStep} total={progressTotal} />
        )}

        {/* Save error banner */}
        {saveErr && (
          <div style={{
            background: T.redBg, border: `1px solid rgba(239,68,68,0.3)`,
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            color: T.red, fontSize: 13,
          }}>
            {saveErr}
          </div>
        )}

        {stage === 'who-are-you' && (
          <StepWhoAreYou onSelect={t => {
            setUserType(t);
            setStage(t === 'student' ? 'guided' : 'get-started');
          }} />
        )}

        {stage === 'get-started' && (
          <StepGetStarted onChoice={c => setStage(c === 'upload' ? 'upload' : 'guided')} />
        )}

        {stage === 'upload' && (
          <StepUpload
            onParsed={handleParsed}
            onSkip={() => setStage('guided')}
          />
        )}

        {stage === 'guided' && (
          <GuidedForm
            data={resume}
            onChange={setResume}
            onComplete={() => setStage('review')}
          />
        )}

        {stage === 'review' && (
          <ReviewScreen
            data={resume}
            onChange={setResume}
            onConfirm={handleConfirm}
            saving={saving}
          />
        )}
      </div>
    </div>
  );
}