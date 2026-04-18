/**
 * POST /api/interview/generate
 *
 * Generates role-specific, resume-personalised interview questions
 * with suggested answers and improvement tips.
 *
 * Input:
 *   resumeData   — ResumeContent (personalises questions to actual experience)
 *   job          — { title, description?, requiredSkills?, experienceLevel? }
 *   count?       — number of questions to generate (default 8, max 15)
 *   categories?  — question categories to include (default: all)
 *
 * Output:
 *   questions[]  — InterviewQuestion array
 *   role         — resolved role string
 *   difficulty   — 'entry' | 'mid' | 'senior'
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { generateJSON }               from '@/lib/services/aiService';
import type { ResumeContent }         from '@/lib/supabase';

// ─── Shared types (imported from lib) ────────────────────────────────────────
import type { InterviewQuestion, GenerateInterviewResult, QuestionCategory } from '@/lib/interviewTypes';

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM = `You are Ava, an expert career coach and interview preparation specialist.
Your task is to generate realistic, role-specific interview questions with personalised guidance.

RULES:
- Base suggested answers ONLY on what is actually in the resume — do NOT fabricate experience
- Each suggested answer must reference specific details from the resume (company names, skills, roles)
- Questions must be realistic — what a real interviewer at that level would ask
- Tips must be actionable and specific to the question, not generic advice
- Return ONLY valid JSON — no markdown, no explanation`;

// ─── Difficulty resolver ──────────────────────────────────────────────────────
function resolveDifficulty(expLevel?: string, resumeYears?: number): 'entry' | 'mid' | 'senior' {
  if (expLevel === 'senior' || expLevel === 'lead') return 'senior';
  if (expLevel === 'entry') return 'entry';
  if (expLevel === 'mid') return 'mid';
  const yrs = resumeYears ?? 0;
  if (yrs >= 6) return 'senior';
  if (yrs >= 2) return 'mid';
  return 'entry';
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: {
      resumeData:   ResumeContent;
      job:          { title: string; description?: string; requiredSkills?: string[]; experienceLevel?: string };
      count?:       number;
      categories?:  QuestionCategory[];
    } = await req.json();

    if (!body.resumeData || !body.job?.title) {
      return NextResponse.json({ success: false, error: 'resumeData and job.title are required' }, { status: 400 });
    }

    const { resumeData, job } = body;
    const count       = Math.min(body.count ?? 8, 15);
    const categories  = body.categories ?? ['behavioural', 'technical', 'situational', 'motivation', 'strength_gap'];

    // Estimate experience from resume
    const periods = resumeData.experience.map(e => e.period).join(' ');
    const years   = (periods.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number).sort((a, b) => a - b);
    const resumeYears = years.length >= 2 ? years[years.length - 1] - years[0] : resumeData.experience.length * 2;
    const difficulty  = resolveDifficulty(job.experienceLevel, resumeYears);

    // Build resume summary for the prompt (avoid sending full JSON — keeps tokens lean)
    const resumeSummary = [
      `Name: ${resumeData.personalInfo?.name || 'Candidate'}`,
      `Current/Last Role: ${resumeData.experience[0]?.jobTitle ?? 'N/A'} at ${resumeData.experience[0]?.company ?? 'N/A'}`,
      `Experience: ${resumeData.experience.map(e => `${e.jobTitle} at ${e.company} (${e.period})`).join('; ')}`,
      `Skills: ${resumeData.skills.slice(0, 15).join(', ')}`,
      `Summary: ${resumeData.summary?.slice(0, 300) ?? 'N/A'}`,
      `Key achievements: ${resumeData.experience.flatMap(e => e.bullets).slice(0, 6).join(' | ')}`,
    ].join('\n');

    const prompt = `TARGET ROLE: ${job.title}
EXPERIENCE LEVEL: ${difficulty}
${job.requiredSkills?.length ? `REQUIRED SKILLS: ${job.requiredSkills.join(', ')}` : ''}
${job.description ? `JOB DESCRIPTION (excerpt): ${job.description.slice(0, 400)}` : ''}

CANDIDATE RESUME SUMMARY:
${resumeSummary}

Generate exactly ${count} interview questions covering these categories proportionally: ${categories.join(', ')}.

For each question, the suggestedAnswer MUST reference specific details from the resume above (real companies, real skills, real achievements). Do NOT invent new experience.

Return JSON:
{
  "questions": [
    {
      "id": "q1",
      "category": "behavioural",
      "question": "...",
      "intent": "What the interviewer is testing in 1 sentence",
      "suggestedAnswer": "3-5 sentence personalised answer using the candidate's real experience",
      "keyPoints": ["point 1", "point 2", "point 3"],
      "tips": ["specific tip 1", "specific tip 2"],
      "difficulty": "medium"
    }
  ]
}`;

    const raw = await generateJSON<{ questions: InterviewQuestion[] }>(
      prompt, 'capable', 3000, SYSTEM
    );

    // Validate and sanitise
    const questions = (raw.questions ?? []).slice(0, count).map((q, i) => ({
      id:              q.id ?? `q${i + 1}`,
      category:        q.category ?? 'behavioural',
      question:        q.question ?? '',
      intent:          q.intent ?? '',
      suggestedAnswer: q.suggestedAnswer ?? '',
      keyPoints:       Array.isArray(q.keyPoints) ? q.keyPoints : [],
      tips:            Array.isArray(q.tips) ? q.tips : [],
      difficulty:      q.difficulty ?? 'medium',
    }));

    return NextResponse.json({
      success: true,
      data: { questions, role: job.title, difficulty } satisfies GenerateInterviewResult,
    });

  } catch (err: any) {
    console.error('[/api/interview/generate]', err.message);
    return NextResponse.json({ success: false, error: err.message ?? 'Generation failed' }, { status: 500 });
  }
}