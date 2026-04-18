/**
 * src/lib/data/careerPaths.ts
 *
 * Career path progression map.
 * Defines directed edges from a current role to one or more next roles,
 * mirroring the role_transitions graph in core/src/data/career-graph/.
 *
 * Design decisions:
 *   - Role names match the keys in salaryData.ts (lowercase, canonical)
 *   - Each entry is { next, lateral } to distinguish promotions from pivots
 *   - `next`    = vertical promotion (same family, higher level)
 *   - `lateral` = cross-family pivot (requires deliberate upskilling)
 *   - Both arrays may be empty for terminal roles
 *
 * Extensibility:
 *   - Add a new role by inserting a key; existing entries are unaffected
 *   - Future: swap static map with a graph DB query behind the same interface
 *   - Future: add `probability` and `yearsRequired` per edge (schema below)
 *
 * Usage:
 *   import { CAREER_PATHS, getNextRoles, getLateralRoles } from '@/lib/data/careerPaths';
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** A role title string — kept as a plain string so callers can pass any title. */
export type RoleTitle = string;

export interface CareerPathEntry {
  /** Upward promotions within the same job family. */
  next: RoleTitle[];
  /** Cross-family or deliberate pivot paths (require notable upskilling). */
  lateral: RoleTitle[];
  /** Typical years at current role before this transition becomes realistic. */
  yearsRequired?: number;
  /** Job family this role belongs to. */
  family: JobFamily;
  /** Whether this is a terminal node (no standard next role in the dataset). */
  isTerminal?: boolean;
}

export type JobFamily =
  | 'Engineering'
  | 'Data'
  | 'Product'
  | 'Design'
  | 'Finance'
  | 'Marketing'
  | 'HR'
  | 'Operations'
  | 'Sales';

// ─── Career path map ──────────────────────────────────────────────────────────

export const CAREER_PATHS: Readonly<Record<RoleTitle, CareerPathEntry>> = {

  // ── Software Engineering ────────────────────────────────────────────────────

  'software engineer': {
    family: 'Engineering',
    next:    ['senior software engineer'],
    lateral: ['data analyst', 'product manager'],
    yearsRequired: 2,
  },

  'frontend developer': {
    family: 'Engineering',
    next:    ['senior software engineer', 'full stack developer'],
    lateral: ['ui/ux designer', 'product manager'],
    yearsRequired: 2,
  },

  'backend developer': {
    family: 'Engineering',
    next:    ['senior software engineer', 'devops engineer'],
    lateral: ['data engineer', 'product manager'],
    yearsRequired: 2,
  },

  'full stack developer': {
    family: 'Engineering',
    next:    ['senior software engineer'],
    lateral: ['product manager', 'devops engineer'],
    yearsRequired: 2,
  },

  'mobile developer': {
    family: 'Engineering',
    next:    ['senior software engineer'],
    lateral: ['product manager', 'ui/ux designer'],
    yearsRequired: 2,
  },

  'devops engineer': {
    family: 'Engineering',
    next:    ['senior software engineer', 'engineering manager'],
    lateral: ['data engineer'],
    yearsRequired: 3,
  },

  'senior software engineer': {
    family: 'Engineering',
    next:    ['tech lead', 'engineering manager'],
    lateral: ['product manager', 'data scientist'],
    yearsRequired: 2,
  },

  'tech lead': {
    family: 'Engineering',
    next:    ['engineering manager'],
    lateral: ['product manager'],
    yearsRequired: 2,
  },

  'engineering manager': {
    family: 'Engineering',
    next:    ['director of engineering'],
    lateral: ['product manager'],
    yearsRequired: 3,
  },

  'director of engineering': {
    family: 'Engineering',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

  // ── Data & Analytics ────────────────────────────────────────────────────────

  'data analyst': {
    family: 'Data',
    next:    ['senior data analyst', 'data scientist'],
    lateral: ['product analyst', 'data engineer', 'business analyst'],
    yearsRequired: 2,
  },

  'senior data analyst': {
    family: 'Data',
    next:    ['data science manager', 'data scientist'],
    lateral: ['product manager', 'data engineer'],
    yearsRequired: 2,
  },

  'data scientist': {
    family: 'Data',
    next:    ['senior data scientist', 'machine learning engineer'],
    lateral: ['product manager', 'data science manager'],
    yearsRequired: 2,
  },

  'senior data scientist': {
    family: 'Data',
    next:    ['data science manager'],
    lateral: ['ai engineer'],
    yearsRequired: 2,
  },

  'data science manager': {
    family: 'Data',
    next:    ['director of data'],
    lateral: [],
    yearsRequired: 3,
  },

  'director of data': {
    family: 'Data',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

  'data engineer': {
    family: 'Data',
    next:    ['senior data engineer'],
    lateral: ['data analyst', 'devops engineer'],
    yearsRequired: 3,
  },

  'senior data engineer': {
    family: 'Data',
    next:    ['lead data engineer', 'data science manager'],
    lateral: ['director of data'],
    yearsRequired: 3,
  },

  'lead data engineer': {
    family: 'Data',
    next:    ['director of data'],
    lateral: [],
    isTerminal: false,
  },

  'machine learning engineer': {
    family: 'Data',
    next:    ['ai engineer', 'senior data scientist'],
    lateral: ['data science manager'],
    yearsRequired: 2,
  },

  'ai engineer': {
    family: 'Data',
    next:    [],
    lateral: ['product manager'],
    isTerminal: true,
  },

  'business analyst': {
    family: 'Data',
    next:    ['senior business analyst', 'product analyst'],
    lateral: ['product manager', 'data analyst'],
    yearsRequired: 2,
  },

  'senior business analyst': {
    family: 'Data',
    next:    ['product manager', 'data science manager'],
    lateral: [],
    yearsRequired: 2,
  },

  'product analyst': {
    family: 'Product',
    next:    ['product manager'],
    lateral: ['data analyst', 'business analyst'],
    yearsRequired: 2,
  },

  // ── Product Management ──────────────────────────────────────────────────────

  'product manager': {
    family: 'Product',
    next:    ['senior product manager'],
    lateral: ['data science manager', 'marketing manager'],
    yearsRequired: 3,
  },

  'senior product manager': {
    family: 'Product',
    next:    ['director of product', 'vp of product'],
    lateral: ['engineering manager'],
    yearsRequired: 3,
  },

  'director of product': {
    family: 'Product',
    next:    ['vp of product'],
    lateral: [],
    yearsRequired: 3,
  },

  'vp of product': {
    family: 'Product',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

  // ── Design ──────────────────────────────────────────────────────────────────

  'graphic designer': {
    family: 'Design',
    next:    ['ui/ux designer'],
    lateral: ['content writer', 'marketing manager'],
    yearsRequired: 2,
  },

  'ui/ux designer': {
    family: 'Design',
    next:    ['senior ux designer', 'product designer'],
    lateral: ['product manager'],
    yearsRequired: 2,
  },

  'product designer': {
    family: 'Design',
    next:    ['senior ux designer', 'design manager'],
    lateral: ['product manager'],
    yearsRequired: 2,
  },

  'ux researcher': {
    family: 'Design',
    next:    ['senior ux researcher'],
    lateral: ['product analyst', 'product manager'],
    yearsRequired: 2,
  },

  'senior ux researcher': {
    family: 'Design',
    next:    ['design manager'],
    lateral: ['product manager'],
    yearsRequired: 2,
  },

  'senior ux designer': {
    family: 'Design',
    next:    ['design manager'],
    lateral: ['product manager'],
    yearsRequired: 3,
  },

  'design manager': {
    family: 'Design',
    next:    ['director of design'],
    lateral: ['product manager'],
    yearsRequired: 3,
  },

  'director of design': {
    family: 'Design',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

  // ── Finance & Accounting ────────────────────────────────────────────────────

  'accountant': {
    family: 'Finance',
    next:    ['senior accountant'],
    lateral: ['financial analyst', 'business analyst'],
    yearsRequired: 3,
  },

  'senior accountant': {
    family: 'Finance',
    next:    ['finance manager', 'chartered accountant'],
    lateral: ['financial analyst'],
    yearsRequired: 3,
  },

  'chartered accountant': {
    family: 'Finance',
    next:    ['finance manager'],
    lateral: ['investment analyst', 'financial analyst'],
    yearsRequired: 2,
  },

  'financial analyst': {
    family: 'Finance',
    next:    ['senior financial analyst', 'finance manager'],
    lateral: ['investment analyst', 'business analyst'],
    yearsRequired: 3,
  },

  'senior financial analyst': {
    family: 'Finance',
    next:    ['finance manager'],
    lateral: ['investment analyst'],
    yearsRequired: 3,
  },

  'investment analyst': {
    family: 'Finance',
    next:    ['finance manager', 'senior investment analyst'],
    lateral: ['financial analyst'],
    yearsRequired: 2,
  },

  'senior investment analyst': {
    family: 'Finance',
    next:    ['finance manager'],
    lateral: [],
    yearsRequired: 2,
  },

  'finance manager': {
    family: 'Finance',
    next:    ['cfo'],
    lateral: [],
    yearsRequired: 5,
  },

  'cfo': {
    family: 'Finance',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

  // ── Marketing ───────────────────────────────────────────────────────────────

  'content writer': {
    family: 'Marketing',
    next:    ['senior content writer', 'seo specialist'],
    lateral: ['product analyst', 'ux researcher'],
    yearsRequired: 2,
  },

  'senior content writer': {
    family: 'Marketing',
    next:    ['content manager', 'marketing manager'],
    lateral: [],
    yearsRequired: 2,
  },

  'content manager': {
    family: 'Marketing',
    next:    ['marketing manager'],
    lateral: [],
    yearsRequired: 2,
  },

  'seo specialist': {
    family: 'Marketing',
    next:    ['digital marketing manager'],
    lateral: ['content writer', 'product analyst'],
    yearsRequired: 2,
  },

  'growth hacker': {
    family: 'Marketing',
    next:    ['digital marketing manager', 'marketing manager'],
    lateral: ['product manager'],
    yearsRequired: 2,
  },

  'digital marketing manager': {
    family: 'Marketing',
    next:    ['marketing manager'],
    lateral: [],
    yearsRequired: 2,
  },

  'marketing manager': {
    family: 'Marketing',
    next:    ['director of marketing', 'vp of marketing'],
    lateral: ['product manager'],
    yearsRequired: 3,
  },

  'director of marketing': {
    family: 'Marketing',
    next:    ['vp of marketing'],
    lateral: [],
    yearsRequired: 3,
  },

  'vp of marketing': {
    family: 'Marketing',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

  // ── HR & People ─────────────────────────────────────────────────────────────

  'recruiter': {
    family: 'HR',
    next:    ['senior recruiter', 'hr manager'],
    lateral: ['business analyst', 'operations manager'],
    yearsRequired: 3,
  },

  'senior recruiter': {
    family: 'HR',
    next:    ['hr manager'],
    lateral: [],
    yearsRequired: 3,
  },

  'hr manager': {
    family: 'HR',
    next:    ['hr director'],
    lateral: ['operations manager'],
    yearsRequired: 4,
  },

  'hr director': {
    family: 'HR',
    next:    ['chief people officer'],
    lateral: [],
    yearsRequired: 4,
  },

  'chief people officer': {
    family: 'HR',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

  // ── Operations ──────────────────────────────────────────────────────────────

  'scrum master': {
    family: 'Operations',
    next:    ['project manager', 'engineering manager'],
    lateral: ['product manager'],
    yearsRequired: 2,
  },

  'project manager': {
    family: 'Operations',
    next:    ['program manager', 'operations manager'],
    lateral: ['product manager'],
    yearsRequired: 2,
  },

  'program manager': {
    family: 'Operations',
    next:    ['operations manager'],
    lateral: [],
    yearsRequired: 3,
  },

  'operations manager': {
    family: 'Operations',
    next:    ['director of operations'],
    lateral: ['product manager'],
    yearsRequired: 3,
  },

  'director of operations': {
    family: 'Operations',
    next:    ['chief operating officer'],
    lateral: [],
    yearsRequired: 4,
  },

  'chief operating officer': {
    family: 'Operations',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

  // ── Sales ────────────────────────────────────────────────────────────────────

  'business development': {
    family: 'Sales',
    next:    ['sales manager'],
    lateral: ['product manager', 'marketing manager'],
    yearsRequired: 2,
  },

  'sales manager': {
    family: 'Sales',
    next:    ['director of sales', 'vp of sales'],
    lateral: ['operations manager'],
    yearsRequired: 3,
  },

  'director of sales': {
    family: 'Sales',
    next:    ['vp of sales'],
    lateral: [],
    yearsRequired: 3,
  },

  'vp of sales': {
    family: 'Sales',
    next:    [],
    lateral: [],
    isTerminal: true,
  },

} as const;

// ─── Accessor helpers ─────────────────────────────────────────────────────────

/**
 * Returns all next roles (vertical + lateral) for a given title.
 * Case-insensitive. Returns empty arrays if the role is not in the map.
 */
export function getNextRoles(currentRole: string): { next: RoleTitle[]; lateral: RoleTitle[] } {
  const entry = CAREER_PATHS[currentRole.toLowerCase().trim()];
  if (!entry) return { next: [], lateral: [] };
  return { next: [...entry.next], lateral: [...entry.lateral] };
}

/**
 * Returns only vertical promotion paths.
 */
export function getPromotionPaths(currentRole: string): RoleTitle[] {
  return CAREER_PATHS[currentRole.toLowerCase().trim()]?.next ?? [];
}

/**
 * Returns only lateral / pivot paths.
 */
export function getLateralPaths(currentRole: string): RoleTitle[] {
  return CAREER_PATHS[currentRole.toLowerCase().trim()]?.lateral ?? [];
}

/**
 * Returns all roles in a given job family.
 */
export function getRolesByFamily(family: JobFamily): RoleTitle[] {
  return Object.entries(CAREER_PATHS)
    .filter(([, entry]) => entry.family === family)
    .map(([role]) => role);
}

/**
 * Returns the full list of all role titles in the dataset.
 */
export function getAllRoles(): RoleTitle[] {
  return Object.keys(CAREER_PATHS);
}