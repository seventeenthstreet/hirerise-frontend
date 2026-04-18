'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useUpdateProfile } from '@/hooks/useUpdateProfile';
import { ProfileSkeleton } from '@/components/ui/LoadingSkeleton';
import { QueryError } from '@/components/ui/ErrorState';
import { mutationToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, id, children, hint }: {
  label: string; id: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-surface-800">{label}</label>
      {children}
      {hint && <p className="text-xs text-surface-400">{hint}</p>}
    </div>
  );
}

const inputCls = [
  'h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900',
  'placeholder:text-surface-300 transition-colors',
  'focus:border-hr-500 focus:outline-none focus:ring-2 focus:ring-hr-100',
].join(' ');

const EXPERIENCE_OPTIONS = [
  { value: 'student', label: 'Student / No experience' },
  { value: 'entry',   label: '0–2 years' },
  { value: 'mid',     label: '3–5 years' },
  { value: 'senior',  label: '6–10 years' },
  { value: 'principal', label: '10+ years' },
];

const EDUCATION_OPTIONS = [
  { value: 'high_school', label: 'High School / GED' },
  { value: 'associate',   label: "Associate's Degree" },
  { value: 'bachelor',    label: "Bachelor's Degree" },
  { value: 'master',      label: "Master's Degree" },
  { value: 'phd',         label: 'PhD / Doctorate' },
  { value: 'bootcamp',    label: 'Bootcamp / Self-taught' },
  { value: 'other',       label: 'Other' },
];

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card">
      <h3 className="mb-5 text-sm font-bold text-surface-900">{title}</h3>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data, isLoading, isError, error, refetch } = useProfile();
  const { mutate: updateProfile, isPending: saving } = useUpdateProfile();

  const user = (data as any)?.user ?? data;

  const [form, setForm] = useState({
    displayName: '', bio: '', location: '', targetRole: '',
    experienceLevel: '', educationLevel: '',
    linkedinUrl: '', githubUrl: '', websiteUrl: '',
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName:     user.displayName     ?? '',
      bio:             user.bio             ?? '',
      location:        user.location        ?? '',
      targetRole:      user.targetRole      ?? '',
      experienceLevel: user.experienceLevel ?? '',
      educationLevel:  user.educationLevel  ?? '',
      linkedinUrl:     user.linkedinUrl     ?? '',
      githubUrl:       user.githubUrl       ?? '',
      websiteUrl:      user.websiteUrl      ?? '',
    });
    setDirty(false);
  }, [user]);

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updateProfile(form as any, {
      onSuccess: () => { mutationToast.profileUpdated(); setDirty(false); },
      onError:   () => mutationToast.profileError(),
    });
  };

  const SelectField = ({ id, value, onChange, options, placeholder }: {
    id: string; value: string; onChange: (v: string) => void;
    options: { value: string; label: string }[]; placeholder?: string;
  }) => (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputCls, 'appearance-none pr-8 cursor-pointer')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </div>
  );

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-surface-900">Profile</h2>
          <p className="mt-0.5 text-sm text-surface-400">
            Manage your personal information and career preferences.
          </p>
        </div>
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-hr-600 px-4 text-sm font-semibold text-white hover:bg-hr-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {saving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </button>
        )}
      </div>

      {/* Unsaved banner */}
      {dirty && !saving && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <p className="text-xs font-medium text-amber-700">You have unsaved changes</p>
          <button
            onClick={handleSave}
            className="ml-auto text-xs font-semibold text-amber-700 underline hover:text-amber-800 transition-colors"
          >
            Save now
          </button>
        </div>
      )}

      {isLoading ? (
        <ProfileSkeleton />
      ) : isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : (
        <>
          {/* Avatar */}
          <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card">
            <div className="flex items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-hr-100 text-xl font-bold text-hr-700">
                {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-surface-900">
                  {user?.displayName ?? 'Your name'}
                </p>
                <p className="text-sm text-surface-400">{user?.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user?.tier && (
                    <span className="rounded-full border border-hr-100 bg-hr-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-hr-700">
                      {user.tier} plan
                    </span>
                  )}
                  {user?.onboardingCompleted && (
                    <span className="rounded-full border border-green-100 bg-green-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-green-700">
                      Profile complete
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal info */}
          <Section title="Personal information">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Full name" id="displayName">
                <input id="displayName" type="text" value={form.displayName}
                  onChange={(e) => set('displayName')(e.target.value)}
                  placeholder="Alex Johnson" className={inputCls} />
              </Field>
              <Field label="Email" id="email" hint="Managed by your authentication provider">
                <input id="email" type="email" value={user?.email ?? ''} disabled
                  className={cn(inputCls, 'bg-surface-50 text-surface-400 cursor-not-allowed')} />
              </Field>
              <Field label="Location" id="location">
                <input id="location" type="text" value={form.location}
                  onChange={(e) => set('location')(e.target.value)}
                  placeholder="San Francisco, CA" className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Bio" id="bio" hint="A short description about yourself">
                  <textarea id="bio" rows={3} value={form.bio}
                    onChange={(e) => set('bio')(e.target.value)}
                    placeholder="I'm a software engineer with a passion for..."
                    className={cn(inputCls, 'h-auto resize-none py-2.5')} />
                </Field>
              </div>
            </div>
          </Section>

          {/* Career info */}
          <Section title="Career information">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Target role" id="targetRole">
                <input id="targetRole" type="text" value={form.targetRole}
                  onChange={(e) => set('targetRole')(e.target.value)}
                  placeholder="Senior Software Engineer" className={inputCls} />
              </Field>
              <Field label="Experience level" id="experienceLevel">
                <SelectField id="experienceLevel" value={form.experienceLevel}
                  onChange={set('experienceLevel')} options={EXPERIENCE_OPTIONS}
                  placeholder="Select level" />
              </Field>
              <Field label="Education level" id="educationLevel">
                <SelectField id="educationLevel" value={form.educationLevel}
                  onChange={set('educationLevel')} options={EDUCATION_OPTIONS}
                  placeholder="Select education" />
              </Field>
            </div>
          </Section>

          {/* Social links */}
          <Section title="Social links">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="LinkedIn URL" id="linkedinUrl">
                <input id="linkedinUrl" type="url" value={form.linkedinUrl}
                  onChange={(e) => set('linkedinUrl')(e.target.value)}
                  placeholder="https://linkedin.com/in/yourname" className={inputCls} />
              </Field>
              <Field label="GitHub URL" id="githubUrl">
                <input id="githubUrl" type="url" value={form.githubUrl}
                  onChange={(e) => set('githubUrl')(e.target.value)}
                  placeholder="https://github.com/yourname" className={inputCls} />
              </Field>
              <Field label="Personal website" id="websiteUrl">
                <input id="websiteUrl" type="url" value={form.websiteUrl}
                  onChange={(e) => set('websiteUrl')(e.target.value)}
                  placeholder="https://yourwebsite.com" className={inputCls} />
              </Field>
            </div>
          </Section>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-hr-600 px-5 text-sm font-semibold text-white hover:bg-hr-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
