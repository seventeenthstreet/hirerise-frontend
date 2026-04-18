/**
 * src/lib/services/careerPathService.ts
 *
 * Career Path Simulation Engine.
 *
 * Pure, side-effect-free service — no I/O, no API calls, no global state.
 * Every output is a deterministic function of its inputs, making the service
 * fully testable and safe to call from both the server and the browser.
 *
 * Dependencies (read-only, never mutated):
 *   - careerPaths  → CAREER_PATHS, getNextRoles
 *   - roleSkills   → getMissingSkills, getRoleSkills
 *   - salaryData   → predictSalary (existing salary engine, not modified)
 *
 * Public API:
 *   simulateCareerPath(input)  → SimulatedPathStep[]
 *   simulateFull(input)        → CareerSimulationResult   (richer, includes metadata)
 *   estimateTimeline(...)      → number                   (months, exported for reuse)
 *   rankPathsBySpeed(steps)    → SimulatedPathStep[]       (sorted by timelineMonths)
 */

import { getNextRoles, CAREER_PATHS }  from '@/lib/data/careerPaths';
import { getMissingSkills, getRoleSkills } from '@/lib/data/roleSkills';
import { predictSalary }               from '@/lib/salaryData';
import type { JobFamily }              from '@/lib/data/careerPaths';
import type { LocationTier }           from '@/lib/salaryData';

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface SimulateCareerPathInput {
  /** The user's current role title (case-insensitive). */
  currentRole:     string;
  /** Skills the user currently has — compared against roleSkills to find gaps. */
  userSkills:      string[];
  /** Total years of professional experience (used for salary estimation). */
  experience:      number;
  /** Resume ATS score 0-100 (used for salary estimation). Null = not yet scored. */
  atsScore:        number | null;
  /**
   * Location tier used for salary prediction.
   * Defaults to 'metro' when omitted.
   */
  location?:       LocationTier;
  /**
   * Whether to include lateral (cross-family) paths alongside vertical ones.
   * Defaults to true.
   */
  includeLateral?: boolean;
}

/** Salary range for a simulated role, in LPA (Lakhs Per Annum, INR). */
export interface SimulatedSalary {
  min:    number;   // 25th-pct predicted
  mid:    number;   // 50th-pct predicted (median)
  max:    number;   // 90th-pct predicted
}

/** Describes a single role reachable from the current position. */
export interface SimulatedPathStep {
  /** Target role title. */
  role:            string;
  /**
   * Path type:
   *   'vertical' — promotion within the same job family.
   *   'lateral'  — cross-family pivot requiring deliberate upskilling.
   */
  pathType:        'vertical' | 'lateral';
  /** Job family the target role belongs to. */
  family:          JobFamily | 'Unknown';
  /**
   * Core skills the user is missing for this role.
   * Sourced from roleSkills.ts `core` array minus userSkills.
   */
  skillsGap:       string[];
  /**
   * Nice-to-have skills the user is missing.
   * Sourced from roleSkills.ts `preferred` array minus userSkills.
   */
  preferredGap:    string[];
  /**
   * Estimated months to be ready for this transition.
   *
   * Formula:
   *   base     = CAREER_PATHS[currentRole].yearsRequired ?? 2   (years at current role)
   *   learning = skillsGap.length * 3                           (3 months per missing core skill)
   *   total    = (base * 12) + learning
   *
   * Capped at 60 months (5 years) to keep estimates grounded.
   * Lateral paths get a +6 month adjustment for context-switching overhead.
   */
  timelineMonths:  number;
  /**
   * Salary prediction for this role at the user's current skills + experience.
   * Uses the existing `predictSalary` engine from salaryData.ts — not modified.
   */
  salary:          SimulatedSalary;
  /**
   * Estimated salary achievable once the skillsGap is closed.
   * Recalculates `predictSalary` with all required skills added.
   */
  salaryAtReadiness: SimulatedSalary;
  /** Number of core skills already matched. */
  matchedSkillCount: number;
  /** Total core skills required by the role. */
  totalSkillCount:   number;
  /** Readiness percentage: matchedSkillCount / totalSkillCount * 100. */
  readinessPct:      number;
}

/** Full simulation result returned by simulateFull(). */
export interface CareerSimulationResult {
  currentRole:     string;
  resolvedRole:    string;           // normalised lowercase key used internally
  vertical:        SimulatedPathStep[];
  lateral:         SimulatedPathStep[];
  /** All steps combined, sorted by timelineMonths ascending. */
  all:             SimulatedPathStep[];
  /** Fastest reachable role (shortest timelineMonths). */
  fastestPath:     SimulatedPathStep | null;
  /** Highest-paying role (largest salaryAtReadiness.mid). */
  highestPayPath:  SimulatedPathStep | null;
  /** Metadata about the simulation inputs. */
  meta: {
    experience:      number;
    atsScore:        number | null;
    location:        LocationTier;
    userSkillCount:  number;
    simulatedAt:     string;   // ISO 8601
  };
}

// ─── Timeline estimation ──────────────────────────────────────────────────────

/**
 * Estimates months until a user is ready for a target role.
 *
 * @param missingCoreSkills  - Core skills still to acquire
 * @param yearsRequired      - Typical years at current role before transition
 * @param isLateral          - Lateral paths carry extra adjustment
 */
export function estimateTimeline(
  missingCoreSkills: string[],
  yearsRequired:     number,
  isLateral:         boolean,
): number {
  const baseMonths     = yearsRequired * 12;
  const learningMonths = missingCoreSkills.length * 3;   // 3 months per skill gap
  const lateralAdjust  = isLateral ? 6 : 0;              // context-switch overhead

  const raw = baseMonths + learningMonths + lateralAdjust;
  return Math.min(raw, 60);   // cap at 5 years
}

// ─── Salary extraction ────────────────────────────────────────────────────────

/**
 * Runs predictSalary for a given role at the user's current state and
 * extracts the {min, mid, max} band used by SimulatedPathStep.
 * Falls back to zeroes if the role is not in the salary dataset.
 */
function getSalaryBand(
  targetRole:   string,
  experience:   number,
  skills:       string[],
  atsScore:     number | null,
  location:     LocationTier,
): SimulatedSalary {
  try {
    const pred = predictSalary({
      targetRole,
      location,
      experienceYears: experience,
      resumeSkills:    skills,
      atsScore,
    });
    return {
      min: pred.predicted.min,
      mid: pred.predicted.median,
      max: pred.predicted.max,
    };
  } catch {
    // Role is outside the salary dataset — return zeroes so the step is still
    // included in the simulation (the caller can filter on salary.mid === 0).
    return { min: 0, mid: 0, max: 0 };
  }
}

// ─── Single-step builder ──────────────────────────────────────────────────────

/**
 * Constructs one SimulatedPathStep for a target role.
 * Pure function — called once per reachable role.
 */
function buildStep(
  targetRole:   string,
  pathType:     'vertical' | 'lateral',
  input:        Required<Omit<SimulateCareerPathInput, 'includeLateral'>>,
  yearsRequired: number,
): SimulatedPathStep {
  const { userSkills, experience, atsScore, location } = input;

  // Skill gap (uses getMissingSkills from roleSkills.ts, not modified)
  const { missingCore, missingPreferred } = getMissingSkills(targetRole, userSkills);

  // Timeline
  const timelineMonths = estimateTimeline(missingCore, yearsRequired, pathType === 'lateral');

  // Salary at current state
  const salary = getSalaryBand(targetRole, experience, userSkills, atsScore, location);

  // Salary once all required core skills are acquired
  const skillsAtReadiness = [...userSkills, ...missingCore];
  const salaryAtReadiness = getSalaryBand(
    targetRole, experience + timelineMonths / 12, skillsAtReadiness, atsScore, location,
  );

  // Readiness score
  const entry            = getRoleSkills(targetRole);
  const totalSkillCount  = entry?.core.length ?? 0;
  const matchedSkillCount = totalSkillCount - missingCore.length;
  const readinessPct     = totalSkillCount > 0
    ? Math.round((matchedSkillCount / totalSkillCount) * 100)
    : 0;

  const family = CAREER_PATHS[targetRole]?.family ?? 'Unknown';

  return {
    role:              targetRole,
    pathType,
    family,
    skillsGap:         missingCore,
    preferredGap:      missingPreferred,
    timelineMonths,
    salary,
    salaryAtReadiness,
    matchedSkillCount,
    totalSkillCount,
    readinessPct,
  };
}

// ─── Public: simulateCareerPath ───────────────────────────────────────────────

/**
 * Core simulation function.
 *
 * Returns a flat array of SimulatedPathStep — one per reachable role —
 * suitable for direct rendering or further processing.
 *
 * Vertical paths first, then lateral (if includeLateral is true).
 * Within each group, steps are ordered by timelineMonths ascending.
 *
 * @example
 * ```ts
 * const steps = simulateCareerPath({
 *   currentRole: 'Software Engineer',
 *   userSkills:  ['React', 'Node.js', 'SQL'],
 *   experience:  3,
 *   atsScore:    72,
 * });
 * // => [{ role: 'Senior Software Engineer', timelineMonths: 30, ... }, ...]
 * ```
 */
export function simulateCareerPath(
  input: SimulateCareerPathInput,
): SimulatedPathStep[] {
  const normalised    = input.currentRole.toLowerCase().trim();
  const location      = input.location      ?? 'metro';
  const includeLateral = input.includeLateral ?? true;

  // Resolve entry — if the role is not in the map, return empty
  const entry = CAREER_PATHS[normalised];
  if (!entry) return [];

  const yearsRequired = entry.yearsRequired ?? 2;

  const resolvedInput: Required<Omit<SimulateCareerPathInput, 'includeLateral'>> = {
    currentRole: normalised,
    userSkills:  input.userSkills,
    experience:  input.experience,
    atsScore:    input.atsScore,
    location,
  };

  // Build vertical steps
  const verticalSteps: SimulatedPathStep[] = entry.next.map(targetRole =>
    buildStep(targetRole, 'vertical', resolvedInput, yearsRequired),
  );

  // Build lateral steps (optional)
  const lateralSteps: SimulatedPathStep[] = includeLateral
    ? entry.lateral.map(targetRole =>
        buildStep(targetRole, 'lateral', resolvedInput, yearsRequired),
      )
    : [];

  // Sort each group by timeline ascending
  const sort = (steps: SimulatedPathStep[]) =>
    [...steps].sort((a, b) => a.timelineMonths - b.timelineMonths);

  return [...sort(verticalSteps), ...sort(lateralSteps)];
}

// ─── Public: simulateFull ─────────────────────────────────────────────────────

/**
 * Extended simulation that also exposes vertical/lateral splits, the fastest
 * reachable role, the highest-paying role, and run metadata.
 *
 * Use this when the UI needs richer information than the flat step array.
 */
export function simulateFull(
  input: SimulateCareerPathInput,
): CareerSimulationResult {
  const normalised = input.currentRole.toLowerCase().trim();
  const location   = input.location ?? 'metro';

  const all       = simulateCareerPath({ ...input, location });
  const vertical  = all.filter(s => s.pathType === 'vertical');
  const lateral   = all.filter(s => s.pathType === 'lateral');

  const fastestPath    = all.length
    ? all.reduce((a, b) => a.timelineMonths <= b.timelineMonths ? a : b)
    : null;

  const highestPayPath = all.length
    ? all.reduce((a, b) => a.salaryAtReadiness.mid >= b.salaryAtReadiness.mid ? a : b)
    : null;

  return {
    currentRole:  input.currentRole,
    resolvedRole: normalised,
    vertical,
    lateral,
    all,
    fastestPath,
    highestPayPath,
    meta: {
      experience:     input.experience,
      atsScore:       input.atsScore,
      location,
      userSkillCount: input.userSkills.length,
      simulatedAt:    new Date().toISOString(),
    },
  };
}

// ─── Public: rankPathsBySpeed ─────────────────────────────────────────────────

/**
 * Returns a copy of the steps array sorted by timelineMonths ascending.
 * Convenience helper for components that receive raw simulateCareerPath output.
 */
export function rankPathsBySpeed(steps: SimulatedPathStep[]): SimulatedPathStep[] {
  return [...steps].sort((a, b) => a.timelineMonths - b.timelineMonths);
}

/**
 * Returns a copy of the steps array sorted by salaryAtReadiness.mid descending.
 */
export function rankPathsBySalary(steps: SimulatedPathStep[]): SimulatedPathStep[] {
  return [...steps].sort((a, b) => b.salaryAtReadiness.mid - a.salaryAtReadiness.mid);
}