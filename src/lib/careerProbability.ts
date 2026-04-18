// lib/careerProbability.ts
// Career Probability Engine — Phase 7
//
// Pure calculation utility. All inputs come from existing hooks.
// No direct API calls — consumers pass pre-fetched data.
//
// Architecture:
//   UI Components → useCareerHealth / useProfile / useSkills
//   → pass data to calculateCareerProbability()
//   → receive ProbabilityResult (no side effects)

import type { CareerHealthResponse } from '@/types/careerHealth';
import type { BackendUser } from '@/types/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EducationLevel =
  | 'high_school'
  | 'diploma'
  | 'bachelors'
  | 'masters'
  | 'phd'
  | 'bootcamp'
  | 'self_taught';

export type ExperienceLevel =
  | 'student'
  | 'fresher'       // 0-1 yr
  | 'junior'        // 1-3 yr
  | 'mid'           // 3-6 yr
  | 'senior'        // 6-10 yr
  | 'lead';         // 10+ yr

export interface ProbabilityFactors {
  /** 0-100: inverse of weighted gap score */
  skills:    number;
  /** 0-100: education level alignment score */
  education: number;
  /** 0-100: average demand score of user's top skills */
  demand:    number;
  /** 0-100: experience level match */
  experience: number;
}

export interface ProbabilityImprovement {
  action:     string;
  impact:     number;   // estimated probability delta 0-20
  category:   'skill' | 'education' | 'experience' | 'resume';
}

export interface ProbabilityResult {
  /** Composite 0-100 probability score */
  probability:  number;
  /** Colour tier: green ≥70, amber 40-69, red <40 */
  tier:         'high' | 'medium' | 'low';
  /** Per-factor subscores 0-100 */
  breakdown:    ProbabilityFactors;
  /** Ordered improvement recommendations */
  improvements: ProbabilityImprovement[];
  /** Human-readable label */
  label:        string;
}

// ─── Factor weights ───────────────────────────────────────────────────────────

const WEIGHTS: ProbabilityFactors = {
  skills:     0.40,
  education:  0.20,
  demand:     0.20,
  experience: 0.20,
} as unknown as ProbabilityFactors;

// ─── Education score map ──────────────────────────────────────────────────────

const EDUCATION_SCORES: Record<EducationLevel, number> = {
  high_school:  35,
  diploma:      50,
  bootcamp:     55,
  self_taught:  55,
  bachelors:    72,
  masters:      88,
  phd:          95,
};

// ─── Experience score map ─────────────────────────────────────────────────────

const EXPERIENCE_SCORES: Record<ExperienceLevel, number> = {
  student:  30,
  fresher:  42,
  junior:   58,
  mid:      75,
  senior:   90,
  lead:     96,
};

// ─── Simulator overrides ──────────────────────────────────────────────────────
// Used by the Career Simulator to test "what-if" scenarios.

export interface SimulatorOverrides {
  education?:      EducationLevel;
  experience?:     ExperienceLevel;
  targetRole?:     string;
  /** Additional skill names to assume the user has learned */
  addedSkills?:    string[];
  /** Override chiScore directly (0-100) for advanced simulation */
  chiScoreOverride?: number;
}

// ─── Core calculation ─────────────────────────────────────────────────────────

export function calculateCareerProbability(
  chi:       CareerHealthResponse | null | undefined,
  user:      BackendUser | null | undefined,
  overrides: SimulatorOverrides = {},
): ProbabilityResult {

  // ── Skills factor (40%) ─────────────────────────────────────────────────────
  let skillsScore = 0;
  if (chi?.isReady) {
    const effectiveGaps = overrides.addedSkills?.length
      ? chi.skillGaps.filter(g => !overrides.addedSkills!.includes(g.skillName))
      : chi.skillGaps;

    if (effectiveGaps.length === 0) {
      skillsScore = 90;
    } else {
      const avgGap = effectiveGaps.reduce((s, g) => s + g.gap, 0) / effectiveGaps.length;
      skillsScore  = Math.round(Math.max(5, 100 - avgGap));
    }
    // Blend with CHI score if available
    const chiBase  = overrides.chiScoreOverride ?? chi.chiScore;
    if (chiBase != null) {
      skillsScore = Math.round((skillsScore * 0.6) + (chiBase * 0.4));
    }
  } else if (overrides.chiScoreOverride != null) {
    skillsScore = Math.round(overrides.chiScoreOverride * 0.9);
  } else {
    skillsScore = 20; // no data baseline
  }

  // ── Education factor (20%) ──────────────────────────────────────────────────
  const eduLevel: EducationLevel = overrides.education ?? inferEducationLevel(user);
  const educationScore = EDUCATION_SCORES[eduLevel];

  // ── Market demand factor (20%) ──────────────────────────────────────────────
  let demandScore = 50; // neutral default
  if (chi?.isReady && chi.demandMetrics.length > 0) {
    const topN       = chi.demandMetrics.slice(0, 5);
    const avgDemand  = topN.reduce((s, m) => s + m.demandScore, 0) / topN.length;
    // Boost if trending up, penalise if falling
    const trendBonus = chi.demandMetrics.filter(m => m.trend === 'rising').length * 2
                     - chi.demandMetrics.filter(m => m.trend === 'falling').length * 3;
    demandScore = Math.round(Math.min(100, Math.max(0, avgDemand + trendBonus)));
  }

  // ── Experience factor (20%) ─────────────────────────────────────────────────
  const expLevel: ExperienceLevel = overrides.experience ?? inferExperienceLevel(user);
  const experienceScore = EXPERIENCE_SCORES[expLevel];

  // ── Composite probability ───────────────────────────────────────────────────
  const raw = (
    skillsScore     * 0.40 +
    educationScore  * 0.20 +
    demandScore     * 0.20 +
    experienceScore * 0.20
  );
  const probability = Math.round(Math.min(99, Math.max(1, raw)));

  // ── Tier ────────────────────────────────────────────────────────────────────
  const tier: ProbabilityResult['tier'] =
    probability >= 70 ? 'high' : probability >= 40 ? 'medium' : 'low';

  // ── Improvements ────────────────────────────────────────────────────────────
  const improvements = buildImprovements(chi, user, {
    skillsScore, educationScore, demandScore, experienceScore,
    addedSkills: overrides.addedSkills,
  });

  // ── Label ───────────────────────────────────────────────────────────────────
  const label =
    probability >= 85 ? 'Excellent Match' :
    probability >= 70 ? 'Strong Candidate' :
    probability >= 55 ? 'Good Potential' :
    probability >= 40 ? 'Developing Match' :
    probability >= 25 ? 'Early Stage' :
    'Needs Foundation';

  return {
    probability,
    tier,
    breakdown: {
      skills:     skillsScore,
      education:  educationScore,
      demand:     demandScore,
      experience: experienceScore,
    },
    improvements,
    label,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferEducationLevel(user: BackendUser | null | undefined): EducationLevel {
  // Use backend-derived educationLevel if available (set from onboardingProgress)
  const level = (user as any)?.educationLevel as EducationLevel | null | undefined;
  if (level && level in EDUCATION_SCORES) return level;

  // Fallback: infer from experienceYears as rough proxy
  const yrs = user?.experienceYears ?? 0;
  if (yrs >= 8) return 'masters';
  if (yrs >= 3) return 'bachelors';
  if (yrs >= 1) return 'diploma';
  return 'self_taught';
}

function inferExperienceLevel(user: BackendUser | null | undefined): ExperienceLevel {
  // Use real experienceYears — now populated from onboardingProgress.totalExperienceMonths
  // or resume.estimatedExperienceYears, not just the users doc
  const yrs = user?.experienceYears ?? 0;
  if (yrs >= 10) return 'lead';
  if (yrs >= 6)  return 'senior';
  if (yrs >= 3)  return 'mid';
  if (yrs >= 1)  return 'junior';
  if (yrs > 0)   return 'fresher';
  return 'student';
}

function buildImprovements(
  chi:  CareerHealthResponse | null | undefined,
  user: BackendUser | null | undefined,
  scores: {
    skillsScore: number;
    educationScore: number;
    demandScore: number;
    experienceScore: number;
    addedSkills?: string[];
  },
): ProbabilityImprovement[] {
  const list: ProbabilityImprovement[] = [];

  // Skills improvements — top critical/high gaps not yet added
  if (chi?.isReady) {
    const openGaps = chi.skillGaps.filter(
      g => !scores.addedSkills?.includes(g.skillName)
    );
    openGaps.slice(0, 3).forEach(gap => {
      const impact = gap.priority === 'critical' ? 12 : gap.priority === 'high' ? 8 : 4;
      list.push({ action: `Learn ${gap.skillName}`, impact, category: 'skill' });
    });
  }

  // Experience improvement
  if (scores.experienceScore < 60) {
    list.push({
      action:   'Gain internship or project experience',
      impact:   10,
      category: 'experience',
    });
  }
  if (scores.experienceScore < 80 && scores.experienceScore >= 40) {
    list.push({
      action:   'Build real-world portfolio projects',
      impact:   8,
      category: 'experience',
    });
  }

  // Education improvement
  if (scores.educationScore < 72) {
    list.push({
      action:   'Pursue a formal degree or recognised certification',
      impact:   9,
      category: 'education',
    });
  }

  // Resume
  if (!user?.resumeUploaded) {
    list.push({ action: 'Upload your resume for AI analysis', impact: 15, category: 'resume' });
  }

  // Sort by impact desc, deduplicate by action
  const seen = new Set<string>();
  return list
    .sort((a, b) => b.impact - a.impact)
    .filter(i => { if (seen.has(i.action)) return false; seen.add(i.action); return true; })
    .slice(0, 5);
}

// ─── Scenario presets ─────────────────────────────────────────────────────────
// Used by CareerSimulator to populate preset scenario buttons.

export interface ScenarioPreset {
  id:       string;
  label:    string;
  icon:     string;
  overrides: SimulatorOverrides;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id:      'base',
    label:   'Current State',
    icon:    '📊',
    overrides: {},
  },
  {
    id:      'bachelors',
    label:   'Add Bachelor\'s Degree',
    icon:    '🎓',
    overrides: { education: 'bachelors' },
  },
  {
    id:      'masters',
    label:   'Add Master\'s Degree',
    icon:    '🏅',
    overrides: { education: 'masters' },
  },
  {
    id:      'mid',
    label:   '3 Years Experience',
    icon:    '💼',
    overrides: { experience: 'mid' },
  },
  {
    id:      'senior',
    label:   '6 Years Experience',
    icon:    '🚀',
    overrides: { experience: 'senior' },
  },
];

// ─── Label helpers ────────────────────────────────────────────────────────────

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  high_school: 'High School',
  diploma:     'Diploma / Associate',
  bootcamp:    'Bootcamp',
  self_taught: 'Self-taught',
  bachelors:   "Bachelor's Degree",
  masters:     "Master's Degree",
  phd:         'PhD / Doctorate',
};

export const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  student:  'Student (no exp)',
  fresher:  'Fresher (0–1 yr)',
  junior:   'Junior (1–3 yrs)',
  mid:      'Mid-level (3–6 yrs)',
  senior:   'Senior (6–10 yrs)',
  lead:     'Lead / Principal (10+)',
};