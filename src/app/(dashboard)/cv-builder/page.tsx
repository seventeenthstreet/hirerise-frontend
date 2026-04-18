'use client';

/**
 * app/(dashboard)/cv-builder/page.tsx — Custom CV Builder (Premium Feature)
 *
 * Allows paid users to generate a tailored CV version by:
 * 1. Pasting a job description
 * 2. Getting an optimized CV with reordered experience, highlighted skills,
 *    and a tailored summary
 *
 * Free users see an upgrade prompt.
 */

import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { apiFetch } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExperienceEntry {
  jobTitle:          string;
  company:           string;
  period:            string;
  optimizedBullets:  string[];
}

interface CvVersionResult {
  cvVersionId:         string;
  jobTitle:            string;
  optimizedSummary:    string;
  extractedKeywords:   string[];
  highlightedSkills:   string[];
  reorderedExperience: ExperienceEntry[];
  keywordMatchScore:   number;
  optimizationNotes:   string[];
}

// ─── Upgrade wall ─────────────────────────────────────────────────────────────

function UpgradeWall() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
        <svg className="h-8 w-8 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-surface-900">Custom CV Builder is a Premium Feature</h2>
      <p className="mt-2 max-w-sm text-sm text-surface-500">
        Upgrade to Pro or Enterprise to generate tailored CV versions optimised for specific job descriptions.
      </p>
      <Link href="/settings"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-hr-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-hr-700 transition-colors shadow-sm">
        Upgrade to Pro →
      </Link>
    </div>
  );
}

// ─── Keyword match score badge ────────────────────────────────────────────────

function MatchScore({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return (
    <span className={cn('rounded-full px-3 py-1 text-xs font-bold', color)}>
      {score}% keyword match
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CvBuilderPage() {
  const { data: profileData, isLoading: profileLoading } = useProfile();
  const profileUser = profileData?.user ?? null;
  const isPaidUser  = profileUser?.tier === 'pro' || profileUser?.tier === 'enterprise';

  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle]             = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [result, setResult]                 = useState<CvVersionResult | null>(null);

  if (profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hr-200 border-t-hr-600" />
      </div>
    );
  }

  if (!isPaidUser) return <UpgradeWall />;

  const handleGenerate = async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 50) {
      setError('Please paste a job description of at least 50 characters.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ cvVersion: CvVersionResult }>('/cv-builder', {
        method: 'POST',
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          jobTitle: jobTitle.trim() || undefined,
        }),
      });
      setResult(data.cvVersion);
    } catch (err: any) {
      setError(err?.message ?? 'CV generation failed. Please ensure your resume is uploaded and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slide-up space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-surface-900">Custom CV Builder</h2>
        <p className="mt-0.5 text-sm text-surface-400">
          Generate a job-tailored CV version with optimised wording and keyword matching.
        </p>
      </div>

      {/* Input */}
      {!result && (
        <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-card space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-surface-700 mb-1.5">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-300 focus:border-hr-400 focus:outline-none focus:ring-2 focus:ring-hr-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1.5">
              Job Description <span className="font-normal text-surface-400">(paste full JD for best results)</span>
            </label>
            <textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              rows={10}
              placeholder="Paste the job description here…"
              className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2.5 text-sm text-surface-900 placeholder-surface-300 focus:border-hr-400 focus:outline-none focus:ring-2 focus:ring-hr-100 resize-none"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">{error}</p>
          )}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-hr-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-hr-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generating CV…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Generate Tailored CV
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">

          {/* Summary card */}
          <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-card space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold text-surface-900">{result.jobTitle || 'Tailored CV'}</h3>
              <MatchScore score={result.keywordMatchScore} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 mb-1.5">Optimized Summary</p>
              <p className="text-sm text-surface-700 leading-relaxed bg-surface-50 rounded-lg p-3 border border-surface-100">
                {result.optimizedSummary}
              </p>
            </div>
          </div>

          {/* Highlighted skills + keywords */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {result.highlightedSkills.length > 0 && (
              <div className="rounded-xl border border-hr-100 bg-white p-5 shadow-card">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 mb-3">
                  Priority Skills ({result.highlightedSkills.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.highlightedSkills.map(s => (
                    <span key={s} className="rounded-full bg-hr-50 border border-hr-100 px-2.5 py-1 text-xs font-medium text-hr-700">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.extractedKeywords.length > 0 && (
              <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card">
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 mb-3">
                  Job Keywords ({result.extractedKeywords.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {result.extractedKeywords.map(k => (
                    <span key={k} className="rounded-full bg-surface-50 border border-surface-100 px-2.5 py-1 text-xs text-surface-600">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reordered experience */}
          {result.reorderedExperience.length > 0 && (
            <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card space-y-4">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">
                Optimized Experience
              </h3>
              {result.reorderedExperience.map((exp, i) => (
                <div key={i} className="border-l-2 border-hr-100 pl-4 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-surface-900">{exp.jobTitle}</p>
                    {exp.company && <span className="text-xs text-surface-400">· {exp.company}</span>}
                    {exp.period  && <span className="text-xs text-surface-400">· {exp.period}</span>}
                  </div>
                  <ul className="space-y-1 mt-1.5">
                    {exp.optimizedBullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-1.5 text-xs text-surface-600">
                        <span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-hr-400" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Optimization notes */}
          {result.optimizationNotes.length > 0 && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4 shadow-card">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-surface-400 mb-2">
                What was changed
              </h3>
              <ul className="space-y-1">
                {result.optimizationNotes.map((note, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-surface-600">
                    <span className="shrink-0 mt-1.5 h-1 w-1 rounded-full bg-amber-400" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reset */}
          <button
            onClick={() => { setResult(null); setJobDescription(''); setJobTitle(''); }}
            className="text-sm font-semibold text-hr-600 hover:text-hr-700 transition-colors"
          >
            ← Generate another version
          </button>
        </div>
      )}
    </div>
  );
}