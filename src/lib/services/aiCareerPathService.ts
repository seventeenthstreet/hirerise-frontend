/**
 * @file aiCareerPathService.ts
 * @description AI-powered career path generation service with personalisation,
 *   market-trend scoring, and deterministic fallback logic.
 */

import { generateJSON } from '@/lib/services/aiService';
import {
  getMarketTrends,
  type MarketTrends,
  type RoleDemand,
  type SkillDemand,
} from '@/lib/services/marketDataService';
import { simulateCareerPath } from '@/lib/services/careerPathService';
import { getMissingSkills, getRoleSkills } from '@/lib/data/roleSkills';
import { CAREER_PATHS } from '@/lib/data/careerPaths';
import type { LocationTier } from '@/lib/salaryData';

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

/** Input shape for {@link generateDynamicCareerPath}. */
export interface GenerateDynamicCareerPathInput {
  /** The user's current role title. */
  currentRole: string;
  /** List of skills the user already possesses. */
  userSkills: string[];
  /** Years of relevant experience. */
  experience: number;
  /** Pre-fetched market trends — skips the internal fetch when provided. */
  marketTrends?: MarketTrends;
  /** Location tier used for salary / demand context. */
  location?: LocationTier;
  /** ATS score in the range [0, 1], or null if unavailable. */
  atsScore?: number | null;
  /** Aggregated summary of the user's job-match history. */
  jobMatchHistory?: JobMatchSummary;
}

/** Aggregated data from a user's historical job-match results. */
export interface JobMatchSummary {
  /** Mean match score across all recent applications (0–1). */
  averageMatchScore: number;
  /** Industry sectors that appeared most often in strong matches. */
  topMatchedSectors: string[];
  /** Skills that consistently appeared in matched job postings. */
  strongSkillsFromMatches: string[];
}

/** Score sub-components for a single career path step. */
export interface ScoreBreakdown {
  /** Market demand score for the target role (0–1). */
  demand: number;
  /** Proportion of core skills the user already has (0–1). */
  skillMatch: number;
  /** How well the user's experience fits the role minimum (0–1). */
  experienceFit: number;
}

/** Signals derived from user context used during personalisation. */
export interface PersonalisationSignals {
  /** The skill domain that dominates the user's profile, or 'none'. */
  dominantDomain: string;
  /** ATS-derived promotion/suppression signal. */
  atsSignal: 'boosted_senior' | 'suppressed_senior' | 'neutral';
  /** Roles that received a positive personalisation bump. */
  boostedRoles: string[];
  /** Roles that received a negative personalisation bump. */
  suppressedRoles: string[];
  /** Plain-English summary of personalisation reasoning. */
  summary: string;
}

/** A single step in a generated career path. */
export interface DynamicPathStep {
  /** Target role title. */
  role: string;
  /** Probability of a successful transition (0–1). */
  probability: number;
  /** Short reason for recommending this role. */
  reason: string;
  /** Skills the user still needs to acquire. */
  skillsGap: string[];
  /** Estimated months to reach this role. */
  timelineMonths: number;
  /** Whether this is a vertical promotion or a lateral move. */
  pathType: 'vertical' | 'lateral' | 'unknown';
  /** Market demand score used in scoring (0–1). */
  marketDemand: number;
  /** Detailed score sub-components. */
  scoreBreakdown: ScoreBreakdown;
  /** Human-readable explanation of the recommendation. */
  explanation: string;
  /** Personalisation multiplier applied to probability. */
  personalisationBump: number;
}

/** Full result returned by {@link generateDynamicCareerPath}. */
export interface DynamicCareerPathResult {
  /** The user's starting role. */
  currentRole: string;
  /** Ordered list of recommended career path steps. */
  paths: DynamicPathStep[];
  /** Whether the result was AI-generated or produced by the static fallback. */
  source: 'ai' | 'static_fallback';
  /** Reason the AI path was not used (only present for static_fallback). */
  fallbackReason?: string;
  /** ISO timestamp of generation. */
  generatedAt: string;
  /** Personalisation signals, or null if no context was available. */
  personalisationSignals: PersonalisationSignals | null;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * Keyword maps used to detect the dominant skill domain from a user's skills.
 */
const SKILL_DOMAINS: Record<string, string[]> = {
  analytics: [
    'analytics', 'tableau', 'power bi', 'looker', 'data studio', 'reporting',
    'kpi', 'metrics', 'dashboards', 'bi', 'business intelligence',
  ],
  engineering: [
    'typescript', 'javascript', 'python', 'java', 'c#', 'go', 'rust',
    'react', 'node', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
    'microservices', 'rest api', 'graphql', 'ci/cd', 'devops',
  ],
  leadership: [
    'leadership', 'management', 'team lead', 'director', 'vp', 'executive',
    'strategy', 'stakeholder', 'mentoring', 'coaching', 'headcount',
    'org design', 'people management',
  ],
  data: [
    'machine learning', 'deep learning', 'nlp', 'data science', 'sql',
    'spark', 'hadoop', 'etl', 'data pipeline', 'statistics', 'r',
    'tensorflow', 'pytorch', 'model training', 'feature engineering',
  ],
  design: [
    'figma', 'sketch', 'adobe', 'ux', 'ui', 'user research', 'wireframe',
    'prototype', 'design system', 'typography', 'accessibility', 'hci',
  ],
  finance: [
    'financial modelling', 'accounting', 'budgeting', 'forecasting', 'excel',
    'valuation', 'dcf', 'p&l', 'cash flow', 'ifrs', 'gaap', 'audit',
    'investment', 'equity', 'debt',
  ],
  marketing: [
    'seo', 'sem', 'google ads', 'facebook ads', 'content marketing',
    'email marketing', 'growth hacking', 'a/b testing', 'crm', 'hubspot',
    'salesforce', 'brand', 'campaign', 'copywriting',
  ],
  product: [
    'product management', 'product strategy', 'roadmap', 'agile', 'scrum',
    'sprint', 'backlog', 'user story', 'okr', 'go-to-market', 'pricing',
    'product analytics',
  ],
  operations: [
    'operations', 'supply chain', 'logistics', 'procurement', 'erp',
    'process improvement', 'lean', 'six sigma', 'project management',
    'vendor management', 'sla',
  ],
};

/**
 * Keyword maps used to align a role title to a domain.
 */
const ROLE_DOMAIN_KEYWORDS: Record<string, string[]> = {
  analytics: [
    'analyst', 'analytics', 'reporting', 'insights', 'bi', 'intelligence',
  ],
  engineering: [
    'engineer', 'developer', 'architect', 'devops', 'sre', 'backend',
    'frontend', 'fullstack', 'platform', 'infrastructure',
  ],
  leadership: [
    'director', 'vp', 'head of', 'chief', 'executive', 'president',
    'manager', 'lead',
  ],
  data: [
    'data scientist', 'data engineer', 'machine learning', 'ml engineer',
    'ai engineer', 'research scientist',
  ],
  design: [
    'designer', 'ux', 'ui', 'creative', 'brand', 'visual',
  ],
  finance: [
    'finance', 'financial', 'accounting', 'accountant', 'controller',
    'treasurer', 'cfo', 'investment',
  ],
  marketing: [
    'marketing', 'growth', 'seo', 'content', 'brand manager', 'cmo',
  ],
  product: [
    'product manager', 'product owner', 'cpo', 'product lead',
  ],
  operations: [
    'operations', 'ops', 'coo', 'supply chain', 'logistics', 'process',
  ],
};

/** Keywords that indicate a senior-level role. */
const SENIOR_ROLE_KEYWORDS = [
  'senior', 'lead', 'principal', 'staff', 'director', 'vp', 'head',
  'chief', 'manager', 'architect',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detects the dominant skill domain from a user's skill list.
 * Requires at least 2 keyword matches to declare a domain.
 * @returns The domain name, or `'none'` if no domain has ≥2 matches.
 */
function detectDominantDomain(userSkills: string[]): string {
  const lower = userSkills.map((s) => s.toLowerCase());
  const counts: Record<string, number> = {};

  for (const [domain, keywords] of Object.entries(SKILL_DOMAINS)) {
    counts[domain] = 0;
    for (const keyword of keywords) {
      if (lower.some((skill) => skill.includes(keyword))) {
        counts[domain]++;
      }
    }
  }

  const [topDomain, topCount] = Object.entries(counts).reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    ['none', 0]
  );

  return topCount >= 2 ? topDomain : 'none';
}

/**
 * Returns true when the given role title contains keywords associated with
 * the specified domain.
 */
function roleAlignsToDomain(roleTitle: string, domain: string): boolean {
  if (domain === 'none') return false;
  const lowerTitle = roleTitle.toLowerCase();
  const keywords = ROLE_DOMAIN_KEYWORDS[domain] ?? [];
  return keywords.some((kw) => lowerTitle.includes(kw));
}

/**
 * Returns true when the role title contains a senior-level keyword.
 */
function isSeniorRole(roleTitle: string): boolean {
  const lower = roleTitle.toLowerCase();
  return SENIOR_ROLE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Scores a potential career path step using market demand, skill match, and
 * experience fit.
 *
 * Formula: `demand * 0.5 + skillMatch * 0.3 + experienceFit * 0.2`
 *
 * @param targetRole     - The role the user is considering moving into.
 * @param userSkills     - Skills the user currently has.
 * @param userExperience - Years of relevant experience.
 * @param marketTrends   - Current market trend data.
 * @returns Probability (0–1, 2 d.p.) and its sub-score breakdown.
 */
export function scorePath(
  targetRole: string,
  userSkills: string[],
  userExperience: number,
  marketTrends: MarketTrends
): { probability: number; breakdown: ScoreBreakdown } {
  // --- Demand score ---
  // RoleDemand exposes a `score` field (not `demandScore`)
  const roleEntry = marketTrends.topNextRoles?.find(
    (r: RoleDemand) => r.role.toLowerCase() === targetRole.toLowerCase()
  );
  const demand: number = (roleEntry as RoleDemand & { score?: number; demandScore?: number })?.score
    ?? (roleEntry as RoleDemand & { score?: number; demandScore?: number })?.demandScore
    ?? 0.5;

  // --- Skill match score ---
  // getMissingSkills returns { missingCore: string[]; missingPreferred: string[] }
  let skillMatch: number;
  try {
    const missing = getMissingSkills(targetRole, userSkills);
    const roleSkills = getRoleSkills(targetRole);
    // getRoleSkills returns an object with missingCore / missingPreferred shape;
    // total core count is derived from the missingCore baseline length via role data.
    // We approximate: missingCore.length is skills still missing from core set.
    const missingCore: string[] = missing.missingCore ?? [];
    // getRoleSkills may return the full skill set; check for a `core` or similar field
    const roleData = roleSkills as unknown as Record<string, unknown>;
    const totalCoreSkills: number =
      Array.isArray(roleData?.core) ? (roleData.core as string[]).length
      : Array.isArray(roleData?.coreSkills) ? (roleData.coreSkills as string[]).length
      : missingCore.length > 0 ? missingCore.length + (userSkills.length > 0 ? 1 : 0)
      : 0;

    if (totalCoreSkills === 0) {
      skillMatch = 1.0;
    } else {
      const matchedCoreSkills = totalCoreSkills - missingCore.length;
      skillMatch = Math.max(0, matchedCoreSkills) / totalCoreSkills;
    }
  } catch {
    skillMatch = 1.0;
  }

  // --- Experience fit score ---
  let experienceFit: number;
  try {
    const roleSkills = getRoleSkills(targetRole);
    const roleData = roleSkills as unknown as Record<string, unknown>;
    const minExperienceYears =
      typeof roleData?.minExperienceYears === 'number' ? roleData.minExperienceYears : null;
    if (minExperienceYears == null || minExperienceYears === 0) {
      experienceFit = 1.0;
    } else {
      experienceFit = Math.min(userExperience / minExperienceYears, 1);
    }
  } catch {
    experienceFit = 1.0;
  }

  const rawProbability = demand * 0.5 + skillMatch * 0.3 + experienceFit * 0.2;
  const probability = Math.round(Math.min(Math.max(rawProbability, 0), 1) * 100) / 100;

  return {
    probability,
    breakdown: { demand, skillMatch, experienceFit },
  };
}

/**
 * Applies personalisation signals to a list of raw career path steps.
 *
 * Signals considered:
 * - **Signal A**: Role domain aligns with user's dominant skill domain → +0.15
 * - **Signal B**: Senior role + ATS boosted → +0.10; senior + suppressed → −0.15
 * - **Signal C**: Role appears in `topMatchedSectors` → +0.12
 * - **Signal D**: `strongSkillsFromMatches` overlaps with `skillsGap` → +0.08
 *
 * @param paths           - Raw scored paths to personalise.
 * @param userSkills      - User's current skills.
 * @param atsScore        - ATS score [0, 1] or null.
 * @param jobMatchHistory - Historical job-match summary, if available.
 * @param minPaths        - Minimum number of paths to return (default 3).
 * @param maxPaths        - Maximum number of paths to return (default 5).
 */
export function personalizeCareerPaths(
  paths: DynamicPathStep[],
  userSkills: string[],
  atsScore: number | null | undefined,
  jobMatchHistory: JobMatchSummary | undefined,
  minPaths = 3,
  maxPaths = 5
): { paths: DynamicPathStep[]; signals: PersonalisationSignals } {
  // No context — return as-is with neutral signals
  if (atsScore == null && !jobMatchHistory) {
    const neutralPaths = paths.map((p) => ({ ...p, personalisationBump: 1.0 }));
    return {
      paths: neutralPaths.slice(0, maxPaths),
      signals: {
        dominantDomain: 'none',
        atsSignal: 'neutral',
        boostedRoles: [],
        suppressedRoles: [],
        summary:
          'No ATS score or job-match history was provided; paths are ordered by score only.',
      },
    };
  }

  const dominantDomain = detectDominantDomain(userSkills);

  // Determine ATS signal
  let atsSignal: 'boosted_senior' | 'suppressed_senior' | 'neutral';
  if (atsScore != null && atsScore >= 0.75) {
    atsSignal = 'boosted_senior';
  } else if (atsScore != null && atsScore < 0.4) {
    atsSignal = 'suppressed_senior';
  } else {
    atsSignal = 'neutral';
  }

  const topMatchedSectors = jobMatchHistory?.topMatchedSectors ?? [];
  const strongSkillsFromMatches = jobMatchHistory?.strongSkillsFromMatches ?? [];

  const boostedRoles: string[] = [];
  const suppressedRoles: string[] = [];

  const personalisedPaths: DynamicPathStep[] = paths.map((path) => {
    let bump = 1.0;

    // Signal A: domain alignment
    if (dominantDomain !== 'none' && roleAlignsToDomain(path.role, dominantDomain)) {
      bump += 0.15;
    }

    // Signal B: ATS signal + seniority
    const senior = isSeniorRole(path.role);
    if (senior && atsSignal === 'boosted_senior') {
      bump += 0.1;
    } else if (senior && atsSignal === 'suppressed_senior') {
      bump -= 0.15;
    }

    // Signal C: role appears in topMatchedSectors
    const roleLower = path.role.toLowerCase();
    if (topMatchedSectors.some((s) => roleLower.includes(s.toLowerCase()))) {
      bump += 0.12;
    }

    // Signal D: strong skills from matches overlap with skills gap
    const gapLower = path.skillsGap.map((g) => g.toLowerCase());
    const hasOverlap = strongSkillsFromMatches.some((s) =>
      gapLower.includes(s.toLowerCase())
    );
    if (hasOverlap) {
      bump += 0.08;
    }

    // Clamp bump to [0.5, 1.5]
    bump = Math.min(Math.max(bump, 0.5), 1.5);

    const newProbability = Math.round(
      Math.min(Math.max(path.probability * bump, 0), 1) * 100
    ) / 100;

    if (bump > 1.0) boostedRoles.push(path.role);
    if (bump < 1.0) suppressedRoles.push(path.role);

    return { ...path, probability: newProbability, personalisationBump: bump };
  });

  // Re-sort descending by probability, trim to [minPaths, maxPaths]
  personalisedPaths.sort((a, b) => b.probability - a.probability);

  const trimmed = personalisedPaths.slice(0, Math.max(minPaths, maxPaths));
  const finalPaths = trimmed.length >= minPaths ? trimmed : personalisedPaths.slice(0, minPaths);

  // Build plain-English summary
  const summaryParts: string[] = [];
  if (dominantDomain !== 'none') {
    summaryParts.push(
      `Your skill profile is strongest in the ${dominantDomain} domain, so roles in that area have been prioritised.`
    );
  }
  if (atsSignal === 'boosted_senior') {
    summaryParts.push(
      'Your ATS score is high, suggesting a strong CV for senior-level applications — senior roles have been boosted.'
    );
  } else if (atsSignal === 'suppressed_senior') {
    summaryParts.push(
      'Your ATS score is below average for senior roles — senior positions have been slightly de-prioritised.'
    );
  }
  if (topMatchedSectors.length > 0) {
    summaryParts.push(
      `Roles in your top matched sectors (${topMatchedSectors.slice(0, 3).join(', ')}) have received an additional relevance boost.`
    );
  }
  if (summaryParts.length === 0) {
    summaryParts.push('Paths have been personalised based on available context.');
  }

  return {
    paths: finalPaths,
    signals: {
      dominantDomain,
      atsSignal,
      boostedRoles: [...new Set(boostedRoles)],
      suppressedRoles: [...new Set(suppressedRoles)],
      summary: summaryParts.join(' '),
    },
  };
}

/**
 * Builds a two-sentence deterministic explanation for a career path step.
 *
 * Sentence 1 describes the market demand signal.
 * Sentence 2 covers skill match, growth frame, and timeline.
 *
 * @param targetRole      - The role being explained.
 * @param userSkills      - User's current skills.
 * @param userExperience  - Years of experience.
 * @param breakdown       - Score sub-components.
 * @param pathType        - Vertical or lateral.
 * @param timelineMonths  - Estimated months to the role.
 */
export function buildDeterministicExplanation(
  targetRole: string,
  userSkills: string[],
  userExperience: number,
  breakdown: ScoreBreakdown,
  pathType: 'vertical' | 'lateral' | 'unknown',
  timelineMonths: number
): string {
  // Sentence 1: market demand
  let demandLabel: string;
  if (breakdown.demand >= 0.75) {
    demandLabel = 'very high demand';
  } else if (breakdown.demand >= 0.5) {
    demandLabel = 'moderate-to-high demand';
  } else if (breakdown.demand >= 0.25) {
    demandLabel = 'moderate demand';
  } else {
    demandLabel = 'lower demand';
  }
  const sentence1 = `${targetRole} is currently showing ${demandLabel} in the market (demand score: ${breakdown.demand.toFixed(2)}).`;

  // Sentence 2: skill match + growth frame + timeline
  const skillMatchPct = Math.round(breakdown.skillMatch * 100);
  const growthFrame =
    pathType === 'vertical'
      ? 'direct promotion'
      : pathType === 'lateral'
      ? 'strategic pivot'
      : 'career transition';

  let timelineLabel: string;
  if (timelineMonths <= 6) {
    timelineLabel = 'in the near term (under 6 months)';
  } else if (timelineMonths <= 12) {
    timelineLabel = 'within the next 6–12 months';
  } else if (timelineMonths <= 24) {
    timelineLabel = 'over the next 1–2 years';
  } else {
    timelineLabel = `over a longer horizon (~${Math.round(timelineMonths / 12)} years)`;
  }

  const sentence2 = `You already match ${skillMatchPct}% of the core skill requirements, making this a ${growthFrame} you could realistically target ${timelineLabel}.`;

  return `${sentence1} ${sentence2}`;
}

// ---------------------------------------------------------------------------
// Core async function
// ---------------------------------------------------------------------------

/**
 * Generates an AI-powered, personalised career path for the given input.
 *
 * Pipeline:
 * 1. Fetch market trends (or reuse pre-fetched).
 * 2. Build LLM prompt with market signals and skill-gap context.
 * 3. Call the LLM and normalise the output.
 * 4. Score and personalise each path step.
 * 5. Fall back to a deterministic path on any AI failure.
 *
 * @param input - Career path generation parameters.
 * @returns A {@link DynamicCareerPathResult} with personalised paths.
 */
export async function generateDynamicCareerPath(
  input: GenerateDynamicCareerPathInput
): Promise<DynamicCareerPathResult> {
  const {
    currentRole,
    userSkills,
    experience,
    location,
    atsScore,
    jobMatchHistory,
  } = input;

  // Step 1: Fetch or reuse market trends
  let marketTrends: MarketTrends;
  try {
    marketTrends = input.marketTrends ?? (await getMarketTrends(currentRole));
  } catch (err) {
    console.warn('[aiCareerPathService] Failed to fetch market trends; using fallback.', err);
    return staticFallback(input, 'Market trend fetch failed.');
  }

  // Step 2: Compute skill gaps for the top next roles to embed in the prompt
  const topNextRoles: string[] =
    marketTrends.topNextRoles?.slice(0, 5).map((r: RoleDemand) => r.role) ?? [];

  const skillGapContext = topNextRoles
    .map((role) => {
      try {
        // getMissingSkills returns { missingCore: string[]; missingPreferred: string[] }
        const missing = getMissingSkills(role, userSkills);
        const missingList = missing.missingCore ?? [];
        return `${role}: missing [${missingList.slice(0, 5).join(', ')}]`;
      } catch {
        return `${role}: skill data unavailable`;
      }
    })
    .join('\n');

  const marketSignalsContext = (marketTrends.topNextRoles ?? [])
    .slice(0, 8)
    .map((r: RoleDemand) => {
      const rd = r as RoleDemand & { score?: number; demandScore?: number };
      const ds = rd.score ?? rd.demandScore;
      return `${r.role} (demand: ${ds != null ? ds.toFixed(2) : 'N/A'})`;
    })
    .join(', ');

  // Step 3: Build LLM prompt
  const prompt = `You are a career advisor AI. Generate a realistic and personalised career path for the following candidate.

CANDIDATE PROFILE:
- Current role: ${currentRole}
- Years of experience: ${experience}
- Location tier: ${location ?? 'unspecified'}
- Skills: ${userSkills.join(', ')}

MARKET SIGNALS:
- Top roles in demand: ${marketSignalsContext}

SKILL GAPS (top candidate-specific gaps per role):
${skillGapContext}

INSTRUCTIONS — follow all 8 rules precisely:
1. Return ONLY valid JSON — no prose, no markdown fences.
2. Return an array of 3–5 career path objects under the key "paths".
3. Each path must include: "role", "probability" (0–1), "reason", "explanation", "skillsGap" (array), "timelineMonths" (integer).
4. "probability" must reflect genuine market difficulty — avoid clustering around 0.7–0.8.
5. Include a mix of vertical (promotion) and lateral (domain shift) moves.
6. "skillsGap" must list real, specific skills the candidate is missing for that role.
7. "timelineMonths" must be realistic given the candidate's experience (range: 3–60).
8. "explanation" must be at least 20 words and justify why THIS candidate should consider this specific role — reference their skills and market demand.

JSON SCHEMA:
{
  "paths": [
    {
      "role": "string",
      "probability": number,
      "reason": "string",
      "explanation": "string (≥20 words)",
      "skillsGap": ["string"],
      "timelineMonths": number
    }
  ]
}`;

  // Step 4: Call the LLM
  let rawPaths: DynamicPathStep[];
  try {
    const aiRaw = await generateJSON(prompt, 'capable', 1200);
    const aiOutput = aiRaw as Record<string, unknown>;

    if (!aiOutput?.['paths'] || !Array.isArray(aiOutput['paths']) || (aiOutput['paths'] as unknown[]).length === 0) {
      throw new Error('AI returned no paths or an invalid structure.');
    }

    rawPaths = (aiOutput['paths'] as Record<string, unknown>[])
      .map((raw: Record<string, unknown>) =>
        normaliseRawPath(raw, userSkills, experience, marketTrends, currentRole)
      )
      .filter(Boolean) as DynamicPathStep[];

    if (rawPaths.length === 0) {
      throw new Error('All AI paths failed normalisation.');
    }
  } catch (err) {
    console.warn('[aiCareerPathService] AI path generation failed; using static fallback.', err);
    const reason = err instanceof Error ? err.message : 'Unknown AI error';
    return staticFallback(input, reason);
  }

  // Step 5: Personalise
  const { paths: personalisedPaths, signals } = personalizeCareerPaths(
    rawPaths,
    userSkills,
    atsScore,
    jobMatchHistory
  );

  return {
    currentRole,
    paths: personalisedPaths,
    source: 'ai',
    generatedAt: new Date().toISOString(),
    personalisationSignals: signals,
  };
}

// ---------------------------------------------------------------------------
// Internal: normaliseRawPath
// ---------------------------------------------------------------------------

/**
 * Normalises and validates a single raw LLM path object.
 * Overrides LLM probability with {@link scorePath}, validates explanation length,
 * and seeds `personalisationBump` to 1.0.
 *
 * @returns A validated {@link DynamicPathStep}, or `null` if critically invalid.
 */
function normaliseRawPath(
  raw: Record<string, unknown>,
  userSkills: string[],
  userExperience: number,
  marketTrends: MarketTrends,
  currentRole: string
): DynamicPathStep | null {
  const role = typeof raw.role === 'string' && raw.role.trim() ? raw.role.trim() : null;
  if (!role) return null;

  const reason = typeof raw.reason === 'string' ? raw.reason : 'No reason provided.';
  const rawSkillsGap = Array.isArray(raw.skillsGap)
    ? raw.skillsGap.filter((s): s is string => typeof s === 'string')
    : [];
  const timelineMonths =
    typeof raw.timelineMonths === 'number' && raw.timelineMonths > 0
      ? Math.round(raw.timelineMonths)
      : 12;

  // Override probability with deterministic score
  const { probability, breakdown } = scorePath(role, userSkills, userExperience, marketTrends);

  // Classify path type
  let pathType: 'vertical' | 'lateral' | 'unknown';
  const currentLower = currentRole.toLowerCase();
  const roleLower = role.toLowerCase();
  if (
    roleLower.includes('senior') ||
    roleLower.includes('lead') ||
    roleLower.includes('manager') ||
    roleLower.includes('director') ||
    roleLower.includes('head') ||
    roleLower.includes('principal')
  ) {
    pathType = 'vertical';
  } else if (
    !roleLower.includes(currentLower.split(' ')[0]) &&
    !currentLower.includes(roleLower.split(' ')[0])
  ) {
    pathType = 'lateral';
  } else {
    pathType = 'unknown';
  }

  // Validate or replace explanation
  const rawExplanation =
    typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  const wordCount = rawExplanation.split(/\s+/).filter(Boolean).length;
  const explanation =
    wordCount >= 20
      ? rawExplanation
      : buildDeterministicExplanation(
          role,
          userSkills,
          userExperience,
          breakdown,
          pathType,
          timelineMonths
        );

  return {
    role,
    probability,
    reason,
    skillsGap: rawSkillsGap,
    timelineMonths,
    pathType,
    marketDemand: breakdown.demand,
    scoreBreakdown: breakdown,
    explanation,
    personalisationBump: 1.0,
  };
}

// ---------------------------------------------------------------------------
// Internal: staticFallback
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic career path using {@link simulateCareerPath} when
 * the AI pipeline fails or produces invalid output.
 */
async function staticFallback(
  input: GenerateDynamicCareerPathInput,
  reason: string
): Promise<DynamicCareerPathResult> {
  const { currentRole, userSkills, experience, atsScore, jobMatchHistory } = input;

  let marketTrends: MarketTrends;
  try {
    marketTrends = input.marketTrends ?? (await getMarketTrends(currentRole));
  } catch {
    // Construct a minimal MarketTrends to allow scoring to proceed
    marketTrends = { topNextRoles: [] } as unknown as MarketTrends;
  }

  const simulated = simulateCareerPath({ currentRole, userSkills, experience } as Parameters<typeof simulateCareerPath>[0]);

  // simulateCareerPath returns SimulatedPathStep[] directly (not { steps })
  const simulatedSteps = Array.isArray(simulated) ? simulated : [];
  const rawPaths: DynamicPathStep[] = simulatedSteps.map((step) => {
    const { probability, breakdown } = scorePath(
      step.role,
      userSkills,
      experience,
      marketTrends
    );
    const pathType: 'vertical' | 'lateral' | 'unknown' = step.pathType ?? 'unknown';
    const timelineMonths = step.timelineMonths ?? 12;

    const explanation = buildDeterministicExplanation(
      step.role,
      userSkills,
      experience,
      breakdown,
      pathType,
      timelineMonths
    );

    return {
      role: step.role,
      probability,
      reason: (step as unknown as Record<string, unknown>)['reason'] as string ?? 'Recommended by career path simulation.',
      skillsGap: step.skillsGap ?? [],
      timelineMonths,
      pathType,
      marketDemand: breakdown.demand,
      scoreBreakdown: breakdown,
      explanation,
      personalisationBump: 1.0,
    };
  });

  const { paths: personalisedPaths, signals } = personalizeCareerPaths(
    rawPaths,
    userSkills,
    atsScore,
    jobMatchHistory
  );

  return {
    currentRole,
    paths: personalisedPaths,
    source: 'static_fallback',
    fallbackReason: reason,
    generatedAt: new Date().toISOString(),
    personalisationSignals: signals,
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Returns the highest-probability path from the result, or null if empty.
 *
 * @param result - A {@link DynamicCareerPathResult}.
 */
export function getTopPath(result: DynamicCareerPathResult): DynamicPathStep | null {
  if (!result.paths.length) return null;
  return [...result.paths].sort((a, b) => b.probability - a.probability)[0] ?? null;
}

/**
 * Returns the path with the shortest estimated timeline, or null if empty.
 *
 * @param result - A {@link DynamicCareerPathResult}.
 */
export function getFastestPath(result: DynamicCareerPathResult): DynamicPathStep | null {
  if (!result.paths.length) return null;
  return [...result.paths].sort((a, b) => a.timelineMonths - b.timelineMonths)[0] ?? null;
}

/**
 * Returns all vertical (promotion) paths from the result.
 *
 * @param result - A {@link DynamicCareerPathResult}.
 */
export function getVerticalPaths(result: DynamicCareerPathResult): DynamicPathStep[] {
  return result.paths.filter((p) => p.pathType === 'vertical');
}

/**
 * Returns all lateral (domain-shift) paths from the result.
 *
 * @param result - A {@link DynamicCareerPathResult}.
 */
export function getLateralPaths(result: DynamicCareerPathResult): DynamicPathStep[] {
  return result.paths.filter((p) => p.pathType === 'lateral');
}