'use client';

// features/profile/components/ProfileForm.tsx
//
// Editable form for PATCH /api/v1/users/me fields.
// Reads current values from useProfile, submits via useUpdateProfile.

import { useEffect, useState } from 'react';
import { useProfile, useUpdateProfile } from '../hooks';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  name:            string;
  location:        string;
  experienceYears: string;
  targetRole:      string;
  bio:             string;
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

const tierStyles: Record<string, string> = {
  free:       'bg-surface-100 text-surface-500 border-surface-200',
  pro:        'bg-hr-50 text-hr-600 border-hr-200',
  enterprise: 'bg-amber-50 text-amber-700 border-amber-200',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileForm() {
  const { data, isLoading, isError } = useProfile();
  const update = useUpdateProfile();
  const user   = data?.user;

  const [form, setForm]       = useState<FormState>({ name: '', location: '', experienceYears: '', targetRole: '', bio: '' });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved]     = useState(false);

  // Populate form when data arrives
  // BackendUser now includes optional profile fields typed directly
  useEffect(() => {
    if (user) {
      setForm({
        name:            user.displayName ?? '',
        location:        user.location ?? '',
        experienceYears: user.experienceYears != null ? String(user.experienceYears) : '',
        targetRole:      user.targetRole ?? '',
        bio:             user.bio ?? '',
      });
    }
  }, [user]);

  const handleChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await update.mutateAsync({
      name:            form.name || undefined,
      location:        form.location || undefined,
      experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
      targetRole:      form.targetRole || undefined,
      bio:             form.bio || undefined,
    });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-card">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 animate-skeleton rounded-2xl bg-surface-100" />
            <div className="space-y-2">
              <div className="h-5 w-40 animate-skeleton rounded bg-surface-100" />
              <div className="h-3.5 w-28 animate-skeleton rounded bg-surface-100" />
              <div className="h-4 w-16 animate-skeleton rounded-full bg-surface-100" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-card space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 animate-skeleton rounded bg-surface-100" />
              <div className="h-9 w-full animate-skeleton rounded-lg bg-surface-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-600">Failed to load profile. Please refresh.</p>
      </div>
    );
  }

  const initials = user.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase();

  const tierStyle = tierStyles[user.tier] ?? tierStyles.free;

  return (
    <div className="space-y-6">

      {/* ── Profile header card ── */}
      <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-card">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-hr-100 text-xl font-bold text-hr-700">
              {initials}
            </div>
            <div className={cn(
              'absolute -bottom-1 -right-1 rounded-full border-2 border-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
              tierStyle,
            )}>
              {user.tier}
            </div>
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold tracking-tight text-surface-900 truncate">
              {user.displayName ?? 'No display name set'}
            </h2>
            <p className="text-sm text-surface-400 truncate">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                user.subscriptionStatus === 'active' ? 'text-green-600' : 'text-surface-400',
              )}>
                <span className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  user.subscriptionStatus === 'active' ? 'bg-green-500' : 'bg-surface-300',
                )} />
                {user.subscriptionStatus}
              </span>
              <span className="text-xs text-surface-300">·</span>
              <span className="text-xs text-surface-400">
                {user.aiCreditsRemaining} AI credits
              </span>
              {user.chiScore != null && (
                <>
                  <span className="text-xs text-surface-300">·</span>
                  <span className="text-xs font-semibold text-hr-600">CHI {user.chiScore}</span>
                </>
              )}
            </div>
          </div>

          {/* Edit toggle */}
          <button
            onClick={() => setEditing((prev) => !prev)}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
              editing
                ? 'border-surface-200 bg-surface-50 text-surface-600 hover:bg-surface-100'
                : 'border-hr-200 bg-hr-50 text-hr-600 hover:bg-hr-100',
            )}
          >
            {editing ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit profile
              </>
            )}
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-5 border-t border-surface-50 pt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-surface-500">Profile completeness</span>
            <span className="text-xs font-semibold text-hr-600">
              {[user.displayName, user.resumeUploaded, user.onboardingCompleted].filter(Boolean).length * 33}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-100">
            <div
              className="h-full rounded-full bg-hr-500 transition-all duration-500"
              style={{
                width: `${[user.displayName, user.resumeUploaded, user.onboardingCompleted].filter(Boolean).length * 33}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Editable fields ── */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-surface-900">Career details</h3>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-green-600 animate-fade-in">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Saved
            </span>
          )}
        </div>

        {editing ? (
          /* ── Edit mode ── */
          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Display name" placeholder="Jane Smith" value={form.name} onChange={handleChange('name')} />
              <Input label="Location" placeholder="London, UK" value={form.location} onChange={handleChange('location')} />
              <Input label="Target role" placeholder="Senior Software Engineer" value={form.targetRole} onChange={handleChange('targetRole')} />
              <Input label="Years of experience" type="number" min="0" max="50" placeholder="5" value={form.experienceYears} onChange={handleChange('experienceYears')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-800">Bio</label>
              <textarea
                rows={3}
                placeholder="A brief professional summary…"
                value={form.bio}
                onChange={handleChange('bio')}
                className="w-full resize-none rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-300 focus:border-hr-500 focus:outline-none focus:ring-2 focus:ring-hr-100 transition-colors hover:border-surface-300"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" size="sm" loading={update.isPending} disabled={update.isPending}>Save changes</Button>
            </div>
            {update.isError && (
              <p className="text-xs text-red-500 text-center animate-fade-in">Failed to save. Please try again.</p>
            )}
          </form>
        ) : (
          /* ── Read mode ── */
          <dl className="divide-y divide-surface-50 px-6">
            {[
              { label: 'Display name',   value: user.displayName },
              { label: 'Email',          value: user.email },
              { label: 'Location',       value: user.location },
              { label: 'Target role',    value: user.targetRole },
              { label: 'Experience',     value: user.experienceYears != null ? `${user.experienceYears} years` : undefined },
              { label: 'Bio',            value: user.bio },
              { label: 'Member since',   value: new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center">
                <dt className="w-40 flex-shrink-0 text-xs font-semibold text-surface-400">{label}</dt>
                <dd className="text-sm text-surface-800">
                  {value ?? <span className="italic text-surface-300">Not set</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {/* ── Read-only account info ── */}
      <div className="rounded-2xl border border-surface-100 bg-white shadow-card">
        <div className="border-b border-surface-100 px-6 py-4">
          <h3 className="text-sm font-semibold text-surface-900">Account & credits</h3>
        </div>
        <dl className="divide-y divide-surface-50 px-6">
          <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center">
            <dt className="w-40 flex-shrink-0 text-xs font-semibold text-surface-400">Plan</dt>
            <dd>
              <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', tierStyle)}>
                {user.tier}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center">
            <dt className="w-40 flex-shrink-0 text-xs font-semibold text-surface-400">AI Credits</dt>
            <dd className="text-sm text-surface-800">{user.aiCreditsRemaining} remaining</dd>
          </div>
          <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center">
            <dt className="w-40 flex-shrink-0 text-xs font-semibold text-surface-400">Resume</dt>
            <dd className="text-sm">
              {user.resumeUploaded
                ? <span className="flex items-center gap-1 text-green-600"><svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Uploaded</span>
                : <span className="text-surface-400">Not uploaded</span>
              }
            </dd>
          </div>
          {data?.credits && (
            <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-center">
              <dt className="w-40 flex-shrink-0 text-xs font-semibold text-surface-400">Quota resets</dt>
              <dd className="text-sm text-surface-800">
                {data.quota.resetDate ? new Date(data.quota.resetDate).toLocaleDateString() : '—'}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}