/**
 * src/lib/services/marketDataService.ts
 *
 * Market Data Layer for Career Path Simulation.
 *
 * Provides real-time (or simulated) market intelligence: demand scores for
 * next-step roles and in-demand skills for any given role title.
 *
 * Architecture:
 *   The public API is intentionally provider-agnostic. The internal
 *   `MarketDataProvider` interface makes it trivial to swap the mock
 *   with a live source (LinkedIn, Indeed, Naukri, etc.) behind the same
 *   `getMarketTrends(role)` surface — callers need zero changes.
 *
 * Current state:
 *   MockMarketDataProvider — realistic, role-specific simulated data.
 *   No I/O, no API calls, no external dependencies.
 *
 * Future integration points (TODO markers throughout):
 *   - LinkedInMarketDataProvider  (LinkedIn Talent Insights / Job Search API)
 *   - IndeedMarketDataProvider    (Indeed Publisher API)
 *   - NaukriMarketDataProvider    (Naukri Job API — relevant for IN market)
 *   - CombinedMarketDataProvider  (fan-out + merge from multiple sources)
 *
 * Usage:
 *   import { getMarketTrends } from '@/lib/services/marketDataService';
 *   const trends = await getMarketTrends('product manager');
 */

// ─── Output types ─────────────────────────────────────────────────────────────

/** Demand score in [0, 1]. Higher = more market pull for that role / skill. */
export type DemandScore = number;

/** A next-step role and its current market demand. */
export interface RoleDemand {
  /** Role title — matches careerPaths.ts canonical names where possible. */
  role: string;
  /**
   * Normalised demand score in [0, 1].
   *   0.9+ = extremely hot (top 10 % of listings growth)
   *   0.7–0.89 = high demand
   *   0.5–0.69 = moderate demand
   *   < 0.5  = lower traction / niche
   */
  demand: DemandScore;
}

/** A skill and its current market demand. */
export interface SkillDemand {
  /** Human-readable skill name — matches roleSkills.ts strings. */
  skill: string;
  /** Normalised demand score in [0, 1]. Same scale as RoleDemand.demand. */
  demand: DemandScore;
}

/**
 * Full market intelligence snapshot for a given role.
 * Returned by `getMarketTrends()`.
 */
export interface MarketTrends {
  /** The canonical role title this snapshot describes (lowercased input). */
  role: string;
  /**
   * Top roles the market is actively hiring from this level.
   * Ordered descending by demand — highest first.
   */
  topNextRoles: RoleDemand[];
  /**
   * Skills most frequently appearing in JDs for roles at this level.
   * Ordered descending by demand — highest first.
   */
  topSkills: SkillDemand[];
  /**
   * ISO-8601 timestamp of when this snapshot was generated.
   * Lets callers cache / invalidate on a TTL.
   */
  fetchedAt: string;
  /**
   * Source identifier — for provenance tracking and future cache keys.
   * 'mock' until a live provider is wired.
   */
  source: 'mock' | 'linkedin' | 'indeed' | 'naukri' | 'combined';
}

// ─── Provider interface ───────────────────────────────────────────────────────

/**
 * Implement this interface to add a new market data source.
 *
 * Rules:
 *   - Must be async (even if the implementation is synchronous).
 *   - Role input is already normalised (lowercased, trimmed) by the time
 *     `fetchTrends` is called — providers do not need to normalise again.
 *   - Return `null` if the provider has no data for the role (e.g. unknown
 *     role, rate-limited, or network error). The dispatcher will fall back
 *     to the mock in that case.
 */
interface MarketDataProvider {
  readonly name: string;
  fetchTrends(normalisedRole: string): Promise<MarketTrends | null>;
}

// ─── Mock data catalogue ──────────────────────────────────────────────────────

/**
 * Realistic, role-specific mock trends.
 * Keys are lowercase role titles matching careerPaths.ts.
 *
 * Rationale for the numbers:
 *   - Derived from broad market observations (job board trends, LinkedIn
 *     Insights reports, industry surveys) as of 2024-Q4 / 2025-Q1.
 *   - Not real-time — purely for simulation and UI development.
 *   - Scores are stable so UI components can be developed predictably.
 */
const MOCK_CATALOGUE: Readonly<Record<string, { topNextRoles: RoleDemand[]; topSkills: SkillDemand[] }>> = {

  // ── Product ──────────────────────────────────────────────────────────────────

  'product manager': {
    topNextRoles: [
      { role: 'Senior Product Manager',     demand: 0.85 },
      { role: 'Growth Product Manager',     demand: 0.72 },
      { role: 'Product Strategy Lead',      demand: 0.65 },
    ],
    topSkills: [
      { skill: 'SQL',                       demand: 0.90 },
      { skill: 'Analytics',                 demand: 0.88 },
      { skill: 'Stakeholder Management',    demand: 0.85 },
      { skill: 'Product Roadmapping',       demand: 0.82 },
      { skill: 'A/B Testing',               demand: 0.78 },
    ],
  },

  'senior product manager': {
    topNextRoles: [
      { role: 'Director of Product',        demand: 0.80 },
      { role: 'VP of Product',              demand: 0.68 },
      { role: 'Chief Product Officer',      demand: 0.55 },
    ],
    topSkills: [
      { skill: 'Executive Communication',   demand: 0.92 },
      { skill: 'OKR Frameworks',            demand: 0.88 },
      { skill: 'P&L Ownership',             demand: 0.84 },
      { skill: 'Product Strategy',          demand: 0.83 },
      { skill: 'SQL',                       demand: 0.78 },
    ],
  },

  // ── Engineering ──────────────────────────────────────────────────────────────

  'software engineer': {
    topNextRoles: [
      { role: 'Senior Software Engineer',   demand: 0.92 },
      { role: 'Full Stack Developer',       demand: 0.75 },
      { role: 'DevOps Engineer',            demand: 0.62 },
    ],
    topSkills: [
      { skill: 'TypeScript',                demand: 0.93 },
      { skill: 'System Design',             demand: 0.89 },
      { skill: 'React',                     demand: 0.87 },
      { skill: 'AWS (Basics)',              demand: 0.82 },
      { skill: 'Testing / QA',             demand: 0.78 },
    ],
  },

  'senior software engineer': {
    topNextRoles: [
      { role: 'Tech Lead',                  demand: 0.84 },
      { role: 'Engineering Manager',        demand: 0.72 },
      { role: 'Principal Engineer',         demand: 0.65 },
    ],
    topSkills: [
      { skill: 'System Design',             demand: 0.95 },
      { skill: 'Mentorship',                demand: 0.88 },
      { skill: 'Distributed Systems',       demand: 0.87 },
      { skill: 'AWS',                       demand: 0.85 },
      { skill: 'CI/CD',                     demand: 0.82 },
    ],
  },

  'frontend developer': {
    topNextRoles: [
      { role: 'Senior Software Engineer',   demand: 0.88 },
      { role: 'Full Stack Developer',       demand: 0.80 },
      { role: 'UI/UX Designer',             demand: 0.55 },
    ],
    topSkills: [
      { skill: 'TypeScript',                demand: 0.94 },
      { skill: 'React',                     demand: 0.92 },
      { skill: 'Performance Optimisation',  demand: 0.85 },
      { skill: 'Testing / QA',             demand: 0.80 },
      { skill: 'Accessibility (a11y)',      demand: 0.76 },
    ],
  },

  'backend developer': {
    topNextRoles: [
      { role: 'Senior Software Engineer',   demand: 0.88 },
      { role: 'DevOps Engineer',            demand: 0.72 },
      { role: 'Data Engineer',              demand: 0.68 },
    ],
    topSkills: [
      { skill: 'System Design',             demand: 0.92 },
      { skill: 'Docker',                    demand: 0.88 },
      { skill: 'PostgreSQL',                demand: 0.86 },
      { skill: 'AWS',                       demand: 0.84 },
      { skill: 'Message Queues',            demand: 0.78 },
    ],
  },

  'full stack developer': {
    topNextRoles: [
      { role: 'Senior Software Engineer',   demand: 0.90 },
      { role: 'Tech Lead',                  demand: 0.70 },
      { role: 'DevOps Engineer',            demand: 0.60 },
    ],
    topSkills: [
      { skill: 'TypeScript',                demand: 0.93 },
      { skill: 'System Design',             demand: 0.88 },
      { skill: 'Docker',                    demand: 0.84 },
      { skill: 'AWS (Basics)',              demand: 0.80 },
      { skill: 'CI/CD',                     demand: 0.78 },
    ],
  },

  'devops engineer': {
    topNextRoles: [
      { role: 'Senior DevOps Engineer',     demand: 0.87 },
      { role: 'Platform Engineer',          demand: 0.78 },
      { role: 'Site Reliability Engineer',  demand: 0.75 },
    ],
    topSkills: [
      { skill: 'Kubernetes',                demand: 0.94 },
      { skill: 'Terraform',                 demand: 0.91 },
      { skill: 'AWS',                       demand: 0.90 },
      { skill: 'Observability',             demand: 0.86 },
      { skill: 'Security / DevSecOps',      demand: 0.82 },
    ],
  },

  'tech lead': {
    topNextRoles: [
      { role: 'Engineering Manager',        demand: 0.80 },
      { role: 'Principal Engineer',         demand: 0.72 },
      { role: 'Director of Engineering',    demand: 0.58 },
    ],
    topSkills: [
      { skill: 'Technical Vision',          demand: 0.91 },
      { skill: 'Cross-functional Leadership', demand: 0.89 },
      { skill: 'System Design',             demand: 0.88 },
      { skill: 'Mentorship',                demand: 0.87 },
      { skill: 'Architecture Review',       demand: 0.84 },
    ],
  },

  'engineering manager': {
    topNextRoles: [
      { role: 'Director of Engineering',    demand: 0.78 },
      { role: 'VP of Engineering',          demand: 0.65 },
      { role: 'Chief Technology Officer',   demand: 0.45 },
    ],
    topSkills: [
      { skill: 'People Management',         demand: 0.93 },
      { skill: 'Hiring & Recruiting',       demand: 0.88 },
      { skill: 'OKR Frameworks',            demand: 0.85 },
      { skill: 'Technical Strategy',        demand: 0.84 },
      { skill: 'Executive Communication',   demand: 0.82 },
    ],
  },

  // ── Data ─────────────────────────────────────────────────────────────────────

  'data analyst': {
    topNextRoles: [
      { role: 'Senior Data Analyst',        demand: 0.88 },
      { role: 'Data Scientist',             demand: 0.76 },
      { role: 'Product Analyst',            demand: 0.70 },
    ],
    topSkills: [
      { skill: 'SQL',                       demand: 0.96 },
      { skill: 'Python (Basics)',           demand: 0.88 },
      { skill: 'Tableau / Power BI',        demand: 0.86 },
      { skill: 'Statistics',               demand: 0.83 },
      { skill: 'dbt',                       demand: 0.74 },
    ],
  },

  'data scientist': {
    topNextRoles: [
      { role: 'Senior Data Scientist',      demand: 0.86 },
      { role: 'ML Engineer',                demand: 0.78 },
      { role: 'Data Science Manager',       demand: 0.65 },
    ],
    topSkills: [
      { skill: 'Python (Advanced)',         demand: 0.95 },
      { skill: 'Machine Learning',          demand: 0.93 },
      { skill: 'Deep Learning',             demand: 0.88 },
      { skill: 'SQL',                       demand: 0.86 },
      { skill: 'MLflow / Experiment Tracking', demand: 0.80 },
    ],
  },

  'machine learning engineer': {
    topNextRoles: [
      { role: 'Senior ML Engineer',         demand: 0.87 },
      { role: 'AI Engineer',                demand: 0.82 },
      { role: 'ML Platform Engineer',       demand: 0.70 },
    ],
    topSkills: [
      { skill: 'PyTorch / TensorFlow',      demand: 0.95 },
      { skill: 'MLOps',                     demand: 0.92 },
      { skill: 'LLM Fine-tuning',           demand: 0.90 },
      { skill: 'System Design',             demand: 0.86 },
      { skill: 'Python (Advanced)',         demand: 0.95 },
    ],
  },

  'ai engineer': {
    topNextRoles: [
      { role: 'Senior AI Engineer',         demand: 0.89 },
      { role: 'ML Platform Lead',           demand: 0.75 },
      { role: 'AI Research Engineer',       demand: 0.68 },
    ],
    topSkills: [
      { skill: 'LLM APIs (OpenAI / Anthropic)', demand: 0.96 },
      { skill: 'RAG Architecture',          demand: 0.93 },
      { skill: 'Vector Databases',          demand: 0.90 },
      { skill: 'Python (Advanced)',         demand: 0.94 },
      { skill: 'MLOps',                     demand: 0.86 },
    ],
  },

  'data engineer': {
    topNextRoles: [
      { role: 'Senior Data Engineer',       demand: 0.88 },
      { role: 'Analytics Engineer',         demand: 0.76 },
      { role: 'Data Platform Lead',         demand: 0.65 },
    ],
    topSkills: [
      { skill: 'Apache Spark',              demand: 0.91 },
      { skill: 'dbt',                       demand: 0.90 },
      { skill: 'Airflow',                   demand: 0.88 },
      { skill: 'SQL',                       demand: 0.95 },
      { skill: 'AWS / GCP Data Services',   demand: 0.87 },
    ],
  },

  // ── Design ───────────────────────────────────────────────────────────────────

  'ui/ux designer': {
    topNextRoles: [
      { role: 'Senior UX Designer',         demand: 0.84 },
      { role: 'Product Designer',           demand: 0.80 },
      { role: 'UX Researcher',              demand: 0.65 },
    ],
    topSkills: [
      { skill: 'Figma',                     demand: 0.96 },
      { skill: 'Prototyping',               demand: 0.91 },
      { skill: 'Design Systems',            demand: 0.89 },
      { skill: 'User Research',             demand: 0.86 },
      { skill: 'Accessibility (a11y)',      demand: 0.78 },
    ],
  },

  'product designer': {
    topNextRoles: [
      { role: 'Senior Product Designer',    demand: 0.85 },
      { role: 'Design Manager',             demand: 0.70 },
      { role: 'UX Lead',                    demand: 0.65 },
    ],
    topSkills: [
      { skill: 'Figma',                     demand: 0.97 },
      { skill: 'Design Systems',            demand: 0.92 },
      { skill: 'User Research',             demand: 0.88 },
      { skill: 'Cross-functional Collaboration', demand: 0.86 },
      { skill: 'Metrics-driven Design',     demand: 0.82 },
    ],
  },

  // ── Finance ──────────────────────────────────────────────────────────────────

  'financial analyst': {
    topNextRoles: [
      { role: 'Senior Financial Analyst',   demand: 0.86 },
      { role: 'Finance Manager',            demand: 0.72 },
      { role: 'FP&A Manager',              demand: 0.68 },
    ],
    topSkills: [
      { skill: 'Advanced Excel / VBA',      demand: 0.92 },
      { skill: 'Financial Modelling',       demand: 0.91 },
      { skill: 'SQL',                       demand: 0.86 },
      { skill: 'Power BI',                  demand: 0.82 },
      { skill: 'IFRS / Ind AS',            demand: 0.78 },
    ],
  },

  // ── Marketing ────────────────────────────────────────────────────────────────

  'digital marketing manager': {
    topNextRoles: [
      { role: 'Marketing Manager',          demand: 0.82 },
      { role: 'Growth Marketing Lead',      demand: 0.76 },
      { role: 'Director of Marketing',      demand: 0.60 },
    ],
    topSkills: [
      { skill: 'Performance Marketing',     demand: 0.93 },
      { skill: 'Google Analytics 4',        demand: 0.90 },
      { skill: 'SEO / SEM',                demand: 0.87 },
      { skill: 'Marketing Automation',      demand: 0.85 },
      { skill: 'A/B Testing',              demand: 0.80 },
    ],
  },

  // ── HR ───────────────────────────────────────────────────────────────────────

  'recruiter': {
    topNextRoles: [
      { role: 'Senior Recruiter',           demand: 0.83 },
      { role: 'HR Business Partner',        demand: 0.72 },
      { role: 'Talent Acquisition Manager', demand: 0.68 },
    ],
    topSkills: [
      { skill: 'Sourcing Strategies',       demand: 0.91 },
      { skill: 'ATS Platforms',             demand: 0.88 },
      { skill: 'Stakeholder Management',    demand: 0.86 },
      { skill: 'Employer Branding',         demand: 0.82 },
      { skill: 'Data-driven Recruiting',    demand: 0.78 },
    ],
  },

  // ── Operations / Project Management ─────────────────────────────────────────

  'project manager': {
    topNextRoles: [
      { role: 'Senior Project Manager',     demand: 0.84 },
      { role: 'Program Manager',            demand: 0.76 },
      { role: 'Operations Manager',         demand: 0.66 },
    ],
    topSkills: [
      { skill: 'Agile / Scrum',             demand: 0.92 },
      { skill: 'Risk Management',           demand: 0.88 },
      { skill: 'Stakeholder Management',    demand: 0.87 },
      { skill: 'JIRA / Confluence',         demand: 0.85 },
      { skill: 'PMP / PRINCE2',            demand: 0.78 },
    ],
  },

  'scrum master': {
    topNextRoles: [
      { role: 'Agile Coach',                demand: 0.80 },
      { role: 'Program Manager',            demand: 0.72 },
      { role: 'Delivery Manager',           demand: 0.68 },
    ],
    topSkills: [
      { skill: 'Agile Coaching',            demand: 0.93 },
      { skill: 'Facilitation',              demand: 0.90 },
      { skill: 'SAFe / LeSS',              demand: 0.84 },
      { skill: 'Conflict Resolution',       demand: 0.82 },
      { skill: 'Metrics & Reporting',       demand: 0.78 },
    ],
  },

  // ── Business Analysis ────────────────────────────────────────────────────────

  'business analyst': {
    topNextRoles: [
      { role: 'Senior Business Analyst',    demand: 0.86 },
      { role: 'Product Manager',            demand: 0.78 },
      { role: 'Product Analyst',            demand: 0.72 },
    ],
    topSkills: [
      { skill: 'SQL',                       demand: 0.93 },
      { skill: 'Requirements Gathering',    demand: 0.91 },
      { skill: 'Process Mapping (BPMN)',    demand: 0.87 },
      { skill: 'Stakeholder Management',    demand: 0.86 },
      { skill: 'Tableau / Power BI',        demand: 0.82 },
    ],
  },

  // ── Sales ────────────────────────────────────────────────────────────────────

  'business development': {
    topNextRoles: [
      { role: 'Sales Manager',              demand: 0.82 },
      { role: 'Strategic Partnerships Lead', demand: 0.74 },
      { role: 'Director of Business Development', demand: 0.62 },
    ],
    topSkills: [
      { skill: 'CRM (Salesforce / HubSpot)', demand: 0.92 },
      { skill: 'Consultative Selling',      demand: 0.89 },
      { skill: 'Pipeline Management',       demand: 0.87 },
      { skill: 'Negotiation',               demand: 0.86 },
      { skill: 'Market Research',           demand: 0.80 },
    ],
  },
};

// ─── Fallback / generic trends ───────────────────────────────────────────────

/**
 * Returned when the role is not in MOCK_CATALOGUE.
 * Generic but still useful for unknowns — uses the literal role string
 * to produce plausible "Senior <role>" and "Lead <role>" progressions.
 */
function buildGenericTrends(role: string): { topNextRoles: RoleDemand[]; topSkills: SkillDemand[] } {
  const title = role
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    topNextRoles: [
      { role: `Senior ${title}`,            demand: 0.80 },
      { role: `Lead ${title}`,              demand: 0.68 },
      { role: `${title} Manager`,           demand: 0.60 },
    ],
    topSkills: [
      { skill: 'Stakeholder Management',    demand: 0.88 },
      { skill: 'Communication',             demand: 0.85 },
      { skill: 'Data Analysis',             demand: 0.82 },
      { skill: 'Project Management',        demand: 0.78 },
      { skill: 'Critical Thinking',         demand: 0.75 },
    ],
  };
}

// ─── Mock provider ────────────────────────────────────────────────────────────

/**
/**
 * MockMarketDataProvider
 *
 * Serves data from MOCK_CATALOGUE; falls back to buildGenericTrends for
 * unknown roles. Never throws — always returns a non-null MarketTrends.
 * Used as the final safety-net fallback in every provider chain.
 */
class MockMarketDataProvider implements MarketDataProvider {
  readonly name = 'mock';

  async fetchTrends(normalisedRole: string): Promise<MarketTrends> {
    const catalogue = MOCK_CATALOGUE[normalisedRole] ?? buildGenericTrends(normalisedRole);
    return {
      role:         normalisedRole,
      topNextRoles: catalogue.topNextRoles,
      topSkills:    catalogue.topSkills,
      fetchedAt:    new Date().toISOString(),
      source:       'mock',
    };
  }
}

// ─── 24-hour in-process cache ─────────────────────────────────────────────────
//
// Next.js server modules are long-lived within a single deployment process.
// A module-level Map persists across requests (same Node.js process), giving
// us a free, zero-dependency 24 h cache with no Redis required.
//
// TTL: 24 hours — balances freshness against API quota burn.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

interface CacheEntry {
  data:      MarketTrends;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry>();

const MarketDataCache = {
  get(role: string): MarketTrends | null {
    const entry = _cache.get(role);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { _cache.delete(role); return null; }
    return entry.data;
  },
  set(role: string, data: MarketTrends): void {
    _cache.set(role, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  },
  /** Invalidate one role (or entire cache when called with no argument). */
  invalidate(role?: string): void {
    if (role) { _cache.delete(role); } else { _cache.clear(); }
  },
  size(): number { return _cache.size; },
};

// ─── Shared skill extractor ───────────────────────────────────────────────────
//
// Takes raw job description strings and returns SkillDemand[] ranked by
// keyword frequency, normalised to [0, 1] against the top-frequency skill.

const CANONICAL_SKILLS: readonly string[] = [
  // Engineering
  'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'Go',
  'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'GraphQL', 'REST APIs',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Terraform', 'CI/CD',
  'Git', 'System Design', 'Microservices', 'Distributed Systems',
  'Testing / QA', 'Debugging', 'Performance Optimisation',
  // Data / ML
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP',
  'Data Analysis', 'Statistics', 'dbt', 'Spark', 'Airflow', 'MLOps',
  'Tableau', 'Power BI', 'LLM', 'RAG', 'Vector Databases',
  // Product / Design
  'Product Roadmapping', 'A/B Testing', 'Analytics', 'OKR', 'Figma',
  'Prototyping', 'User Research', 'Design Systems', 'Accessibility',
  // Soft / Cross-functional
  'Stakeholder Management', 'Communication', 'Leadership',
  'Project Management', 'Agile', 'Scrum', 'Mentorship',
  'Cross-functional Collaboration', 'Executive Communication',
  // Finance / Marketing
  'Financial Modelling', 'Excel', 'SEO', 'Performance Marketing',
  'CRM', 'Google Analytics', 'Salesforce',
];

/**
 * Extracts skill demand signals from raw JD text blobs.
 * Counts occurrences of each canonical skill (case-insensitive substring),
 * then normalises to [0, 1] against the highest-frequency skill found.
 */
function extractSkillsFromJDs(jdTexts: string[], topN = 8): SkillDemand[] {
  if (jdTexts.length === 0) return [];
  const combined = jdTexts.join(' ').toLowerCase();
  const counts   = new Map<string, number>();
  for (const skill of CANONICAL_SKILLS) {
    const needle = skill.toLowerCase();
    let pos = 0, count = 0;
    while ((pos = combined.indexOf(needle, pos)) !== -1) { count++; pos += needle.length; }
    if (count > 0) counts.set(skill, count);
  }
  if (counts.size === 0) return [];
  const maxCount = Math.max(...counts.values());
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([skill, count]) => ({ skill, demand: parseFloat((count / maxCount).toFixed(3)) }));
}

/**
 * Normalises a map of { roleTitle → postingCount } into RoleDemand[].
 * The most-posted role gets demand 1.0; others are scaled proportionally.
 * Minimum demand 0.10 so every observed role has a non-zero signal.
 */
function deriveRoleDemandFromCounts(counts: Map<string, number>, topN = 5): RoleDemand[] {
  if (counts.size === 0) return [];
  const maxCount = Math.max(...counts.values());
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([role, count]) => ({
      role,
      demand: parseFloat(Math.max(0.10, count / maxCount).toFixed(3)),
    }));
}

/** Builds plausible next-role title queries from a base role string. */
function buildCandidateTitles(normalisedRole: string): string[] {
  const titleCased = normalisedRole
    .split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const candidates = [
    `Senior ${titleCased}`,
    `Lead ${titleCased}`,
    `Principal ${titleCased}`,
    `${titleCased} Manager`,
  ];
  if (normalisedRole.startsWith('senior ')) {
    const base = titleCased.replace(/^Senior\s+/i, '');
    candidates.push(`Director of ${base}`, `VP of ${base}`);
  }
  return [...new Set(candidates)].slice(0, 4);
}

// ─── JSearch provider (via RapidAPI) ─────────────────────────────────────────
//
// JSearch aggregates LinkedIn, Indeed, Glassdoor, and ZipRecruiter listings.
// Endpoint: GET https://jsearch.p.rapidapi.com/search
//
// Required env var:
//   RAPIDAPI_KEY   — from https://rapidapi.com/letscrape-6bZywFun5X2/api/jsearch
//   Free tier: 200 requests / month.
//
// Each getMarketTrends() call uses ≤4 requests but results are cached 24 h,
// so 200 req/month comfortably covers ~50 unique role lookups per month.

const JSEARCH_TIMEOUT_MS = 5_000;

class JSearchProvider implements MarketDataProvider {
  readonly name = 'jsearch';
  constructor(private readonly apiKey: string) {}

  async fetchTrends(normalisedRole: string): Promise<MarketTrends | null> {
    try {
      const titles  = buildCandidateTitles(normalisedRole);
      const settled = await Promise.allSettled(titles.map(t => this._searchJobs(t)));

      const roleCounts  = new Map<string, number>();
      const allJDTexts: string[] = [];

      settled.forEach((r, i) => {
        if (r.status !== 'fulfilled' || !r.value) return;
        roleCounts.set(titles[i], r.value.jobs.length);
        allJDTexts.push(...r.value.jobs.map((j: {
          job_title: string;
          job_description?: string;
          job_required_skills?: string[];
        }) => [j.job_title, j.job_description ?? '', (j.job_required_skills ?? []).join(' ')].join(' ')));
      });

      if (roleCounts.size === 0) return null;

      const topNextRoles = deriveRoleDemandFromCounts(roleCounts);
      const topSkills    = extractSkillsFromJDs(allJDTexts);
      if (topNextRoles.length === 0) return null;

      return {
        role: normalisedRole,
        topNextRoles,
        topSkills,
        fetchedAt: new Date().toISOString(),
        source: 'combined',
      };
    } catch (err: unknown) {
      console.warn(`[JSearchProvider] failed for "${normalisedRole}": ${(err as Error)?.message}`);
      return null;
    }
  }

  private async _searchJobs(title: string): Promise<{
    jobs: Array<{ job_title: string; job_description?: string; job_required_skills?: string[] }>;
  } | null> {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), JSEARCH_TIMEOUT_MS);
    try {
      const url = new URL('https://jsearch.p.rapidapi.com/search');
      url.searchParams.set('query',       title);
      url.searchParams.set('page',        '1');
      url.searchParams.set('num_pages',   '1');
      url.searchParams.set('country',     process.env.MARKET_API_COUNTRY ?? 'in');
      url.searchParams.set('date_posted', 'month');
      const res = await fetch(url.toString(), {
        signal:  controller.signal,
        headers: {
          'X-RapidAPI-Key':  this.apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      });
      if (!res.ok) { console.warn(`[JSearchProvider] HTTP ${res.status} for "${title}"`); return null; }
      const json = await res.json() as { data?: unknown[] };
      const jobs  = Array.isArray(json.data)
        ? (json.data as Array<{ job_title: string; job_description?: string; job_required_skills?: string[] }>)
        : [];
      return { jobs };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Adzuna provider ──────────────────────────────────────────────────────────
//
// Adzuna is a real job board with a developer API that covers India.
// Endpoint: GET https://api.adzuna.com/v1/api/jobs/{country}/search/1
//
// Required env vars:
//   MARKET_API_APP_ID   — Adzuna application ID
//   MARKET_API_APP_KEY  — Adzuna application key
//   Free developer tier: 250 requests / month.
//   https://developer.adzuna.com/
//
// Uses `count` from the response for demand scoring.
// Parses `results[].description` text for skill extraction.

const ADZUNA_TIMEOUT_MS = 6_000;

class AdzunaProvider implements MarketDataProvider {
  readonly name = 'adzuna';
  constructor(
    private readonly appId:   string,
    private readonly appKey:  string,
    private readonly country: string = 'in',
  ) {}

  async fetchTrends(normalisedRole: string): Promise<MarketTrends | null> {
    try {
      const titles  = buildCandidateTitles(normalisedRole);
      const settled = await Promise.allSettled(titles.map(t => this._searchJobs(t)));

      const roleCounts  = new Map<string, number>();
      const allJDTexts: string[] = [];

      settled.forEach((r, i) => {
        if (r.status !== 'fulfilled' || !r.value) return;
        if (r.value.count > 0) {
          roleCounts.set(titles[i], r.value.count);
          allJDTexts.push(...r.value.descriptions);
        }
      });

      if (roleCounts.size === 0) return null;

      const topNextRoles = deriveRoleDemandFromCounts(roleCounts);
      const topSkills    = extractSkillsFromJDs(allJDTexts);
      if (topNextRoles.length === 0) return null;

      return {
        role: normalisedRole,
        topNextRoles,
        topSkills,
        fetchedAt: new Date().toISOString(),
        source: 'combined',
      };
    } catch (err: unknown) {
      console.warn(`[AdzunaProvider] failed for "${normalisedRole}": ${(err as Error)?.message}`);
      return null;
    }
  }

  private async _searchJobs(title: string): Promise<{ count: number; descriptions: string[] } | null> {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), ADZUNA_TIMEOUT_MS);
    try {
      const url = new URL(`https://api.adzuna.com/v1/api/jobs/${this.country}/search/1`);
      url.searchParams.set('app_id',          this.appId);
      url.searchParams.set('app_key',         this.appKey);
      url.searchParams.set('what',            title);
      url.searchParams.set('results_per_page','10');
      url.searchParams.set('content-type',    'application/json');
      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) { console.warn(`[AdzunaProvider] HTTP ${res.status} for "${title}"`); return null; }
      const json = await res.json() as {
        count?:   number;
        results?: Array<{ title?: string; description?: string }>;
      };
      const count        = typeof json.count === 'number' ? json.count : 0;
      const descriptions = (json.results ?? [])
        .map((r: { title?: string; description?: string }) => `${r.title ?? ''} ${r.description ?? ''}`)
        .filter(Boolean);
      return { count, descriptions };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── CombinedMarketDataProvider ───────────────────────────────────────────────
//
// Tries each configured live provider sequentially — first non-null result wins.
// Falls back to MockMarketDataProvider if every live provider fails or returns
// empty results. Callers always receive a non-null MarketTrends.
//
// Fallback chain: JSearch → Adzuna → Mock

class CombinedMarketDataProvider implements MarketDataProvider {
  readonly name = 'combined';
  private readonly mock = new MockMarketDataProvider();
  constructor(private readonly chain: MarketDataProvider[]) {}

  async fetchTrends(normalisedRole: string): Promise<MarketTrends> {
    for (const provider of this.chain) {
      try {
        const result = await provider.fetchTrends(normalisedRole);
        if (result && result.topNextRoles.length > 0) {
          console.log(`[MarketData] ✓ ${provider.name} → "${normalisedRole}"`);
          return result;
        }
        console.warn(`[MarketData] ✗ ${provider.name} returned empty for "${normalisedRole}" — trying next`);
      } catch (err: unknown) {
        console.warn(`[MarketData] ✗ ${provider.name} threw for "${normalisedRole}": ${(err as Error)?.message}`);
      }
    }
    console.warn(`[MarketData] All providers failed for "${normalisedRole}" — using mock`);
    return this.mock.fetchTrends(normalisedRole);
  }
}

// ─── CachedMarketDataProvider ─────────────────────────────────────────────────
//
// Wraps any MarketDataProvider with the 24 h in-process cache.
// Cache hits return in < 1 ms — zero performance impact on the hot path.

class CachedMarketDataProvider implements MarketDataProvider {
  readonly name: string;
  constructor(private readonly inner: MarketDataProvider) {
    this.name = `cached(${inner.name})`;
  }

  async fetchTrends(normalisedRole: string): Promise<MarketTrends | null> {
    const cached = MarketDataCache.get(normalisedRole);
    if (cached) {
      console.log(`[MarketDataCache] HIT "${normalisedRole}" (source: ${cached.source})`);
      return cached;
    }
    const result = await this.inner.fetchTrends(normalisedRole);
    if (result) {
      MarketDataCache.set(normalisedRole, result);
      console.log(`[MarketDataCache] SET "${normalisedRole}" (TTL: 24 h, source: ${result.source})`);
    }
    return result;
  }
}

// ─── Active provider — auto-configured from environment ───────────────────────
//
// Add to .env.local to enable real market data:
//
//   # JSearch via RapidAPI (https://rapidapi.com/letscrape-6bZywFun5X2/api/jsearch)
//   RAPIDAPI_KEY=your_rapidapi_key
//
//   # Adzuna (https://developer.adzuna.com/)
//   MARKET_API_APP_ID=your_adzuna_app_id
//   MARKET_API_APP_KEY=your_adzuna_app_key
//
//   # Optional — job search country (default: in = India)
//   MARKET_API_COUNTRY=in
//
// With no keys set, MockMarketDataProvider is used — zero API calls, no errors.

function buildActiveProvider(): MarketDataProvider {
  const rapidApiKey  = process.env.RAPIDAPI_KEY?.trim();
  const adzunaAppId  = process.env.MARKET_API_APP_ID?.trim();
  const adzunaAppKey = process.env.MARKET_API_APP_KEY?.trim();
  const country      = process.env.MARKET_API_COUNTRY?.trim() ?? 'in';

  const live: MarketDataProvider[] = [];

  if (rapidApiKey) {
    live.push(new JSearchProvider(rapidApiKey));
    console.log('[marketDataService] JSearchProvider enabled');
  }
  if (adzunaAppId && adzunaAppKey) {
    live.push(new AdzunaProvider(adzunaAppId, adzunaAppKey, country));
    console.log('[marketDataService] AdzunaProvider enabled');
  }
  if (live.length === 0) {
    console.log('[marketDataService] No API keys — using MockMarketDataProvider');
    return new MockMarketDataProvider();
  }

  return new CachedMarketDataProvider(new CombinedMarketDataProvider(live));
}

const activeProvider: MarketDataProvider = buildActiveProvider();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * getMarketTrends(role)
 *
 * Returns market intelligence for the given role title.
 *
 * @param role  - Role title. Case-insensitive. Leading/trailing whitespace stripped.
 * @returns     MarketTrends snapshot with topNextRoles and topSkills.
 *
 * @example
 *   const trends = await getMarketTrends('Product Manager');
 *   // trends.topNextRoles[0] → { role: 'Senior Product Manager', demand: 0.85 }
 */
export async function getMarketTrends(role: string): Promise<MarketTrends> {
  if (!role || !role.trim()) {
    throw new Error('[marketDataService] getMarketTrends: role must be a non-empty string.');
  }

  const normalisedRole = role.trim().toLowerCase();

  const result = await activeProvider.fetchTrends(normalisedRole);

  // activeProvider.fetchTrends is guaranteed non-null for MockMarketDataProvider;
  // guard here for future providers that may return null on failure.
  if (!result) {
    console.warn(
      `[marketDataService] Provider "${activeProvider.name}" returned null for role "${normalisedRole}". ` +
      `Falling back to MockMarketDataProvider.`,
    );
    return new MockMarketDataProvider().fetchTrends(normalisedRole);
  }

  return result;
}

/**
 * getTopSkillsForRole(role, limit?)
 *
 * Convenience wrapper — returns only the topSkills array.
 *
 * @param role  - Role title (case-insensitive).
 * @param limit - Maximum number of skills to return. Defaults to 5.
 */
export async function getTopSkillsForRole(role: string, limit = 5): Promise<SkillDemand[]> {
  const trends = await getMarketTrends(role);
  return trends.topSkills.slice(0, limit);
}

/**
 * getTopNextRolesForRole(role, limit?)
 *
 * Convenience wrapper — returns only the topNextRoles array.
 *
 * @param role  - Role title (case-insensitive).
 * @param limit - Maximum number of roles to return. Defaults to 3.
 */
export async function getTopNextRolesForRole(role: string, limit = 3): Promise<RoleDemand[]> {
  const trends = await getMarketTrends(role);
  return trends.topNextRoles.slice(0, limit);
}