/**
 * POST /api/jobs/match
 *
 * Job-specific match engine. Pure code — no LLM call, < 200 ms.
 *
 * Scoring weights (spec):
 *   Skills match      40%
 *   Keyword match     30%
 *   Experience match  20%
 *   ATS score         10%
 *
 * Input:
 *   resumeData       — ResumeContent
 *   job              — { title, description, requiredSkills, experienceLevel }
 *
 * Output:
 *   matchScore        — 0-100 composite
 *   breakdown         — per-dimension scores
 *   missingSkills     — skills in job.requiredSkills not found in resume
 *   matchedSkills     — skills found in both
 *   missingKeywords   — keywords from job description not in resume text
 *   insights          — string[] actionable insights
 *   ctaType           — 'fix_resume' | 'improve_match' | 'apply_now'
 *   ctaLabel          — display label for the CTA button
 *   ctaHref           — destination URL
 *   atsBreakdown      — full AtsBreakdown (for connecting to auto-fix)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { calculateATS, getRoleKeywords } from '@/lib/services/atsService';
import type { ResumeContent, AtsBreakdown } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobInput {
  title:           string;
  description?:    string;
  requiredSkills?: string[];
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'any';
}

export interface JobMatchBreakdown {
  skillsMatch:      number;  // 40%
  keywordMatch:     number;  // 30%
  experienceMatch:  number;  // 20%
  atsScore:         number;  // 10% (normalised)
}

export interface JobMatchResult {
  matchScore:      number;
  breakdown:       JobMatchBreakdown;
  missingSkills:   string[];
  matchedSkills:   string[];
  missingKeywords: string[];
  insights:        string[];
  ctaType:         'fix_resume' | 'improve_match' | 'apply_now';
  ctaLabel:        string;
  ctaHref:         string;
  atsBreakdown:    AtsBreakdown;
}

// ─── Experience level → years band ───────────────────────────────────────────
const EXP_BANDS: Record<string, [number, number]> = {
  entry:  [0, 2],
  mid:    [2, 6],
  senior: [5, 12],
  lead:   [8, 99],
  any:    [0, 99],
};

function estimateResumeYears(resume: ResumeContent): number {
  // Heuristic: count distinct year tokens in experience periods
  const periods = resume.experience.map(e => e.period).join(' ');
  const years = periods.match(/\b(19|20)\d{2}\b/g) ?? [];
  if (years.length < 2) return resume.experience.length > 0 ? 2 : 0;
  const nums = years.map(Number).sort((a, b) => a - b);
  return nums[nums.length - 1] - nums[0];
}

function scoreExperienceMatch(resume: ResumeContent, level?: string): number {
  if (!level || level === 'any') return 80; // neutral — don't penalise
  const band = EXP_BANDS[level] ?? [0, 99];
  const yoe  = estimateResumeYears(resume);
  if (yoe >= band[0] && yoe <= band[1]) return 100;
  const gap = yoe < band[0] ? band[0] - yoe : yoe - band[1];
  return Math.max(0, 100 - gap * 15); // -15 pts per year off the band
}

// ─── Skills scoring ───────────────────────────────────────────────────────────
function normaliseSkill(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9.+#]/g, ' ').replace(/\s+/g, ' ').trim();
}

function skillsInResume(resume: ResumeContent): Set<string> {
  const fullText = [
    resume.summary,
    ...resume.skills,
    ...resume.experience.flatMap(e => [e.jobTitle, ...e.bullets]),
  ].join(' ').toLowerCase();

  return new Set(
    resume.skills.map(normaliseSkill)
      .concat(
        // also extract from full text for broader coverage
        resume.experience.flatMap(e => e.bullets)
          .join(' ').toLowerCase()
          .split(/[\s,;]+/)
          .filter(w => w.length > 2)
      )
  );
}

function scoreSkillsMatch(resume: ResumeContent, requiredSkills: string[]): {
  score: number; matched: string[]; missing: string[];
} {
  if (requiredSkills.length === 0) return { score: 60, matched: [], missing: [] };

  const resumeText = [
    resume.summary,
    ...resume.skills,
    ...resume.experience.flatMap(e => [...e.bullets, e.jobTitle]),
  ].join(' ').toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of requiredSkills) {
    const norm = normaliseSkill(skill);
    // Flexible match: full skill OR any meaningful token within it
    const tokens = norm.split(/\s+/).filter(t => t.length > 2);
    const found  = resumeText.includes(norm) || tokens.every(t => resumeText.includes(t));
    if (found) matched.push(skill);
    else       missing.push(skill);
  }

  return {
    score:   Math.round((matched.length / requiredSkills.length) * 100),
    matched,
    missing,
  };
}

// ─── Keyword scoring against job description ──────────────────────────────────
function scoreJobKeywords(resume: ResumeContent, job: JobInput): {
  score: number; missing: string[];
} {
  // Merge role keywords from ATS engine + keywords extracted from job description
  const roleKws = getRoleKeywords(job.title);

  // Extract meaningful terms from job description (4+ char words, deduplicated)
  const descKws: string[] = job.description
    ? [...new Set(
        job.description
          .toLowerCase()
          .replace(/[^a-z0-9\s.+#]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length >= 4 && !/^(with|that|this|have|from|will|your|they|been|were|into|more|than|when|also|each|over|such|then|some|them|what|which|after|about|these|their|there|using|other|would|could|should|must|only|both|very|well|need|want|make|take)$/.test(w))
      )]
    : [];

  // Combine: role keywords + top 15 job description terms
  const allKws = [...new Set([...roleKws, ...descKws.slice(0, 15)])];

  const resumeText = [
    resume.summary,
    ...resume.skills,
    ...resume.experience.flatMap(e => [e.jobTitle, e.company, ...e.bullets]),
  ].join(' ').toLowerCase();

  const missing = allKws.filter(kw => !resumeText.includes(kw.toLowerCase()));
  const matched  = allKws.length - missing.length;

  return {
    score:   allKws.length ? Math.round((matched / allKws.length) * 100) : 60,
    missing: missing.slice(0, 8),
  };
}

// ─── Insights generator ───────────────────────────────────────────────────────
function buildInsights(
  matchScore:     number,
  breakdown:      JobMatchBreakdown,
  missingSkills:  string[],
  missingKws:     string[],
  job:            JobInput,
): string[] {
  const insights: string[] = [];

  // Skills gap
  if (missingSkills.length > 0) {
    const top = missingSkills.slice(0, 3).join(', ');
    insights.push(`You're missing ${missingSkills.length} required skill${missingSkills.length > 1 ? 's' : ''}: ${top}${missingSkills.length > 3 ? ' and more' : ''}.`);
  }

  // Keyword gap
  if (breakdown.keywordMatch < 50 && missingKws.length > 0) {
    insights.push(`Your resume lacks key terms from this job listing. Add: ${missingKws.slice(0, 3).join(', ')}.`);
  }

  // Experience mismatch
  if (breakdown.experienceMatch < 60 && job.experienceLevel) {
    const labels: Record<string, string> = { entry:'entry-level', mid:'mid-level', senior:'senior', lead:'lead/manager' };
    insights.push(`This role requires ${labels[job.experienceLevel] ?? job.experienceLevel} experience. Adjust your resume to emphasise relevant seniority.`);
  }

  // ATS score low
  if (breakdown.atsScore < 50) {
    insights.push('Your overall resume ATS score is low — run Auto-Fix to improve structure and keyword density.');
  }

  // Strong match
  if (matchScore >= 75) {
    insights.push("Strong match — your profile aligns well. Tailor your summary to mention this role directly before applying.");
  } else if (matchScore >= 55) {
    insights.push("Good foundation — close a few skill gaps to become a top applicant for this role.");
  } else {
    insights.push("Below average match — focus on adding the missing skills and optimising your resume for this role.");
  }

  return insights.slice(0, 4);
}

// ─── CTA logic ────────────────────────────────────────────────────────────────
function buildCta(matchScore: number, jobTitle: string): {
  ctaType: JobMatchResult['ctaType'];
  ctaLabel: string;
  ctaHref: string;
} {
  const role = encodeURIComponent(jobTitle);
  if (matchScore < 45) return {
    ctaType:  'fix_resume',
    ctaLabel: '⚡ Auto-Fix Resume for This Role',
    ctaHref:  `/resume-builder?source=job-match&role=${role}`,
  };
  if (matchScore < 70) return {
    ctaType:  'improve_match',
    ctaLabel: '🎯 Improve My Match',
    ctaHref:  `/resume-builder?source=job-match&role=${role}`,
  };
  return {
    ctaType:  'apply_now',
    ctaLabel: '🚀 Apply Now',
    ctaHref:  `/job-matches?source=job-match&role=${role}`,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: { resumeData: ResumeContent; job: JobInput } = await req.json();

    if (!body.resumeData) return NextResponse.json({ success: false, error: 'resumeData is required' }, { status: 400 });
    if (!body.job?.title)  return NextResponse.json({ success: false, error: 'job.title is required' }, { status: 400 });

    const { resumeData, job } = body;

    // ── Skills match (40%) ────────────────────────────────────────────────────
    const { score: skillsMatch, matched: matchedSkills, missing: missingSkills } =
      scoreSkillsMatch(resumeData, job.requiredSkills ?? []);

    // ── Keyword match (30%) ───────────────────────────────────────────────────
    const { score: keywordMatch, missing: missingKeywords } =
      scoreJobKeywords(resumeData, job);

    // ── Experience match (20%) ────────────────────────────────────────────────
    const experienceMatch = scoreExperienceMatch(resumeData, job.experienceLevel);

    // ── ATS score (10%) — calculated against job title ────────────────────────
    const atsBreakdown = calculateATS(resumeData, job.title);
    const atsScore     = atsBreakdown.overall;

    // ── Composite score ───────────────────────────────────────────────────────
    const matchScore = Math.min(100, Math.round(
      skillsMatch    * 0.40 +
      keywordMatch   * 0.30 +
      experienceMatch * 0.20 +
      atsScore       * 0.10
    ));

    const breakdown: JobMatchBreakdown = {
      skillsMatch,
      keywordMatch,
      experienceMatch,
      atsScore,
    };

    // ── Insights ──────────────────────────────────────────────────────────────
    const insights = buildInsights(matchScore, breakdown, missingSkills, missingKeywords, job);

    // ── CTA ───────────────────────────────────────────────────────────────────
    const cta = buildCta(matchScore, job.title);

    const result: JobMatchResult = {
      matchScore,
      breakdown,
      missingSkills,
      matchedSkills,
      missingKeywords,
      insights,
      atsBreakdown,
      ...cta,
    };

    return NextResponse.json({ success: true, data: result });

  } catch (err: any) {
    console.error('[/api/jobs/match]', err.message);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Match failed' },
      { status: 500 },
    );
  }
}
