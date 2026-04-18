/**
 * AVA v2 — Score Explanation Prompt
 *
 * Used by: /api/career/explain  and  CopilotSection "Why is my score X?" queries
 *
 * v1 problem: Returned 2 sentences about market demand and skill match with
 *             rounded percentages but no named skills, no named actions.
 *
 * v2 fix: Forced answer structure ensures Ava names:
 *   - The exact score and the exact sub-dimension dragging it down
 *   - The specific skills missing by name
 *   - What % of matching jobs require those skills
 *   - One specific course/certification/platform to fix it
 *   - A realistic score projection if the fix is made
 */

// ── System prompt (replace SYSTEM in explain/route.ts) ────────────────────────
export const SCORE_EXPLAIN_SYSTEM = `You are Ava, a data-driven career advisor.
When explaining a score, you MUST follow this structure exactly. No exceptions.

REQUIRED ANSWER STRUCTURE:
  [SCORE SUMMARY]    — "Your score is X/100. The main drag is [dimension] at [value]/100."
  [ROOT CAUSE]       — "This is because your resume is missing [skill1], [skill2] — present in [N]% of [role] job descriptions."
  [WHAT'S WORKING]   — "Your [strongest dimension] ([value]/100) is above average — this comes from [specific reason]."
  [FIX #1]           — Specific, named action. Not "learn Python" — "Complete the Google Data Analytics Certificate on Coursera (6 weeks, free audit)."
  [FIX #2]           — Second specific action.
  [PROJECTION]       — "If you add [skill] and improve [section], your score could reach [number] in [timeframe]."

BANNED WORDS AND PHRASES:
  strong profile, good foundation, market alignment, broad skill set, diverse background,
  great progress, keep it up, on the right track, various opportunities, exciting opportunities,
  leverage your experience, well-positioned, nice work, overall performance

RULES:
  - Never give a range like "65-70". Give one specific projected number.
  - Never use vague timeframes like "a few weeks". Use "3 weeks" or "2 months".
  - Never mention a skill not present in the user's skill gap or required skills data.
  - Return ONLY valid JSON.`;

// ── Prompt builder ────────────────────────────────────────────────────────────
interface ScoreExplainInput {
  currentRole:     string;
  targetRole:      string;
  compositeScore:  number;
  atsScore:        number;
  jobMatchScore:   number;
  interviewScore?: number;
  activityScore?:  number;
  missingSkills:   string[];        // from atsService or skillGap
  confirmedSkills: string[];
  yearsExperience: number;
  topJobMatch?:    { role: string; matchScore: number; requiredSkills: string[] };
  jobsRequiringMissingSkills?: Record<string, number>; // skill → % of matching jobs
}

export function buildScoreExplainPrompt(input: ScoreExplainInput): string {
  const {
    currentRole, targetRole, compositeScore, atsScore, jobMatchScore,
    interviewScore, activityScore, missingSkills, confirmedSkills,
    yearsExperience, topJobMatch, jobsRequiringMissingSkills = {},
  } = input;

  // Build skill-to-job-frequency lines
  const skillFreqLines = missingSkills.slice(0, 5).map(skill => {
    const freq = jobsRequiringMissingSkills[skill];
    return freq != null
      ? `    ${skill}: required in ${freq}% of ${targetRole} job descriptions`
      : `    ${skill}: missing from your resume`;
  }).join('\n');

  const dims = [
    { name: 'ATS Score',      value: atsScore },
    { name: 'Job Match',      value: jobMatchScore },
    ...(interviewScore != null ? [{ name: 'Interview Prep', value: interviewScore }] : []),
    ...(activityScore  != null ? [{ name: 'Activity',       value: activityScore  }] : []),
  ].sort((a, b) => a.value - b.value);

  return `CANDIDATE:
  Current Role:    ${currentRole}
  Target Role:     ${targetRole}
  Experience:      ${yearsExperience} years
  Skills on file:  ${confirmedSkills.slice(0, 8).join(', ') || 'none'}

SCORE BREAKDOWN:
  Overall Score:   ${compositeScore}/100
  ${dims.map(d => `${d.name.padEnd(16)} ${d.value}/100`).join('\n  ')}

SKILL GAPS (missing from resume vs. ${targetRole} requirements):
${skillFreqLines || '  None detected'}

${topJobMatch ? `TOP JOB MATCH:
  Role:   ${topJobMatch.role} (${topJobMatch.matchScore}% match)
  Requires: ${topJobMatch.requiredSkills.slice(0, 5).join(', ')}` : ''}

Explain this score in the required [SCORE SUMMARY] → [PROJECTION] format.
Return JSON:
{
  "scoreSummary":  "string",
  "rootCause":     "string",
  "whatsWorking":  "string",
  "fix1":          "string",
  "fix2":          "string",
  "projection":    "string"
}`;
}