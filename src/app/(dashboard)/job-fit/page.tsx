'use client';

/**
 * app/(dashboard)/job-fit/page.tsx — Job Fit Analyzer (Premium Feature)
 *
 * Allows paid users to paste a job description and get:
 * - jobFitScore (0-100)
 * - matchedSkills[]
 * - missingSkills[]
 * - fitSummary
 * - topRecommendations[]
 *
 * Free users see an upgrade prompt.
 */

import { useState } from 'react';
import { useAuth }  from '@/features/auth/components/AuthProvider';
import { useProfile } from '@/hooks/useProfile';
import { apiFetch } from '@/services/apiClient';
import { cn } from '@/utils/cn';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobFitResult {
  analysisId:         string;
  jobTitle:           string;
  jobFitScore:        number;
  matchedSkills:      string[];
  missingSkills:      string[];
  fitSummary:         string;
  topRecommendations: string[];
  jobSkills:          string[];
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const circ  = 2 * Math.PI * 38;
  const dash  = (score / 100) * circ;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#f87171';
  const label = score >= 75 ? 'Strong fit' : score >= 50 ? 'Good fit' : score >= 35 ? 'Moderate fit' : 'Weak fit';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex h-28 w-28 items-center justify-center">
        <svg className="-rotate-90 h-28 w-28" viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="38" fill="none" stroke="#f1f5f9" strokeWidth="7" />
          <circle cx="45" cy="45" r="38" fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div className="absolute text-center">
          <p className="text-3xl font-bold text-surface-900">{score}</p>
          <p className="text-[10px] text-surface-400">/100</p>
        </div>
      </div>
      <span className={cn(
        'rounded-full px-3 py-1 text-xs font-semibold',
        score >= 75 ? 'bg-green-100 text-green-700' :
        score >= 50 ? 'bg-amber-100 text-amber-700' :
        score >= 35 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700',
      )}>
        {label}
      </span>
    </div>
  );
}

// ─── Skill pill ───────────────────────────────────────────────────────────────

function SkillPill({ skill, variant }: { skill: string; variant: 'matched' | 'missing' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
      variant === 'matched'
        ? 'bg-green-50 text-green-700 border border-green-100'
        : 'bg-red-50 text-red-600 border border-red-100',
    )}>
      {variant === 'matched'
        ? <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
        : <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
      }
      {skill}
    </span>
  );
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
      <h2 className="text-lg font-bold text-surface-900">Job Fit Analyzer is a Premium Feature</h2>
      <p className="mt-2 max-w-sm text-sm text-surface-500">
        Upgrade to Pro or Enterprise to analyze your fit for any job and get personalized skill recommendations.
      </p>
      <Link href="/settings"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-hr-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-hr-700 transition-colors shadow-sm">
        Upgrade to Pro →
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobFitPage() {
  const { data: profileData, isLoading: profileLoading } = useProfile();
  const profileUser = profileData?.user ?? null;
  const isPaidUser  = profileUser?.tier === 'pro' || profileUser?.tier === 'enterprise';

  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl]                 = useState('');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [result, setResult]                 = useState<JobFitResult | null>(null);

  if (profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hr-200 border-t-hr-600" />
      </div>
    );
  }

  if (!isPaidUser) return <UpgradeWall />;

  const handleAnalyze = async () => {
    if (!jobDescription.trim() && !jobUrl.trim()) {
      setError('Please paste a job description or enter a job URL.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ analysis: JobFitResult }>('/job-analyses', {
        method: 'POST',
        body: JSON.stringify({ jobDescription: jobDescription.trim() || undefined, jobUrl: jobUrl.trim() || undefined }),
      });
      setResult(data.analysis);
    } catch (err: any) {
      setError(err?.message ?? 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slide-up space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-surface-900">Job Fit Analyzer</h2>
        <p className="mt-0.5 text-sm text-surface-400">
          Paste a job description to see how well your skills match.
        </p>
      </div>

      {/* Input card */}
      {!result && (
        <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-card space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1.5">
              Job URL <span className="font-normal text-surface-400">(optional)</span>
            </label>
            <input
              type="url"
              value={jobUrl}
              onChange={e => setJobUrl(e.target.value)}
              placeholder="https://company.com/careers/role"
              className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-300 focus:border-hr-400 focus:outline-none focus:ring-2 focus:ring-hr-100"
            />
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
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-hr-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-hr-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyzing…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Analyze Job Fit
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Score summary */}
          <div className="rounded-2xl border border-surface-100 bg-white p-6 shadow-card">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <ScoreRing score={result.jobFitScore} />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-1">
                  {result.jobTitle || 'Job Analysis'}
                </p>
                <p className="text-sm text-surface-700 leading-relaxed">{result.fitSummary}</p>
              </div>
            </div>
          </div>

          {/* Skills breakdown */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-green-100 bg-white p-5 shadow-card">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-3">
                Matched Skills ({result.matchedSkills.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.matchedSkills.length > 0
                  ? result.matchedSkills.map(s => <SkillPill key={s} skill={s} variant="matched" />)
                  : <p className="text-xs text-surface-400">No matches found</p>
                }
              </div>
            </div>
            <div className="rounded-xl border border-red-100 bg-white p-5 shadow-card">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-3">
                Missing Skills ({result.missingSkills.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {result.missingSkills.length > 0
                  ? result.missingSkills.map(s => <SkillPill key={s} skill={s} variant="missing" />)
                  : <p className="text-xs text-surface-400">No gaps identified</p>
                }
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {result.topRecommendations.length > 0 && (
            <div className="rounded-xl border border-hr-100 bg-hr-50/40 p-5 shadow-card">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-3">
                Top Recommendations
              </h3>
              <ol className="space-y-2">
                {result.topRecommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-surface-700">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-hr-100 text-[10px] font-bold text-hr-700 mt-0.5">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* New analysis button */}
          <button
            onClick={() => { setResult(null); setJobDescription(''); setJobUrl(''); }}
            className="text-sm font-semibold text-hr-600 hover:text-hr-700 transition-colors"
          >
            ← Analyze another job
          </button>
        </div>
      )}
    </div>
  );
}