/**
 * POST /api/interview/evaluate
 *
 * Evaluates a user's answer to an interview question.
 * Scores 0-100 and returns structured feedback.
 *
 * Input:
 *   question      — InterviewQuestion (from /generate)
 *   userAnswer    — string — what the user actually said/typed
 *   resumeData    — ResumeContent (for personalisation context)
 *
 * Output:
 *   EvaluationResult
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { generateJSON }               from '@/lib/services/aiService';
import type { ResumeContent }         from '@/lib/supabase';
import type { InterviewQuestion, EvaluationResult } from '@/lib/interviewTypes';

// ─── Types re-exported from shared lib ──────────────────────────────────────
export type { EvaluationResult, InterviewQuestion } from '@/lib/interviewTypes';

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM = `You are Ava, an expert interview coach providing honest, constructive feedback.

SCORING RUBRIC (0-100):
  90-100: Exceptional — clear STAR structure, specific examples, quantified impact, confident tone
  75-89:  Strong — covers key points but missing some specifics or metrics
  60-74:  Adequate — answers the question but vague or generic
  40-59:  Weak — misses key points, too brief, or off-topic
  0-39:   Poor — doesn't answer the question or shows major gaps

RULES:
- Be honest but encouraging — this is coaching, not criticism
- betterAnswer must be a rewrite of THEIR answer improved, not a generic answer
- Improvements must be specific and actionable — not "be more specific"
- avaCoaching must be one concise coaching insight
- Return ONLY valid JSON`;

// ─── Grade resolver ───────────────────────────────────────────────────────────
function scoreToGrade(score: number): EvaluationResult['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: {
      question:   InterviewQuestion;
      userAnswer: string;
      resumeData: ResumeContent;
    } = await req.json();

    if (!body.question || !body.userAnswer?.trim()) {
      return NextResponse.json({ success: false, error: 'question and userAnswer are required' }, { status: 400 });
    }

    const { question, userAnswer, resumeData } = body;

    // Minimal resume context for coaching
    const resumeCtx = `Skills: ${resumeData.skills.slice(0, 10).join(', ')}. Role: ${resumeData.experience[0]?.jobTitle ?? ''}.`;

    const prompt = `INTERVIEW QUESTION: "${question.question}"
CATEGORY: ${question.category}
INTENT: ${question.intent}
KEY POINTS TO COVER: ${question.keyPoints.join(' | ')}

CANDIDATE'S ANSWER:
"${userAnswer.trim().slice(0, 1000)}"

CANDIDATE CONTEXT: ${resumeCtx}

Evaluate the answer strictly but fairly using the scoring rubric.

For keyPointsHit, evaluate whether each key point was addressed (true/false):
Key points: ${JSON.stringify(question.keyPoints)}

Return JSON:
{
  "score": <integer 0-100>,
  "strengths": ["what they did well 1", "what they did well 2"],
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "betterAnswer": "Improved version of their answer in 2-4 sentences",
  "avaCoaching": "One concise coaching insight",
  "keyPointsHit": [true/false, true/false, true/false]
}`;

    const raw = await generateJSON<Omit<EvaluationResult, 'grade'>>(
      prompt, 'fast', 1200, SYSTEM
    );

    const score = Math.min(100, Math.max(0, Math.round(raw.score ?? 50)));

    const result: EvaluationResult = {
      score,
      grade:        scoreToGrade(score),
      strengths:    Array.isArray(raw.strengths)    ? raw.strengths.slice(0, 3)    : [],
      improvements: Array.isArray(raw.improvements) ? raw.improvements.slice(0, 3) : [],
      betterAnswer: raw.betterAnswer ?? '',
      avaCoaching:  raw.avaCoaching  ?? '',
      keyPointsHit: Array.isArray(raw.keyPointsHit)
        ? raw.keyPointsHit.map(Boolean)
        : question.keyPoints.map(() => false),
    };

    return NextResponse.json({ success: true, data: result });

  } catch (err: any) {
    console.error('[/api/interview/evaluate]', err.message);
    return NextResponse.json({ success: false, error: err.message ?? 'Evaluation failed' }, { status: 500 });
  }
}