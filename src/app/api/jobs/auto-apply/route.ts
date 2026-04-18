/**
 * POST /api/jobs/auto-apply
 *
 * Flow:
 *   1. Validate inputs
 *   2. Run job-specific auto-fix (reuses /api/resume/auto-fix logic inline)
 *   3. Re-score the fixed resume against the job
 *   4. Save application record via backend /api/v1/applications
 *   5. Track Ava memory event
 *   6. Return full result
 *
 * Input:
 *   resumeData    — current ResumeContent
 *   job           — { title, description?, requiredSkills?, experienceLevel? }
 *   resumeId?     — Supabase resume row id
 *   companyName?  — company name for application record
 *   jobUrl?       — link to job posting
 *
 * Output:
 *   applicationId   — Firestore doc id
 *   tailoredResume  — job-specific fixed ResumeContent
 *   matchBefore     — match score before fix
 *   matchAfter      — match score after fix
 *   scoreIncrease   — delta
 *   improvementsSummary  — what Ava changed
 *   avaFollowUp     — array of follow-up suggestion strings
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { calculateATS }               from '@/lib/services/atsService';
import { generateJSON }               from '@/lib/services/aiService';
import { persistResume }              from '@/lib/services/resumePipeline';
import type { ResumeContent, AtsBreakdown } from '@/lib/supabase';

// ─── JobInput (inlined — cannot import from sibling Next.js route) ───────────
export interface JobInput {
  title:            string;
  description?:     string;
  requiredSkills?:  string[];
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'any';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutoApplyResult {
  applicationId:      string;
  tailoredResume:     ResumeContent;
  atsBefore:          AtsBreakdown;
  atsAfter:           AtsBreakdown;
  matchBefore:        number;
  matchAfter:         number;
  scoreIncrease:      number;
  improvementsSummary: string[];
  avaFollowUp:        string[];
}

// ─── Job-specific system prompt (extends auto-fix with job context) ────────────
const SYSTEM_PROMPT = `You are Ava, an expert resume optimizer and ATS specialist.
Your task is to tailor a resume for a specific job posting.

PRIORITY ORDER:
1. Add required skills from the job posting naturally into the skills section and bullets
2. Rewrite 2-3 bullet points to directly mirror language from the job description
3. Update the professional summary to mention the target role and company fit
4. Inject missing keywords from the job posting naturally

STRICT RULES:
- Do NOT fabricate experience, companies, dates, or degrees
- Do NOT invent metrics — use "significantly", "consistently", "effectively" if no numbers exist
- Do NOT keyword stuff — all additions must read naturally
- Preserve personalInfo fields exactly
- Return ONLY valid JSON — no markdown, no explanation`;

// ─── Core tailoring function ──────────────────────────────────────────────────

async function tailorResumeForJob(
  resumeData: ResumeContent,
  job:        JobInput,
  atsBefore:  AtsBreakdown,
): Promise<{ tailored: ResumeContent; improvementsSummary: string[] }> {
  const missingSkills = (job.requiredSkills ?? [])
    .filter((s: string) => !resumeData.skills.map((r: string) => r.toLowerCase()).includes(s.toLowerCase()))
    .slice(0, 6)
    .join(', ');

  const missingKw = atsBefore.missingKeywords.slice(0, 6).join(', ') || 'none';

  const prompt = `TARGET JOB: ${job.title}
${job.description ? `\nJOB DESCRIPTION (first 600 chars):\n${job.description.slice(0, 600)}` : ''}
${missingSkills ? `\nREQUIRED SKILLS TO ADD (if genuinely relevant): ${missingSkills}` : ''}
MISSING ATS KEYWORDS: ${missingKw}
CURRENT ATS SCORE: ${atsBefore.overall}/100

RESUME TO TAILOR:
${JSON.stringify(resumeData, null, 2)}

Return JSON:
{
  "tailored": { ...same structure, personalInfo UNCHANGED },
  "improvementsSummary": ["change 1", "change 2", "change 3"]
}`;

  interface Raw { tailored: ResumeContent; improvementsSummary: string[] }
  const raw = await generateJSON<Raw>(prompt, 'fast', 2200, SYSTEM_PROMPT);

  const tailored: ResumeContent = {
    ...raw.tailored,
    personalInfo: resumeData.personalInfo,
    targetRole:   job.title || resumeData.targetRole,
  };

  return {
    tailored,
    improvementsSummary: Array.isArray(raw.improvementsSummary) ? raw.improvementsSummary : [],
  };
}

// ─── Job match score (inline — same weights as /api/jobs/match) ───────────────
function quickJobMatchScore(resume: ResumeContent, job: JobInput, ats: AtsBreakdown): number {
  const resumeText = [
    resume.summary,
    ...resume.skills,
    ...resume.experience.flatMap(e => [e.jobTitle, ...e.bullets]),
  ].join(' ').toLowerCase();

  const required = job.requiredSkills ?? [];
  const skillScore = required.length === 0 ? 60
    : Math.round(required.filter((s: string) => resumeText.includes(s.toLowerCase())).length / required.length * 100);

  return Math.min(100, Math.round(skillScore * 0.40 + ats.keywordMatch * 0.30 + 80 * 0.20 + ats.overall * 0.10));
}

// ─── Ava follow-up suggestions ────────────────────────────────────────────────
function buildAvaFollowUp(matchAfter: number, improvementsSummary: string[], jobTitle: string): string[] {
  const tips: string[] = [];

  if (matchAfter >= 75) {
    tips.push(`Great match! Your tailored resume is ready. Apply to similar ${jobTitle} roles to maximise your chances.`);
    tips.push('Follow up 5–7 days after applying with a brief email expressing continued interest.');
  } else if (matchAfter >= 50) {
    tips.push(`You're a good fit! Adding the missing skills from this listing will push you above 75%.`);
    tips.push('Consider preparing answers for common interview questions for this role while you wait.');
  } else {
    tips.push('Your resume has been optimised as much as possible — consider upskilling in the top missing areas.');
    tips.push('Apply to similar roles with slightly lower experience requirements to build track record.');
  }

  tips.push('Track your application status in My Applications — follow up if no response in 2 weeks.');
  return tips;
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Auth
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: {
      resumeData:   ResumeContent;
      job:          JobInput;
      companyName?: string;
      jobUrl?:      string;
      resumeId?:    string | null;
    } = await req.json();

    if (!body.resumeData) return NextResponse.json({ success: false, error: 'resumeData is required' }, { status: 400 });
    if (!body.job?.title)  return NextResponse.json({ success: false, error: 'job.title is required' }, { status: 400 });

    const { resumeData, job } = body;
    const companyName = body.companyName || 'Unknown Company';

    // ── Step 1: Baseline scores ───────────────────────────────────────────────
    const atsBefore  = calculateATS(resumeData, job.title);
    const matchBefore = quickJobMatchScore(resumeData, job, atsBefore);

    // ── Step 2: Job-specific resume tailoring (AI) ────────────────────────────
    const { tailored, improvementsSummary } = await tailorResumeForJob(resumeData, job, atsBefore);

    // ── Step 3: Recalculate scores on tailored resume ─────────────────────────
    const atsAfter   = calculateATS(tailored, job.title);
    const matchAfter  = quickJobMatchScore(tailored, job, atsAfter);
    const scoreIncrease = Math.max(0, matchAfter - matchBefore);

    // ── Step 4: Persist tailored resume to Supabase ───────────────────────────
    persistResume(uid, tailored, atsAfter, job.title, 'modern', null, body.resumeId)
      .catch(() => {/* non-fatal */});

    // ── Step 5: Save application record to backend ────────────────────────────
    // Calls the existing /api/v1/applications endpoint which enforces tier caps
    // and writes to Firestore jobApplications collection.
    let applicationId = `local_${Date.now()}`; // fallback if backend call fails
    try {
      const apiBase = process.env.INTERNAL_API_BASE_URL
        ?? `http://localhost:${process.env.PORT ?? 3001}`;

      // Get the user's Firebase token to forward to the backend API
      // We use the same token from the incoming request
      const backendRes = await fetch(`${apiBase}/api/v1/applications`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          companyName,
          jobTitle:    job.title,
          emailSentTo: resumeData.personalInfo?.email || '',
          appliedDate: new Date().toISOString(),
          status:      'applied',
          source:      'Other',
          notes:       `Auto-applied via Ava. Match score: ${matchAfter}%. Score increase: +${scoreIncrease}%.`,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (backendRes.ok) {
        const backendJson = await backendRes.json();
        applicationId = backendJson?.data?.id ?? applicationId;
      }
    } catch {
      // Non-fatal — we still return a successful result even if backend record fails
      console.warn('[auto-apply] Application record save failed — continuing');
    }

    // ── Step 6: Ava follow-up suggestions ─────────────────────────────────────
    const avaFollowUp = buildAvaFollowUp(matchAfter, improvementsSummary, job.title);

    const result: AutoApplyResult = {
      applicationId,
      tailoredResume: tailored,
      atsBefore,
      atsAfter,
      matchBefore,
      matchAfter,
      scoreIncrease,
      improvementsSummary,
      avaFollowUp,
    };

    return NextResponse.json({ success: true, data: result });

  } catch (err: any) {
    console.error('[/api/jobs/auto-apply]', err.message);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Auto-apply failed' },
      { status: 500 },
    );
  }
}