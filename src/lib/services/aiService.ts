/**
 * lib/services/aiService.ts
 *
 * All LLM calls go through generateJSON().
 * Tries each configured provider in order — if one fails (credits, rate limit,
 * timeout, bad response), it moves to the next automatically.
 *
 * Providers tried in order (only those with API keys set):
 *   1. Gemini   (GEMINI_API_KEY)
 *   2. Groq     (GROQ_API_KEY)
 *   3. Mistral  (MISTRAL_API_KEY)
 *   4. OpenRouter (OPENROUTER_API_KEY)
 *   5. Anthropic  (ANTHROPIC_API_KEY)
 */

import {
  getActiveProviders,
  getClientForProvider,
  type ModelTier,
  type ProviderConfig,
} from '@/lib/openai';
import type { ResumeContent, ResumeExperience } from '@/lib/supabase';

// ─── JSON extraction helper ───────────────────────────────────────────────────

function extractJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[1]) as T; } catch { /* fall through */ }
    }
    throw new Error(`JSON parse failed. Raw (first 300 chars): ${raw.slice(0, 300)}`);
  }
}

// ─── Core: generateJSON with provider fallback ────────────────────────────────

/**
 * Call the LLM and return typed JSON.
 * Iterates through all active providers until one succeeds.
 * Logs which provider was used (and which failed) for observability.
 */
export async function generateJSON<T>(
  prompt:               string,
  tier:                 ModelTier = 'capable',
  maxTokens             = 2000,
  systemPromptOverride?: string,
): Promise<T> {
  const providers = getActiveProviders();

  if (providers.length === 0) {
    throw new Error(
      'No AI provider configured. Add at least one key to .env.local:\n' +
      '  GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY',
    );
  }

  const systemPrompt = systemPromptOverride ?? [
    'You are a professional resume writing expert.',
    'CRITICAL: Respond with ONLY a valid JSON object or array.',
    'Do NOT include markdown code fences, backticks, or any explanation.',
    'Your entire response must be parseable by JSON.parse().',
  ].join(' ');

  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const client = getClientForProvider(provider);
      const model  = provider[tier];

      const response = await client.chat.completions.create({
        model,
        max_tokens:  maxTokens,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: prompt        },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '';
      if (!raw.trim()) throw new Error('Empty response from model');

      const result = extractJSON<T>(raw);
      console.log(`[aiService] ✓ ${provider.name} (${model})`);
      return result;

    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.warn(`[aiService] ✗ ${provider.name} failed: ${msg}`);
      errors.push(`${provider.name}: ${msg}`);

      // If JSON parse failed on a valid response, retry this same provider
      // once with a stronger JSON reminder before moving to next provider
      if (msg.includes('JSON parse failed')) {
        try {
          const client = getClientForProvider(provider);
          const model  = provider[tier];
          const response = await client.chat.completions.create({
            model,
            max_tokens:  maxTokens,
            temperature: 0.2,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user',   content: prompt + '\n\nIMPORTANT: Return ONLY raw JSON. No markdown, no backticks, no explanation.' },
            ],
          });
          const raw = response.choices[0]?.message?.content ?? '';
          const result = extractJSON<T>(raw);
          console.log(`[aiService] ✓ ${provider.name} (retry)`);
          return result;
        } catch (retryErr: any) {
          errors.push(`${provider.name} retry: ${retryErr?.message}`);
        }
      }

      // Continue to next provider
      continue;
    }
  }

  throw new Error(
    `All AI providers failed. Errors:\n${errors.join('\n')}\n\n` +
    'Check your API keys in .env.local and ensure at least one provider has credits.',
  );
}

// ─── Resume generation functions ──────────────────────────────────────────────

export interface BaseResumeInput {
  name?:            string;
  email?:           string;
  phone?:           string;
  location?:        string;
  targetRole?:      string;
  currentJobTitle?: string;
  experienceYears?: number;
  educationLevel?:  string;
  skills?:          string[];
  bio?:             string;
  industry?:        string;
}

/** Step 1 — Generate base resume skeleton from profile data. */
export async function generateBaseResume(input: BaseResumeInput): Promise<ResumeContent> {
  const prompt = `Generate a complete professional resume JSON for this person.

PROFILE:
- Name: ${input.name || 'Not provided'}
- Email: ${input.email || ''}
- Phone: ${input.phone || ''}
- Location: ${input.location || ''}
- Target Role: ${input.targetRole || 'Professional'}
- Current Title: ${input.currentJobTitle || 'Not specified'}
- Experience: ${input.experienceYears || 0} years
- Education: ${input.educationLevel || 'Not specified'}
- Industry: ${input.industry || 'General'}
- Skills: ${(input.skills || []).join(', ') || 'Not listed'}
- Bio: ${input.bio || 'None'}

Create 2 realistic work experience entries based on the target role and experience years.
Each role needs 3 achievement-focused bullet points starting with strong action verbs.

Return this exact JSON structure (nothing else):
{
  "personalInfo": {
    "name": "${input.name || ''}",
    "email": "${input.email || ''}",
    "phone": "${input.phone || ''}",
    "location": "${input.location || ''}",
    "linkedin": "",
    "website": ""
  },
  "summary": "3-4 sentence professional summary here",
  "experience": [
    {
      "id": "exp_1",
      "jobTitle": "Job Title",
      "company": "Company Name",
      "period": "Jan 2022 – Present",
      "bullets": ["Achievement 1", "Achievement 2", "Achievement 3"]
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "education": [
    {
      "id": "edu_1",
      "degree": "Degree",
      "school": "University",
      "year": "2018–2022",
      "grade": ""
    }
  ],
  "targetRole": "${input.targetRole || ''}"
}`;

  return generateJSON<ResumeContent>(prompt, 'capable', 2000);
}

/** Step 2 — Enhance resume: stronger language, metrics, impact. */
export async function enhanceResumeContent(base: ResumeContent): Promise<ResumeContent> {
  const prompt = `You are an elite resume writer. Enhance this resume to be exceptional.

CURRENT RESUME:
${JSON.stringify(base, null, 2)}

ENHANCEMENT RULES:
1. Rewrite summary to be authoritative, specific, compelling (3-4 sentences)
2. Improve EVERY bullet with powerful action verbs and quantifiable results (%, $, numbers)
3. Ensure skills list has 10-12 relevant items for the target role
4. Keep personalInfo fields EXACTLY as provided — do not alter them
5. Make language confident and achievement-focused, not task-focused

Return the COMPLETE enhanced resume in the same JSON structure. Nothing else.`;

  const enhanced = await generateJSON<ResumeContent>(prompt, 'capable', 2000);
  return { ...enhanced, personalInfo: base.personalInfo };
}

/** Step 3 — Optimize for target role with keyword injection. */
export async function optimizeForRole(
  resume:     ResumeContent,
  targetRole: string,
  keywords:   string[],
): Promise<ResumeContent> {
  const prompt = `You are an ATS optimization expert. Optimize this resume for: "${targetRole}".

CURRENT RESUME:
${JSON.stringify(resume, null, 2)}

KEYWORDS TO INJECT (use naturally):
${keywords.join(', ')}

RULES:
1. Rewrite summary to directly address "${targetRole}"
2. Inject missing keywords naturally into bullets and summary
3. Add missing critical keywords to the skills array
4. Do NOT change personalInfo fields
5. Every change must read naturally — no keyword stuffing

Return the COMPLETE optimized resume in the same JSON structure. Nothing else.`;

  const optimized = await generateJSON<ResumeContent>(prompt, 'capable', 2000);
  return { ...optimized, personalInfo: resume.personalInfo };
}

/** Rewrite only the summary section. */
export async function rewriteSummary(summary: string, targetRole: string): Promise<string> {
  interface R { summary: string }
  const prompt = `Rewrite this professional summary for a "${targetRole}" role.

CURRENT: "${summary}"

RULES:
- 3-5 sentences, open with a strong professional identity statement
- Include quantifiable language, end with clear value proposition
- Include the job title "${targetRole}" naturally

Return JSON: { "summary": "rewritten text here" }`;

  const result = await generateJSON<R>(prompt, 'fast', 600);
  return result.summary || summary;
}

/** Strengthen bullet points for one experience entry. */
export async function strengthenBullets(
  bullets:    string[],
  jobTitle:   string,
  targetRole: string,
): Promise<string[]> {
  interface R { bullets: string[] }
  const prompt = `Strengthen these resume bullet points for "${jobTitle}" (target: "${targetRole}").

CURRENT:
${bullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

RULES:
- Start each with a strong action verb (Led, Delivered, Built, Increased, etc.)
- Add measurable results: %, $, headcount, timeframes
- Keep each to 1-2 lines, remove weak starters like "was responsible for"

Return JSON: { "bullets": ["improved bullet 1", "improved bullet 2"] }`;

  const result = await generateJSON<R>(prompt, 'fast', 800);
  return Array.isArray(result.bullets) && result.bullets.length > 0
    ? result.bullets
    : bullets;
}

/** Inject missing keywords into a resume naturally. */
export async function injectKeywords(
  resume:          ResumeContent,
  missingKeywords: string[],
  targetRole:      string,
): Promise<Partial<ResumeContent>> {
  interface R { summary: string; experience: ResumeExperience[]; skills: string[] }

  const prompt = `Naturally inject these missing keywords into the resume for a "${targetRole}" role.

KEYWORDS TO ADD: ${missingKeywords.join(', ')}

RESUME SECTIONS:
Summary: ${resume.summary}
Skills: ${resume.skills.join(', ')}
Experience: ${JSON.stringify(resume.experience.map(e => ({ jobTitle: e.jobTitle, bullets: e.bullets })))}

RULES: Add keywords naturally, add to skills array if missing.

Return JSON: { "summary": "...", "experience": [...], "skills": [...] }`;

  const result = await generateJSON<R>(prompt, 'fast', 1500);
  return {
    summary:    result.summary    || resume.summary,
    experience: result.experience || resume.experience,
    skills:     result.skills     || resume.skills,
  };
}

// ─── Ava ATS Optimizer ─────────────────────────────────────────────────────────

export interface AvaOptimizeInput {
  resumeData:      ResumeContent;
  targetRole:      string;
  atsBreakdown:    {
    keywordMatch:    number;
    contentStrength: number;
    skillsRelevance: number;
    formatting:      number;
    overall:         number;
    missingKeywords: string[];
    suggestions:     Array<{ id: string; type: string; title: string; detail: string; impact: string }>;
  };
}

export interface AvaOptimizeResult {
  improvedResume:       ResumeContent;
  improvementsSummary:  string[];
  estimatedScoreIncrease: number;
}

/**
 * avaOptimize()
 *
 * Single holistic AI call: Ava reads the full ATS breakdown and improves
 * the entire resume in one pass. More coherent than chained targeted calls.
 *
 * System prompt is Ava's personality spec from the task brief.
 * Returns typed JSON — provider fallback handled by generateJSON().
 */
export async function avaOptimize(input: AvaOptimizeInput): Promise<AvaOptimizeResult> {
  const { resumeData, targetRole, atsBreakdown } = input;

  const dimLines = [
    `  - Keyword Match:    ${atsBreakdown.keywordMatch}%  ${atsBreakdown.keywordMatch < 65 ? '⚠ NEEDS WORK' : '✓'}`,
    `  - Content Strength: ${atsBreakdown.contentStrength}%  ${atsBreakdown.contentStrength < 65 ? '⚠ NEEDS WORK' : '✓'}`,
    `  - Skills Relevance: ${atsBreakdown.skillsRelevance}%  ${atsBreakdown.skillsRelevance < 65 ? '⚠ NEEDS WORK' : '✓'}`,
    `  - Formatting:       ${atsBreakdown.formatting}%  ${atsBreakdown.formatting < 75 ? '⚠ NEEDS WORK' : '✓'}`,
    `  - Overall ATS:      ${atsBreakdown.overall}%`,
  ].join('\n');

  const missingKwLine = atsBreakdown.missingKeywords.length > 0
    ? `MISSING KEYWORDS (inject naturally — do NOT stuff): ${atsBreakdown.missingKeywords.slice(0, 8).join(', ')}`
    : 'No critical missing keywords detected.';

  const topSuggestions = atsBreakdown.suggestions
    .slice(0, 5)
    .map(s => `  [${s.type.toUpperCase()}] ${s.title}: ${s.detail}`)
    .join('\n');

  const systemPrompt = `You are Ava, an expert resume optimizer and ATS specialist.
Your task is to improve the given resume based on ATS analysis.

GOALS:
1. Increase ATS score
2. Improve recruiter readability
3. Make content achievement-driven
4. Naturally include missing keywords (do NOT keyword stuff)

RULES:
CONTENT:
* Rewrite bullet points using strong action verbs
* Add measurable impact (%, numbers, outcomes)
* Keep each bullet concise (1-2 lines)

KEYWORDS:
* Incorporate missing keywords naturally into experience and skills
* Do NOT add irrelevant keywords

STRUCTURE:
* Ensure sections exist: summary, experience, skills, education
* Improve clarity and formatting

TONE:
* Professional, confident, results-focused

DO NOT:
* Fabricate fake experience
* Add unrealistic metrics
* Change factual meaning

CRITICAL: Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

  const userPrompt = `TARGET ROLE: ${targetRole || 'Not specified'}

ATS DIMENSION SCORES:
${dimLines}

${missingKwLine}

TOP ATS SUGGESTIONS:
${topSuggestions || '  None'}

CURRENT RESUME (JSON):
${JSON.stringify(resumeData, null, 2)}

OUTPUT FORMAT (JSON ONLY):
{
  "improvedResume": { ...same structure as input, with personalInfo UNCHANGED... },
  "improvementsSummary": [
    "Rewrote bullet points with measurable achievements",
    "Added missing keywords: ...",
    "Improved formatting and clarity"
  ],
  "estimatedScoreIncrease": <integer 0-30>
}`;

  // Use capable tier for this comprehensive call — it needs reasoning quality
  const raw = await generateJSON<AvaOptimizeResult & { improvedResume: ResumeContent }>(
    userPrompt,
    'capable',
    3500,
    systemPrompt,  // pass as override system prompt
  );

  // Safety: always preserve personalInfo from original (AI must not change contact data)
  const improvedResume: ResumeContent = {
    ...raw.improvedResume,
    personalInfo: resumeData.personalInfo,
    targetRole:   resumeData.targetRole || targetRole,
  };

  return {
    improvedResume,
    improvementsSummary:    Array.isArray(raw.improvementsSummary) ? raw.improvementsSummary : [],
    estimatedScoreIncrease: typeof raw.estimatedScoreIncrease === 'number'
      ? Math.min(30, Math.max(0, raw.estimatedScoreIncrease))
      : 5,
  };
}