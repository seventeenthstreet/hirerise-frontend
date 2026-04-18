/**
 * lib/salaryData.ts
 *
 * Embedded salary dataset — role-keyed, INR, Lakh units.
 * Covers 40 roles across 8 job families.
 * Location multipliers applied at prediction time.
 *
 * Structure: { min, median, max } in Lakhs per annum at 0 YoE baseline.
 * Experience, skills, and ATS factors scale from these baselines.
 *
 * Future: swap ROLE_DATA entries with live API calls without changing
 * the calculation layer.
 */

export type LocationTier = 'metro' | 'tier1' | 'tier2' | 'tier3' | 'remote';

export interface SalaryBand {
  min:    number;   // LPA at baseline (0 yoe, 0 skills, 0 ats)
  median: number;
  max:    number;
}

export interface SalaryPrediction {
  role:          string;
  location:      LocationTier;
  experienceYears: number;
  // Predicted range for this user
  predicted:     SalaryBand;
  // Market range for this role/location (50th pct talent, avg skills)
  market:        SalaryBand;
  // Gap: predicted.median - market.median  (negative = below market)
  gap:           number;
  gapPercent:    number;
  // Score breakdown
  factors: {
    roleBaseline:      number;   // LPA
    experienceFactor:  number;   // multiplier
    skillsFactor:      number;   // multiplier
    atsFactor:         number;   // multiplier
    locationMultiplier: number;  // multiplier
  };
  // What-if at improved states
  simulator: SimulatorScenario[];
}

export interface SimulatorScenario {
  label:    string;
  action:   string;
  salary:   number;   // median LPA
  increase: number;   // delta from current predicted.median
  href:     string;
}

export interface SalaryInsight {
  id:   string;
  icon: string;
  type: 'gap' | 'strength' | 'action' | 'celebration';
  text: string;
}

// ─── Role salary dataset ───────────────────────────────────────────────────────
// All values in LPA (Lakhs Per Annum), INR, at median experience (3-4 yrs)
// min = 25th pct market, median = 50th pct, max = 90th pct

const ROLE_DATA: Record<string, SalaryBand & { family: string; keywords: string[] }> = {
  // ── Software Engineering ──────────────────────────────────────────────────
  'software engineer':           { min:6,  median:10, max:18, family:'Engineering', keywords:['javascript','python','java','react','node'] },
  'frontend developer':          { min:5,  median:9,  max:16, family:'Engineering', keywords:['react','css','javascript','typescript','html'] },
  'backend developer':           { min:6,  median:10, max:17, family:'Engineering', keywords:['node','python','java','sql','api'] },
  'full stack developer':        { min:6,  median:11, max:18, family:'Engineering', keywords:['react','node','javascript','sql','typescript'] },
  'senior software engineer':    { min:12, median:18, max:28, family:'Engineering', keywords:['system design','architecture','leadership','python','java'] },
  'tech lead':                   { min:18, median:25, max:38, family:'Engineering', keywords:['architecture','leadership','mentoring','system design'] },
  'engineering manager':         { min:25, median:35, max:52, family:'Engineering', keywords:['leadership','roadmap','hiring','agile','strategy'] },
  'director of engineering':     { min:35, median:52, max:75, family:'Engineering', keywords:['strategy','org design','p&l','executive'] },
  'mobile developer':            { min:5,  median:9,  max:16, family:'Engineering', keywords:['ios','android','react native','flutter','swift'] },
  'devops engineer':             { min:7,  median:12, max:20, family:'Engineering', keywords:['kubernetes','docker','ci/cd','aws','terraform'] },

  // ── Data & AI ─────────────────────────────────────────────────────────────
  'data scientist':              { min:8,  median:14, max:24, family:'Data', keywords:['python','ml','statistics','tensorflow','sql'] },
  'data analyst':                { min:5,  median:8,  max:14, family:'Data', keywords:['sql','excel','tableau','python','power bi'] },
  'data engineer':               { min:8,  median:14, max:22, family:'Data', keywords:['spark','airflow','sql','python','aws'] },
  'machine learning engineer':   { min:10, median:18, max:30, family:'Data', keywords:['python','ml','pytorch','tensorflow','mlops'] },
  'ai engineer':                 { min:12, median:20, max:35, family:'Data', keywords:['llm','python','pytorch','api','prompt engineering'] },
  'business analyst':            { min:5,  median:8,  max:14, family:'Data', keywords:['sql','excel','requirements','stakeholders','agile'] },

  // ── Product ───────────────────────────────────────────────────────────────
  'product manager':             { min:12, median:18, max:28, family:'Product', keywords:['roadmap','agile','stakeholders','metrics','user research'] },
  'senior product manager':      { min:20, median:30, max:48, family:'Product', keywords:['strategy','okrs','leadership','monetization','roadmap'] },
  'product analyst':             { min:6,  median:10, max:16, family:'Product', keywords:['sql','analytics','a/b testing','metrics','user research'] },

  // ── Design ────────────────────────────────────────────────────────────────
  'ui/ux designer':              { min:5,  median:9,  max:16, family:'Design', keywords:['figma','user research','prototyping','wireframing','design systems'] },
  'product designer':            { min:7,  median:12, max:20, family:'Design', keywords:['figma','ux','product thinking','design systems','research'] },
  'ux researcher':               { min:6,  median:10, max:17, family:'Design', keywords:['user research','usability testing','qualitative','quantitative'] },
  'graphic designer':            { min:3,  median:6,  max:12, family:'Design', keywords:['photoshop','illustrator','branding','typography','figma'] },

  // ── Finance & Accounting ──────────────────────────────────────────────────
  'financial analyst':           { min:6,  median:10, max:18, family:'Finance', keywords:['excel','financial modeling','valuation','sql','powerpoint'] },
  'accountant':                  { min:4,  median:7,  max:12, family:'Finance', keywords:['tally','gst','excel','accounting','audit'] },
  'finance manager':             { min:12, median:18, max:28, family:'Finance', keywords:['financial planning','budgeting','excel','reporting','leadership'] },
  'chartered accountant':        { min:8,  median:14, max:24, family:'Finance', keywords:['ca','audit','tax','ifrs','accounting'] },
  'investment analyst':          { min:8,  median:14, max:25, family:'Finance', keywords:['valuation','excel','financial modeling','research','cfa'] },

  // ── Marketing ─────────────────────────────────────────────────────────────
  'digital marketing manager':   { min:8,  median:14, max:22, family:'Marketing', keywords:['seo','sem','google ads','facebook ads','analytics'] },
  'content writer':              { min:3,  median:5,  max:10, family:'Marketing', keywords:['seo','content strategy','copywriting','cms','social media'] },
  'marketing manager':           { min:10, median:16, max:26, family:'Marketing', keywords:['brand','campaigns','analytics','team management','strategy'] },
  'growth hacker':               { min:8,  median:13, max:22, family:'Marketing', keywords:['seo','a/b testing','analytics','sql','paid acquisition'] },
  'seo specialist':              { min:4,  median:7,  max:13, family:'Marketing', keywords:['seo','content','google analytics','backlinks','technical seo'] },

  // ── Operations & HR ───────────────────────────────────────────────────────
  'hr manager':                  { min:7,  median:12, max:20, family:'HR', keywords:['recruitment','payroll','policy','leadership','hris'] },
  'recruiter':                   { min:4,  median:7,  max:14, family:'HR', keywords:['sourcing','interviewing','ats','stakeholder management'] },
  'operations manager':          { min:8,  median:14, max:22, family:'Operations', keywords:['process improvement','leadership','analytics','supply chain'] },
  'project manager':             { min:8,  median:13, max:22, family:'Operations', keywords:['pmp','agile','stakeholders','budget','risk management'] },
  'scrum master':                { min:8,  median:13, max:20, family:'Operations', keywords:['agile','scrum','jira','facilitation','team coaching'] },

  // ── Sales ─────────────────────────────────────────────────────────────────
  'sales manager':               { min:10, median:16, max:28, family:'Sales', keywords:['crm','negotiation','pipeline','leadership','b2b'] },
  'business development':        { min:7,  median:12, max:22, family:'Sales', keywords:['crm','b2b','pipeline','negotiation','partnerships'] },
};

// ─── Location multipliers ─────────────────────────────────────────────────────
const LOCATION_MULTIPLIERS: Record<LocationTier, number> = {
  metro:   1.0,   // Bangalore, Mumbai, Delhi, Hyderabad, Pune, Chennai
  tier1:   0.80,  // Ahmedabad, Kolkata, Jaipur, Kochi
  tier2:   0.65,  // Indore, Bhopal, Patna, Lucknow
  tier3:   0.55,  // Smaller cities
  remote:  0.90,  // Remote roles — slight discount vs metro
};

// ─── Experience multiplier curve ──────────────────────────────────────────────
// Returns a salary multiplier given years of experience (0→1.0, 10→2.1)
export function experienceMultiplier(years: number): number {
  if (years <= 0)  return 1.0;
  if (years <= 2)  return 1.0 + years * 0.12;          // 0-2 yrs: +12%/yr
  if (years <= 5)  return 1.24 + (years - 2) * 0.10;   // 2-5 yrs: +10%/yr
  if (years <= 10) return 1.54 + (years - 5) * 0.08;   // 5-10 yrs: +8%/yr
  return 1.94 + (years - 10) * 0.04;                    // 10+ yrs: +4%/yr
}

// ─── Skills match factor ──────────────────────────────────────────────────────
// 0.85 → 1.20 based on how many role-specific keywords appear in resume
export function skillsFactor(resumeSkills: string[], roleKeywords: string[]): number {
  if (!roleKeywords.length) return 1.0;
  const lower = resumeSkills.map(s => s.toLowerCase());
  const hits  = roleKeywords.filter(k => lower.some(s => s.includes(k.toLowerCase()))).length;
  const ratio = hits / roleKeywords.length;
  return 0.85 + ratio * 0.35;   // 0.85 → 1.20
}

// ─── ATS factor ───────────────────────────────────────────────────────────────
// 0.88 → 1.12 based on ATS score (higher ATS = better resume = more offers)
export function atsFactor(atsScore: number | null): number {
  if (atsScore === null) return 1.0;
  const norm = Math.min(100, Math.max(0, atsScore)) / 100;
  return 0.88 + norm * 0.24;   // 0.88 → 1.12
}

// ─── Role resolver ────────────────────────────────────────────────────────────
export function resolveRole(targetRole: string): { key: string; band: typeof ROLE_DATA[string] } | null {
  const lower = targetRole.toLowerCase().trim();

  // Exact match
  if (ROLE_DATA[lower]) return { key: lower, band: ROLE_DATA[lower] };

  // Partial match — find best overlap
  let bestKey = '';
  let bestScore = 0;
  for (const key of Object.keys(ROLE_DATA)) {
    const keyWords = key.split(' ');
    const inputWords = lower.split(' ');
    const overlap = keyWords.filter(w => inputWords.includes(w)).length;
    const score   = overlap / Math.max(keyWords.length, inputWords.length);
    if (score > bestScore) { bestScore = score; bestKey = key; }
  }

  if (bestScore >= 0.4) return { key: bestKey, band: ROLE_DATA[bestKey] };

  // Family fallback — look for family keyword
  const familyMatches: Record<string, string> = {
    engineer: 'software engineer', developer: 'software engineer',
    manager: 'product manager', analyst: 'business analyst',
    designer: 'ui/ux designer', accountant: 'accountant',
    recruiter: 'recruiter', writer: 'content writer',
  };
  for (const [kw, role] of Object.entries(familyMatches)) {
    if (lower.includes(kw)) return { key: role, band: ROLE_DATA[role] };
  }

  return null;   // unknown role
}

// ─── Core prediction ──────────────────────────────────────────────────────────
export interface PredictInput {
  targetRole:      string;
  location:        LocationTier;
  experienceYears: number;
  resumeSkills:    string[];
  atsScore:        number | null;
  currentSalary?:  number | null;   // LPA
}

export function predictSalary(input: PredictInput): SalaryPrediction {
  const resolved = resolveRole(input.targetRole);
  const band     = resolved?.band ?? { min: 5, median: 9, max: 16, family: 'General', keywords: [] };

  const locMul  = LOCATION_MULTIPLIERS[input.location] ?? 1.0;
  const expMul  = experienceMultiplier(input.experienceYears);
  const skillMul = skillsFactor(input.resumeSkills, band.keywords);
  const atsMul  = atsFactor(input.atsScore);

  // Market = average-skilled person (skillMul=1, atsMul=1) at this exp & location
  const market: SalaryBand = {
    min:    round(band.min    * locMul * expMul),
    median: round(band.median * locMul * expMul),
    max:    round(band.max    * locMul * expMul),
  };

  // Predicted = this user's specific factors applied
  const combinedMul = skillMul * atsMul;
  const predicted: SalaryBand = {
    min:    round(market.min    * combinedMul * 0.85),
    median: round(market.median * combinedMul),
    max:    round(market.max    * combinedMul * 1.10),
  };

  const gap        = round(predicted.median - market.median);
  const gapPercent = market.median > 0 ? Math.round((gap / market.median) * 100) : 0;

  // Growth simulator scenarios
  const simulator = buildSimulator(predicted.median, market.median, input, band);

  return {
    role:            resolved?.key ?? input.targetRole.toLowerCase(),
    location:        input.location,
    experienceYears: input.experienceYears,
    predicted, market, gap, gapPercent,
    factors: {
      roleBaseline:       band.median,
      experienceFactor:   expMul,
      skillsFactor:       skillMul,
      atsFactor:          atsMul,
      locationMultiplier: locMul,
    },
    simulator,
  };
}

// ─── Growth simulator ─────────────────────────────────────────────────────────
function buildSimulator(
  currentMedian: number,
  marketMedian:  number,
  input:         PredictInput,
  band:          typeof ROLE_DATA[string],
): SimulatorScenario[] {
  const scenarios: SimulatorScenario[] = [];

  // Scenario 1: improve ATS to 80
  const improvedAts    = atsFactor(80);
  const currentAts     = atsFactor(input.atsScore);
  const atsGain        = currentMedian * (improvedAts / currentAts) - currentMedian;
  if (Math.abs(atsGain) > 0.1) scenarios.push({
    label:    'Fix Resume to 80 ATS',
    action:   'Run Auto-Fix on your resume',
    salary:   round(currentMedian + atsGain),
    increase: round(atsGain),
    href:     '/resume-builder',
  });

  // Scenario 2: add 3 missing role skills
  const currentSkillMul = skillsFactor(input.resumeSkills, band.keywords);
  const improvedSkills  = Math.min(1.20, currentSkillMul + 0.10);
  const skillGain       = currentMedian * (improvedSkills / currentSkillMul) - currentMedian;
  if (Math.abs(skillGain) > 0.1) scenarios.push({
    label:    'Add 3 Role-Specific Skills',
    action:   'Learn missing skills for this role',
    salary:   round(currentMedian + skillGain),
    increase: round(skillGain),
    href:     '/skills',
  });

  // Scenario 3: +1 year experience
  const nextExpMul  = experienceMultiplier(input.experienceYears + 1);
  const currExpMul  = experienceMultiplier(input.experienceYears);
  const expGain     = currentMedian * (nextExpMul / currExpMul) - currentMedian;
  scenarios.push({
    label:    '+1 Year Experience',
    action:   'Apply to more senior roles as you grow',
    salary:   round(currentMedian + expGain),
    increase: round(expGain),
    href:     '/job-matches',
  });

  // Scenario 4: move to metro
  if (input.location !== 'metro') {
    const metroGain = currentMedian * (1.0 / (LOCATION_MULTIPLIERS[input.location] ?? 1)) - currentMedian;
    scenarios.push({
      label:    'Relocate to Metro City',
      action:   'Target metro-based roles (Bangalore, Mumbai, Delhi)',
      salary:   round(currentMedian + metroGain),
      increase: round(metroGain),
      href:     '/job-matches',
    });
  }

  return scenarios.sort((a, b) => b.increase - a.increase).slice(0, 4);
}

// ─── Static insights ──────────────────────────────────────────────────────────
export function buildStaticInsights(pred: SalaryPrediction): SalaryInsight[] {
  const ins: SalaryInsight[] = [];
  const { gap, gapPercent, factors, predicted, market } = pred;

  if (gapPercent >= 10) ins.push({
    id: 'above', icon: '🎯', type: 'celebration',
    text: `You're earning ${gapPercent}% above market median — strong position.`,
  });
  else if (gapPercent <= -15) ins.push({
    id: 'below', icon: '⚠️', type: 'gap',
    text: `Your predicted salary is ₹${Math.abs(gap).toFixed(1)}L below market median for ${pred.role}.`,
  });
  else ins.push({
    id: 'near', icon: '📊', type: 'strength',
    text: `Your salary is near the market median (₹${market.median.toFixed(1)}L) for ${pred.role}.`,
  });

  if (factors.atsFactor < 0.95) ins.push({
    id: 'ats', icon: '📄', type: 'action',
    text: 'A stronger resume (ATS 80+) typically commands 8-12% higher offers.',
  });

  if (factors.skillsFactor < 0.95) ins.push({
    id: 'skills', icon: '🧠', type: 'action',
    text: `Adding role-specific keywords to your resume can boost predicted salary by up to ₹${(market.median * 0.10).toFixed(1)}L.`,
  });

  if (factors.locationMultiplier < 1.0) ins.push({
    id: 'location', icon: '📍', type: 'action',
    text: 'Metro-based roles pay 15-45% more than non-metro for the same title.',
  });

  if (pred.experienceYears < 3) ins.push({
    id: 'exp', icon: '📈', type: 'action',
    text: 'Each year of experience adds 8-12% to salary in the early career phase.',
  });

  return ins.slice(0, 4);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function round(n: number): number {
  return Math.round(n * 10) / 10;   // 1 decimal place
}

export { ROLE_DATA, LOCATION_MULTIPLIERS };