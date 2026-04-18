/**
 * src/lib/data/roleSkills.ts
 *
 * Role → required skills mapping.
 * Grounded in the skills_registry.json canonical skill catalogue
 * from core/src/data/career-graph/skills_registry.json.
 *
 * Design decisions:
 *   - Role names are lowercase and match careerPaths.ts and salaryData.ts keys
 *   - Skills are split into `core` (must-have) and `preferred` (differentiators)
 *   - Skill strings use human-readable names from the registry (not slugs)
 *   - The `SkillCategory` type mirrors skills_registry categories for future joins
 *
 * Extensibility:
 *   - Add a role: insert a new key with core/preferred arrays
 *   - Add a skill: strings are plain text — no schema migration needed
 *   - Future: attach `demandScore` from skills_registry for priority ordering
 *   - Future: replace with a DB-backed query behind the same `getRoleSkills()` interface
 *
 * Usage:
 *   import { ROLE_SKILLS, getRoleSkills, getMissingSkills } from '@/lib/data/roleSkills';
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SkillCategory = 'technical' | 'domain' | 'soft' | 'tool';

export interface RoleSkillSet {
  /** Non-negotiable skills — typically assessed in interviews */
  core: string[];
  /** Nice-to-have skills that differentiate strong candidates */
  preferred: string[];
  /** Minimum years of experience before the core skills are credible */
  minExperienceYears: number;
}

// ─── Role skills map ──────────────────────────────────────────────────────────

export const ROLE_SKILLS: Readonly<Record<string, RoleSkillSet>> = {

  // ── Software Engineering ────────────────────────────────────────────────────

  'software engineer': {
    minExperienceYears: 0,
    core:      ['JavaScript', 'Git', 'REST APIs', 'Testing / QA', 'Debugging'],
    preferred: ['TypeScript', 'React', 'Node.js', 'SQL Querying', 'Docker (Basics)'],
  },

  'frontend developer': {
    minExperienceYears: 0,
    core:      ['JavaScript', 'React', 'CSS', 'Git', 'REST APIs'],
    preferred: ['TypeScript', 'Testing / QA', 'Design Systems', 'Figma', 'Webpack / Vite'],
  },

  'backend developer': {
    minExperienceYears: 0,
    core:      ['Node.js', 'REST APIs', 'SQL Querying', 'Git', 'Debugging'],
    preferred: ['Python (Advanced)', 'Docker (Basics)', 'AWS (Basics)', 'Message Queues', 'Testing / QA'],
  },

  'full stack developer': {
    minExperienceYears: 0,
    core:      ['JavaScript', 'React', 'Node.js', 'SQL Querying', 'REST APIs'],
    preferred: ['TypeScript', 'Docker (Basics)', 'AWS (Basics)', 'Testing / QA', 'CI/CD'],
  },

  'mobile developer': {
    minExperienceYears: 0,
    core:      ['React Native', 'JavaScript', 'REST APIs', 'Git', 'Debugging'],
    preferred: ['TypeScript', 'iOS', 'Android', 'Flutter', 'Mobile Testing'],
  },

  'devops engineer': {
    minExperienceYears: 2,
    core:      ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Terraform'],
    preferred: ['Google Cloud Platform', 'Monitoring & Alerting', 'Linux', 'Security', 'Python (Basics)'],
  },

  'senior software engineer': {
    minExperienceYears: 4,
    core:      ['System Design', 'REST APIs', 'Testing / QA', 'Code Review', 'Git'],
    preferred: ['Distributed Systems', 'Mentoring', 'Cloud Architecture', 'TypeScript', 'Performance Optimisation'],
  },

  'tech lead': {
    minExperienceYears: 6,
    core:      ['System Design', 'Architecture', 'Mentoring', 'CI/CD', 'Cloud Platforms'],
    preferred: ['Stakeholder Communication', 'Agile / Scrum', 'Budget Management', 'Distributed Systems', 'Team Coordination'],
  },

  'engineering manager': {
    minExperienceYears: 8,
    core:      ['People Management', 'Hiring / Talent Acquisition', 'System Design', 'Stakeholder Management', 'Agile / Scrum'],
    preferred: ['Budget Management', 'OKRs', 'Executive Communication', 'Roadmapping', 'Performance Management'],
  },

  'director of engineering': {
    minExperienceYears: 12,
    core:      ['People Management', 'Executive Communication', 'Stakeholder Management', 'Roadmapping', 'Budget Management'],
    preferred: ['Business Acumen', 'OKRs', 'Data Strategy', 'Hiring / Talent Acquisition', 'Product Strategy'],
  },

  // ── Data & Analytics ────────────────────────────────────────────────────────

  'data analyst': {
    minExperienceYears: 0,
    core:      ['SQL Querying', 'Excel (Advanced)', 'Data Visualisation', 'Statistics (Basics)', 'Data Analysis'],
    preferred: ['Python for Data', 'Tableau', 'Power BI', 'A/B Testing', 'Google Analytics'],
  },

  'senior data analyst': {
    minExperienceYears: 3,
    core:      ['SQL (Advanced)', 'Python for Data', 'Data Visualisation', 'Statistics (Basics)', 'Stakeholder Communication'],
    preferred: ['Machine Learning (Basics)', 'Tableau', 'Forecasting', 'A/B Testing', 'Data Modelling'],
  },

  'data scientist': {
    minExperienceYears: 2,
    core:      ['Python for ML', 'Machine Learning', 'Statistical Modelling', 'SQL (Advanced)', 'Feature Engineering'],
    preferred: ['Deep Learning', 'NLP', 'Apache Spark', 'Model Deployment / MLOps', 'Data Visualisation'],
  },

  'senior data scientist': {
    minExperienceYears: 5,
    core:      ['Python for ML', 'Machine Learning', 'Statistical Modelling', 'Model Deployment / MLOps', 'Mentoring'],
    preferred: ['Deep Learning', 'NLP', 'Data Architecture', 'Stakeholder Communication', 'Business Acumen'],
  },

  'data science manager': {
    minExperienceYears: 8,
    core:      ['People Management', 'Machine Learning', 'Data Strategy', 'Stakeholder Management', 'OKRs'],
    preferred: ['Data Governance', 'Business Acumen', 'Executive Communication', 'Budget Management', 'Hiring / Talent Acquisition'],
  },

  'director of data': {
    minExperienceYears: 12,
    core:      ['Data Strategy', 'Data Governance', 'People Management', 'Executive Communication', 'Business Acumen'],
    preferred: ['Data Architecture', 'OKRs', 'Budget Management', 'Stakeholder Management', 'Machine Learning'],
  },

  'data engineer': {
    minExperienceYears: 1,
    core:      ['SQL (Advanced)', 'Python for Data', 'ETL Pipelines', 'Apache Spark', 'Data Warehousing'],
    preferred: ['Apache Airflow', 'dbt', 'Apache Kafka', 'AWS', 'Data Modelling'],
  },

  'senior data engineer': {
    minExperienceYears: 4,
    core:      ['Apache Spark', 'Apache Airflow', 'Data Architecture', 'ETL Pipelines', 'Cloud Platforms'],
    preferred: ['Databricks', 'Apache Kafka', 'dbt', 'Mentoring', 'Data Governance'],
  },

  'lead data engineer': {
    minExperienceYears: 7,
    core:      ['Data Architecture', 'Data Governance', 'Apache Spark', 'Cloud Architecture', 'Mentoring'],
    preferred: ['People Management', 'Budget Management', 'Stakeholder Communication', 'Data Strategy', 'System Design'],
  },

  'machine learning engineer': {
    minExperienceYears: 2,
    core:      ['Python for ML', 'Machine Learning', 'Model Deployment / MLOps', 'Deep Learning', 'REST APIs'],
    preferred: ['Feature Engineering', 'Apache Spark', 'Kubernetes', 'Cloud Platforms', 'NLP'],
  },

  'ai engineer': {
    minExperienceYears: 3,
    core:      ['Python for ML', 'Machine Learning', 'Deep Learning', 'Model Deployment / MLOps', 'NLP'],
    preferred: ['Large Language Models', 'Vector Databases', 'Cloud Platforms', 'REST APIs', 'Feature Engineering'],
  },

  'business analyst': {
    minExperienceYears: 0,
    core:      ['SQL Querying', 'Excel (Advanced)', 'Requirements Analysis', 'Stakeholder Communication', 'Data Analysis'],
    preferred: ['Agile / Scrum', 'Process Mapping', 'Tableau', 'Python (Basics)', 'JIRA'],
  },

  'senior business analyst': {
    minExperienceYears: 3,
    core:      ['SQL (Advanced)', 'Stakeholder Management', 'Requirements Analysis', 'Data Analysis', 'Business Acumen'],
    preferred: ['Product Strategy', 'Agile / Scrum', 'Forecasting', 'Excel (Advanced)', 'Power BI'],
  },

  'product analyst': {
    minExperienceYears: 0,
    core:      ['SQL Querying', 'A/B Testing', 'Data Analysis', 'Google Analytics', 'Product Thinking'],
    preferred: ['Python for Data', 'Tableau', 'User Research', 'Figma', 'Stakeholder Communication'],
  },

  // ── Product Management ──────────────────────────────────────────────────────

  'product manager': {
    minExperienceYears: 2,
    core:      ['Roadmapping', 'Agile / Scrum', 'Stakeholder Management', 'Data Analysis', 'User Research'],
    preferred: ['SQL Querying', 'A/B Testing', 'Go-to-Market', 'Figma', 'OKRs'],
  },

  'senior product manager': {
    minExperienceYears: 5,
    core:      ['Product Strategy', 'Roadmapping', 'OKRs', 'Stakeholder Management', 'Go-to-Market'],
    preferred: ['People Management', 'Monetisation Strategy', 'Data Strategy', 'Executive Communication', 'Budgeting'],
  },

  'director of product': {
    minExperienceYears: 8,
    core:      ['Product Strategy', 'People Management', 'OKRs', 'Executive Communication', 'Stakeholder Management'],
    preferred: ['Business Acumen', 'Budget Management', 'Data Strategy', 'Hiring / Talent Acquisition', 'P&L Management'],
  },

  'vp of product': {
    minExperienceYears: 12,
    core:      ['Product Strategy', 'Executive Communication', 'People Management', 'Business Acumen', 'OKRs'],
    preferred: ['P&L Management', 'Data Strategy', 'Budget Management', 'Board Communication', 'Market Analysis'],
  },

  // ── Design ──────────────────────────────────────────────────────────────────

  'graphic designer': {
    minExperienceYears: 0,
    core:      ['Figma', 'Adobe Illustrator', 'Adobe Photoshop', 'Typography', 'Brand Identity'],
    preferred: ['Motion Graphics', 'Design Systems', 'Copywriting', 'Social Media Design', 'Print Design'],
  },

  'ui/ux designer': {
    minExperienceYears: 1,
    core:      ['Figma', 'Wireframing', 'Prototyping', 'User Research', 'Design Thinking'],
    preferred: ['Usability Testing', 'Design Systems', 'Information Architecture', 'Accessibility', 'HTML/CSS (Basics)'],
  },

  'product designer': {
    minExperienceYears: 2,
    core:      ['Figma', 'Design Systems', 'User Research', 'Prototyping', 'Product Thinking'],
    preferred: ['Information Architecture', 'Usability Testing', 'Stakeholder Communication', 'A/B Testing', 'Design Metrics'],
  },

  'ux researcher': {
    minExperienceYears: 1,
    core:      ['User Research', 'Usability Testing', 'Qualitative Research', 'Survey Design', 'Research Analysis'],
    preferred: ['Quantitative Research', 'Data Analysis', 'Stakeholder Communication', 'Figma', 'Statistics (Basics)'],
  },

  'senior ux researcher': {
    minExperienceYears: 4,
    core:      ['User Research', 'Research Strategy', 'Stakeholder Management', 'Mixed Methods Research', 'Data Analysis'],
    preferred: ['People Management', 'Workshop Facilitation', 'Quantitative Research', 'Business Acumen', 'Statistical Modelling'],
  },

  'senior ux designer': {
    minExperienceYears: 4,
    core:      ['Figma', 'Design Systems', 'User Research', 'Prototyping', 'Mentoring'],
    preferred: ['Stakeholder Management', 'A/B Testing', 'Information Architecture', 'Design Metrics', 'Accessibility'],
  },

  'design manager': {
    minExperienceYears: 7,
    core:      ['People Management', 'Design Systems', 'Stakeholder Management', 'Roadmapping', 'Mentoring'],
    preferred: ['Hiring / Talent Acquisition', 'OKRs', 'Budget Management', 'Executive Communication', 'Design Strategy'],
  },

  'director of design': {
    minExperienceYears: 10,
    core:      ['Design Strategy', 'People Management', 'Executive Communication', 'Stakeholder Management', 'OKRs'],
    preferred: ['Business Acumen', 'Budget Management', 'Brand Strategy', 'Hiring / Talent Acquisition', 'Product Strategy'],
  },

  // ── Finance & Accounting ────────────────────────────────────────────────────

  'accountant': {
    minExperienceYears: 0,
    core:      ['Bookkeeping', 'Financial Reporting', 'Tally ERP', 'GST Filing', 'Taxation'],
    preferred: ['Excel (Advanced)', 'Audit', 'IFRS / GAAP', 'Payroll Processing', 'SAP FICO'],
  },

  'senior accountant': {
    minExperienceYears: 3,
    core:      ['Financial Reporting', 'IFRS / GAAP', 'Audit', 'Taxation', 'Excel (Advanced)'],
    preferred: ['ERP Systems', 'SAP FICO', 'Variance Analysis', 'Financial Planning & Analysis', 'People Management'],
  },

  'chartered accountant': {
    minExperienceYears: 3,
    core:      ['Audit', 'Taxation', 'Financial Reporting', 'IFRS / GAAP', 'Financial Modelling'],
    preferred: ['ERP Systems', 'SAP FICO', 'Forecasting', 'Stakeholder Communication', 'Financial Planning & Analysis'],
  },

  'financial analyst': {
    minExperienceYears: 0,
    core:      ['Financial Modelling', 'Excel (Advanced)', 'Financial Reporting', 'Variance Analysis', 'Data Analysis'],
    preferred: ['SQL Querying', 'Forecasting', 'PowerPoint', 'Tableau', 'Python for Finance'],
  },

  'senior financial analyst': {
    minExperienceYears: 3,
    core:      ['Financial Modelling', 'Forecasting', 'Variance Analysis', 'Stakeholder Communication', 'Excel (Advanced)'],
    preferred: ['Financial Planning & Analysis', 'SQL (Advanced)', 'ERP Systems', 'Budgeting', 'Python for Finance'],
  },

  'investment analyst': {
    minExperienceYears: 0,
    core:      ['Financial Modelling', 'Valuation', 'Excel (Advanced)', 'Research & Analysis', 'Financial Reporting'],
    preferred: ['CFA (Level 1)', 'Bloomberg Terminal', 'SQL Querying', 'Python for Finance', 'Forecasting'],
  },

  'senior investment analyst': {
    minExperienceYears: 3,
    core:      ['Valuation', 'Financial Modelling', 'Investment Research', 'Stakeholder Communication', 'Portfolio Analysis'],
    preferred: ['CFA (Level 2)', 'Forecasting', 'Python for Finance', 'Bloomberg Terminal', 'Risk Management'],
  },

  'finance manager': {
    minExperienceYears: 7,
    core:      ['Financial Planning & Analysis', 'Budgeting', 'Forecasting', 'People Management', 'Stakeholder Management'],
    preferred: ['ERP Systems', 'Business Acumen', 'OKRs', 'Executive Communication', 'Risk Management'],
  },

  'cfo': {
    minExperienceYears: 12,
    core:      ['Financial Planning & Analysis', 'Executive Communication', 'People Management', 'Business Acumen', 'Risk Management'],
    preferred: ['Investor Relations', 'Fundraising', 'M&A', 'Board Communication', 'Data Strategy'],
  },

  // ── Marketing ───────────────────────────────────────────────────────────────

  'content writer': {
    minExperienceYears: 0,
    core:      ['Content Writing', 'SEO (Basics)', 'Copywriting', 'Research & Analysis', 'CMS Tools'],
    preferred: ['Social Media Marketing', 'Email Marketing', 'WordPress', 'Analytics', 'Brand Voice'],
  },

  'senior content writer': {
    minExperienceYears: 3,
    core:      ['Content Writing', 'SEO (Advanced)', 'Content Strategy', 'Stakeholder Communication', 'Copywriting'],
    preferred: ['Email Marketing', 'Marketing Analytics', 'Brand Strategy', 'Social Media Marketing', 'Mentoring'],
  },

  'content manager': {
    minExperienceYears: 4,
    core:      ['Content Strategy', 'SEO (Advanced)', 'People Management', 'Editorial Planning', 'Stakeholder Communication'],
    preferred: ['Marketing Analytics', 'Brand Strategy', 'Email Marketing', 'Budgeting', 'CMS Tools'],
  },

  'seo specialist': {
    minExperienceYears: 0,
    core:      ['SEO (Advanced)', 'Google Analytics', 'Content Writing', 'Link Building', 'Technical SEO'],
    preferred: ['Google Ads', 'SQL Querying', 'Python (Basics)', 'Screaming Frog', 'Data Visualisation'],
  },

  'growth hacker': {
    minExperienceYears: 1,
    core:      ['A/B Testing', 'Data Analysis', 'SEO (Advanced)', 'Google Analytics', 'Paid Acquisition'],
    preferred: ['SQL Querying', 'Marketing Analytics', 'Email Marketing', 'Product Thinking', 'Python (Basics)'],
  },

  'digital marketing manager': {
    minExperienceYears: 3,
    core:      ['SEO (Advanced)', 'Google Ads', 'Marketing Analytics', 'Social Media Marketing', 'Email Marketing'],
    preferred: ['Facebook Ads', 'Marketing Strategy', 'A/B Testing', 'CRM Tools', 'Stakeholder Communication'],
  },

  'marketing manager': {
    minExperienceYears: 5,
    core:      ['Marketing Strategy', 'Brand Strategy', 'People Management', 'Stakeholder Management', 'Marketing Analytics'],
    preferred: ['Budget Management', 'Go-to-Market', 'OKRs', 'Executive Communication', 'CRM Tools'],
  },

  'director of marketing': {
    minExperienceYears: 8,
    core:      ['Marketing Strategy', 'Brand Strategy', 'People Management', 'Executive Communication', 'Budget Management'],
    preferred: ['OKRs', 'Business Acumen', 'Hiring / Talent Acquisition', 'Data Strategy', 'Stakeholder Management'],
  },

  'vp of marketing': {
    minExperienceYears: 12,
    core:      ['Marketing Strategy', 'Executive Communication', 'People Management', 'Business Acumen', 'Budget Management'],
    preferred: ['Board Communication', 'P&L Management', 'Brand Strategy', 'Data Strategy', 'Investor Relations'],
  },

  // ── HR & People ─────────────────────────────────────────────────────────────

  'recruiter': {
    minExperienceYears: 0,
    core:      ['Recruitment', 'Sourcing', 'Interviewing', 'HRIS', 'Stakeholder Communication'],
    preferred: ['Boolean Search', 'LinkedIn Recruiter', 'Employer Branding', 'ATS Tools', 'Negotiation'],
  },

  'senior recruiter': {
    minExperienceYears: 3,
    core:      ['Recruitment', 'Stakeholder Management', 'Employer Branding', 'Data Analysis', 'HRIS'],
    preferred: ['People Management', 'Hiring Strategy', 'Executive Search', 'Compensation & Benefits', 'Mentoring'],
  },

  'hr manager': {
    minExperienceYears: 5,
    core:      ['People Management', 'Recruitment', 'Employee Relations', 'Performance Management', 'Labour Law'],
    preferred: ['HRIS', 'Compensation & Benefits', 'Payroll Processing', 'Stakeholder Management', 'Training & Development'],
  },

  'hr director': {
    minExperienceYears: 9,
    core:      ['People Management', 'HR Strategy', 'Executive Communication', 'Labour Law', 'Stakeholder Management'],
    preferred: ['OKRs', 'Budget Management', 'Organisational Design', 'Employee Experience', 'Business Acumen'],
  },

  'chief people officer': {
    minExperienceYears: 14,
    core:      ['People Management', 'Executive Communication', 'HR Strategy', 'Business Acumen', 'Stakeholder Management'],
    preferred: ['Board Communication', 'Organisational Design', 'Culture Building', 'OKRs', 'Budget Management'],
  },

  // ── Operations ──────────────────────────────────────────────────────────────

  'scrum master': {
    minExperienceYears: 1,
    core:      ['Agile / Scrum', 'Facilitation', 'Stakeholder Communication', 'JIRA', 'Team Coordination'],
    preferred: ['Kanban', 'Coaching', 'Risk Management', 'Confluence', 'Lean'],
  },

  'project manager': {
    minExperienceYears: 2,
    core:      ['Project Planning', 'Stakeholder Management', 'Risk Management', 'Agile / Scrum', 'Budget Management'],
    preferred: ['PMP Certification', 'MS Project', 'JIRA', 'Resource Management', 'Executive Communication'],
  },

  'program manager': {
    minExperienceYears: 5,
    core:      ['Program Planning', 'Stakeholder Management', 'Risk Management', 'Budget Management', 'People Management'],
    preferred: ['OKRs', 'Executive Communication', 'Change Management', 'Vendor Management', 'Business Acumen'],
  },

  'operations manager': {
    minExperienceYears: 5,
    core:      ['Process Improvement', 'People Management', 'Data Analysis', 'Stakeholder Management', 'Budget Management'],
    preferred: ['Supply Chain', 'ERP Systems', 'Six Sigma', 'OKRs', 'Risk Management'],
  },

  'director of operations': {
    minExperienceYears: 9,
    core:      ['People Management', 'Executive Communication', 'Stakeholder Management', 'Budget Management', 'OKRs'],
    preferred: ['Business Acumen', 'Change Management', 'Process Improvement', 'Risk Management', 'Data Strategy'],
  },

  'chief operating officer': {
    minExperienceYears: 14,
    core:      ['Executive Communication', 'People Management', 'Business Acumen', 'Stakeholder Management', 'P&L Management'],
    preferred: ['Board Communication', 'OKRs', 'Change Management', 'Data Strategy', 'Risk Management'],
  },

  // ── Sales ────────────────────────────────────────────────────────────────────

  'business development': {
    minExperienceYears: 0,
    core:      ['B2B Sales', 'CRM Tools', 'Negotiation', 'Lead Generation', 'Stakeholder Communication'],
    preferred: ['Partnership Management', 'Data Analysis', 'LinkedIn Sales Navigator', 'Presentation Skills', 'Market Research'],
  },

  'sales manager': {
    minExperienceYears: 4,
    core:      ['People Management', 'CRM Tools', 'Negotiation', 'Pipeline Management', 'B2B Sales'],
    preferred: ['Sales Forecasting', 'Stakeholder Management', 'Budget Management', 'Coaching', 'Data Analysis'],
  },

  'director of sales': {
    minExperienceYears: 8,
    core:      ['People Management', 'Sales Strategy', 'Executive Communication', 'Stakeholder Management', 'Revenue Forecasting'],
    preferred: ['Business Acumen', 'Budget Management', 'OKRs', 'Hiring / Talent Acquisition', 'Enterprise Sales'],
  },

  'vp of sales': {
    minExperienceYears: 12,
    core:      ['Sales Strategy', 'Executive Communication', 'People Management', 'Business Acumen', 'Revenue Forecasting'],
    preferred: ['Board Communication', 'P&L Management', 'OKRs', 'Budget Management', 'Go-to-Market'],
  },

} as const;

// ─── Accessor helpers ─────────────────────────────────────────────────────────

/**
 * Returns the full skill set for a role, or null if the role is unknown.
 * Case-insensitive.
 */
export function getRoleSkills(role: string): RoleSkillSet | null {
  return ROLE_SKILLS[role.toLowerCase().trim()] ?? null;
}

/**
 * Returns skills the user is missing for a target role, split by priority.
 *
 * @param targetRole  - The role the user is targeting
 * @param userSkills  - Skills the user currently has (any casing)
 */
export function getMissingSkills(
  targetRole:  string,
  userSkills:  string[],
): { missingCore: string[]; missingPreferred: string[] } {
  const entry = getRoleSkills(targetRole);
  if (!entry) return { missingCore: [], missingPreferred: [] };

  const lower = userSkills.map(s => s.toLowerCase());
  const has   = (skill: string) =>
    lower.some(u => u.includes(skill.toLowerCase()) || skill.toLowerCase().includes(u));

  return {
    missingCore:      entry.core.filter(s => !has(s)),
    missingPreferred: entry.preferred.filter(s => !has(s)),
  };
}

/**
 * Returns all roles that require a given skill (core or preferred).
 * Useful for "roles that match your skills" recommendations.
 */
export function getRolesForSkill(skill: string): string[] {
  const lower = skill.toLowerCase();
  return Object.entries(ROLE_SKILLS)
    .filter(([, entry]) =>
      entry.core.some(s => s.toLowerCase().includes(lower)) ||
      entry.preferred.some(s => s.toLowerCase().includes(lower))
    )
    .map(([role]) => role);
}

/**
 * Returns all distinct skill strings across all roles (deduplicated).
 * Useful for autocomplete inputs.
 */
export function getAllSkills(): string[] {
  const set = new Set<string>();
  for (const entry of Object.values(ROLE_SKILLS)) {
    entry.core.forEach(s => set.add(s));
    entry.preferred.forEach(s => set.add(s));
  }
  return [...set].sort();
}