/**
 * lib/careerGrowth.ts
 *
 * Pure, side-effect-free functions for career growth calculations.
 * Shared between API routes and the frontend component.
 *
 * Composite Career Score weights (spec):
 *   ATS score       40%
 *   Job Match       30%
 *   Interview       20%
 *   Activity        10%
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CareerScoreInput {
  atsScore:       number | null;   // 0-100 from resume ATS engine
  jobMatchScore:  number | null;   // 0-100 from job match engine
  interviewScore: number | null;   // 0-100 avg from interview prep sessions
  activityScore:  number | null;   // 0-100 derived from applications + actions
}

export interface CareerScoreBreakdown {
  composite:      number;   // 0-100 weighted
  ats:            number;
  jobMatch:       number;
  interview:      number;
  activity:       number;
  // raw inputs (may differ if defaults applied)
  inputs:         Required<CareerScoreInput>;
}

export interface CareerMetricSnapshot {
  id?:            string;
  user_id:        string;
  composite:      number;
  ats_score:      number;
  job_match:      number;
  interview_score: number;
  activity_score: number;
  recorded_at:    string;   // ISO 8601
}

export interface GrowthInsight {
  id:       string;
  type:     'improvement' | 'suggestion' | 'warning' | 'celebration';
  icon:     string;
  title:    string;
  body:     string;
}

export interface StreakData {
  currentStreak:  number;   // days
  longestStreak:  number;
  lastActiveDate: string | null;
}

// ─── Composite score ──────────────────────────────────────────────────────────

const WEIGHTS = { ats: 0.40, jobMatch: 0.30, interview: 0.20, activity: 0.10 } as const;

/** Default values when a dimension hasn't been measured yet */
const DEFAULTS = { ats: 40, jobMatch: 40, interview: 50, activity: 30 };

export function computeCareerScore(input: CareerScoreInput): CareerScoreBreakdown {
  const ats       = input.atsScore       ?? DEFAULTS.ats;
  const jobMatch  = input.jobMatchScore  ?? DEFAULTS.jobMatch;
  const interview = input.interviewScore ?? DEFAULTS.interview;
  const activity  = input.activityScore  ?? DEFAULTS.activity;

  const composite = Math.min(100, Math.round(
    ats       * WEIGHTS.ats      +
    jobMatch  * WEIGHTS.jobMatch +
    interview * WEIGHTS.interview +
    activity  * WEIGHTS.activity
  ));

  return {
    composite,
    ats, jobMatch, interview, activity,
    inputs: { atsScore: ats, jobMatchScore: jobMatch, interviewScore: interview, activityScore: activity },
  };
}

// ─── Activity score ───────────────────────────────────────────────────────────

export interface ActivityInput {
  applicationsCount:   number;
  resumeUpdatedDays:   number | null;  // days since last resume update (null = never)
  skillsAddedRecently: number;
  interviewSessionsDone: number;
}

/** Derive a 0-100 activity score from observable actions */
export function computeActivityScore(a: ActivityInput): number {
  let score = 20; // baseline — they've logged in
  score += Math.min(a.applicationsCount * 8, 30);   // up to 30 pts for applications
  if (a.resumeUpdatedDays !== null) {
    score += a.resumeUpdatedDays <= 7  ? 20
           : a.resumeUpdatedDays <= 30 ? 12
           : a.resumeUpdatedDays <= 90 ? 5 : 0;
  }
  score += Math.min(a.skillsAddedRecently * 5, 15); // up to 15 pts for skills
  score += Math.min(a.interviewSessionsDone * 5, 15);
  return Math.min(100, Math.round(score));
}

// ─── Streak calculation ───────────────────────────────────────────────────────

export function computeStreak(snapshots: Pick<CareerMetricSnapshot, 'recorded_at'>[]): StreakData {
  if (snapshots.length === 0) return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };

  // Get unique activity dates (yyyy-mm-dd)
  const dates = [...new Set(
    snapshots.map(s => s.recorded_at.slice(0, 10))
  )].sort().reverse(); // newest first

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  let current = 0;
  let longest = 0;
  let run     = 0;
  let prev: string | null = null;

  for (const d of [...dates].reverse()) { // oldest to newest
    if (!prev) {
      run = 1;
    } else {
      const diff = (new Date(d).getTime() - new Date(prev).getTime()) / 86_400_000;
      run = diff <= 1 ? run + 1 : 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }

  // Current streak — only active if last activity was today or yesterday
  if (dates[0] === today || dates[0] === yesterday) {
    current = run;
  }

  return { currentStreak: current, longestStreak: longest, lastActiveDate: dates[0] ?? null };
}

// ─── Task list generator ──────────────────────────────────────────────────────

export interface CareerTask {
  id:       string;
  label:    string;
  points:   number;  // score pts this action could add
  href:     string;
  priority: 'high' | 'medium' | 'low';
  done:     boolean;
}

export function generateTasks(breakdown: CareerScoreBreakdown, applicationsCount: number): CareerTask[] {
  const tasks: CareerTask[] = [];

  if (breakdown.ats < 65) tasks.push({
    id: 'fix_resume', label: 'Run Auto-Fix on your resume', points: 8,
    href: '/resume-builder', priority: 'high', done: false,
  });

  if (breakdown.jobMatch < 60) tasks.push({
    id: 'apply_jobs', label: 'Apply to 2 more matching jobs', points: 6,
    href: '/job-matches', priority: 'high', done: false,
  });

  if (breakdown.interview < 65) tasks.push({
    id: 'practice', label: 'Complete a mock interview session', points: 5,
    href: '/interview-prep', priority: 'medium', done: false,
  });

  if (applicationsCount === 0) tasks.push({
    id: 'first_apply', label: 'Submit your first application', points: 10,
    href: '/job-matches', priority: 'high', done: false,
  });

  if (breakdown.activity < 50) tasks.push({
    id: 'update_skills', label: 'Add 2 skills to your profile', points: 4,
    href: '/skills', priority: 'medium', done: false,
  });

  if (breakdown.composite >= 70) tasks.push({
    id: 'network', label: 'Request an informational interview', points: 3,
    href: '/job-matches', priority: 'low', done: false,
  });

  return tasks.slice(0, 5);
}

// ─── Improvement % ────────────────────────────────────────────────────────────

export function computeImprovement(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}