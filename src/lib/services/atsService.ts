/**
 * lib/services/atsService.ts
 *
 * ATS Scoring Engine — 4-dimension weighted scoring:
 *   Keyword Match    40%
 *   Content Strength 30%
 *   Skills Relevance 20%
 *   Formatting       10%
 */

import type { ResumeContent, AtsBreakdown, AtsSuggestion } from '@/lib/supabase';

// ─── Keyword database ──────────────────────────────────────────────────────────

const ROLE_KEYWORDS: Record<string, string[]> = {
  finance: [
    'financial reporting', 'budgeting', 'forecasting', 'variance analysis', 'P&L',
    'accounts payable', 'reconciliation', 'SAP', 'IFRS', 'GAAP', 'audit',
    'tax', 'MIS', 'excel', 'cost reduction', 'cash flow', 'financial modeling',
  ],
  software: [
    'react', 'typescript', 'node.js', 'sql', 'aws', 'docker', 'kubernetes',
    'ci/cd', 'api', 'git', 'agile', 'scrum', 'testing', 'microservices',
    'performance', 'system design', 'rest', 'graphql', 'python',
  ],
  marketing: [
    'SEO', 'SEM', 'campaigns', 'analytics', 'ROI', 'conversion rate',
    'content strategy', 'brand', 'digital marketing', 'social media',
    'A/B testing', 'funnel', 'CRM', 'email marketing', 'growth hacking',
  ],
  management: [
    'leadership', 'stakeholder management', 'project management', 'budget',
    'strategy', 'KPIs', 'OKRs', 'cross-functional', 'roadmap', 'P&L',
    'team building', 'change management', 'executive', 'delivery', 'agile',
  ],
  sales: [
    'revenue', 'quota', 'pipeline', 'CRM', 'B2B', 'SaaS', 'closing',
    'prospecting', 'account management', 'negotiation', 'ARR', 'MRR',
    'enterprise sales', 'customer success', 'upsell', 'salesforce',
  ],
  hr: [
    'recruitment', 'talent acquisition', 'onboarding', 'HRIS', 'payroll',
    'performance management', 'employee relations', 'compliance', 'L&D',
    'succession planning', 'compensation', 'benefits', 'workforce planning',
  ],
  design: [
    'figma', 'UX', 'UI', 'user research', 'wireframing', 'prototyping',
    'design system', 'accessibility', 'user testing', 'information architecture',
    'visual design', 'interaction design', 'Adobe', 'sketch', 'typography',
  ],
  data: [
    'python', 'SQL', 'machine learning', 'data analysis', 'tableau', 'power bi',
    'statistics', 'ETL', 'data pipeline', 'A/B testing', 'predictive modeling',
    'pandas', 'spark', 'big data', 'data visualization', 'deep learning',
  ],
  default: [
    'leadership', 'communication', 'analysis', 'strategy', 'management',
    'delivery', 'results', 'collaboration', 'problem solving', 'stakeholders',
    'project', 'performance', 'growth', 'improvement',
  ],
};

const WEAK_VERBS = [
  'did', 'made', 'worked on', 'helped', 'handled', 'was responsible for',
  'assisted with', 'supported', 'participated in', 'involved in',
];

const STRONG_VERBS = [
  'led', 'delivered', 'built', 'launched', 'increased', 'reduced',
  'optimized', 'accelerated', 'designed', 'engineered', 'managed',
  'achieved', 'drove', 'implemented', 'transformed', 'grew', 'scaled',
];

// ─── Role classification ───────────────────────────────────────────────────────

function classifyRole(role: string): string {
  const r = role.toLowerCase();
  if (/account|financ|audit|tax|bank|cfo|controller/.test(r))         return 'finance';
  if (/engineer|develop|software|code|programmer|backend|frontend/.test(r)) return 'software';
  if (/market|growth|seo|brand|content|digital|campaign/.test(r))     return 'marketing';
  if (/manager|director|head|lead|vp|chief|president/.test(r))        return 'management';
  if (/sales|account executive|bdr|sdr|revenue/.test(r))             return 'sales';
  if (/hr|human resources|talent|recruit|people ops/.test(r))        return 'hr';
  if (/design|ux|ui|product design/.test(r))                         return 'design';
  if (/data|analyst|scientist|ml|machine learning/.test(r))          return 'data';
  return 'default';
}

export function getRoleKeywords(role: string): string[] {
  return ROLE_KEYWORDS[classifyRole(role)] ?? ROLE_KEYWORDS.default;
}

// ─── Scoring components ────────────────────────────────────────────────────────

function scoreKeywordMatch(fullText: string, role: string): { score: number; matched: string[]; missing: string[] } {
  const lower    = fullText.toLowerCase();
  const keywords = getRoleKeywords(role);
  const matched  = keywords.filter(k => lower.includes(k.toLowerCase()));
  const missing  = keywords.filter(k => !lower.includes(k.toLowerCase()));
  return {
    score:   keywords.length ? Math.round((matched.length / keywords.length) * 100) : 50,
    matched,
    missing,
  };
}

function scoreContentStrength(resume: ResumeContent): { score: number; hasWeakVerbs: boolean; hasMetrics: boolean } {
  const allBullets = (resume.experience || [])
    .flatMap(e => e.bullets || [])
    .filter(b => b.trim());

  const hasWeakVerbs  = allBullets.some(b => WEAK_VERBS.some(v => b.toLowerCase().startsWith(v)));
  const hasStrongVerbs= allBullets.some(b => STRONG_VERBS.some(v => b.toLowerCase().startsWith(v)));
  const hasMetrics    = allBullets.some(b => /\d+%|\$\d+|\d+x|\d+ (people|team|clients|members|reports)/i.test(b));

  let score = 30;
  score += Math.min(allBullets.length * 4, 25);
  if (resume.summary?.length > 100) score += 12;
  else if (resume.summary?.length > 50) score += 6;
  if (hasMetrics)      score += 15;
  if (hasStrongVerbs)  score += 10;
  if (hasWeakVerbs)    score -= 12;

  return { score: Math.max(0, Math.min(100, score)), hasWeakVerbs, hasMetrics };
}

function scoreSkillsRelevance(resume: ResumeContent, role: string): number {
  const keywords   = getRoleKeywords(role);
  const skillLower = (resume.skills || []).map(s => s.toLowerCase());
  const matched    = keywords.filter(k => skillLower.some(s => s.includes(k.toLowerCase())));
  const countScore = Math.min((resume.skills?.length || 0) / 12, 1) * 50;
  const relevScore = keywords.length ? (matched.length / keywords.length) * 50 : 25;
  return Math.round(countScore + relevScore);
}

function scoreFormatting(resume: ResumeContent): number {
  const p = resume.personalInfo;
  let score = 30;
  if (p?.name?.trim())     score += 10;
  if (p?.email?.trim())    score += 10;
  if (p?.phone?.trim())    score += 8;
  if (p?.location?.trim()) score += 5;
  if (p?.linkedin?.trim()) score += 7;
  if (resume.summary?.length > 50)   score += 10;
  if (resume.experience?.length > 0) score += 10;
  if (resume.education?.length > 0)  score += 5;
  if (resume.skills?.length >= 5)    score += 5;
  return Math.min(100, score);
}

// ─── Suggestion engine ─────────────────────────────────────────────────────────

function buildSuggestions(
  missingKws:   string[],
  hasWeakVerbs: boolean,
  hasMetrics:   boolean,
  summaryLen:   number,
  skillCount:   number,
  fmtScore:     number,
): AtsSuggestion[] {
  const suggs: AtsSuggestion[] = [];

  missingKws.slice(0, 4).forEach((kw, i) => suggs.push({
    id:     `kw_${i}`,
    type:   'keyword',
    title:  `Add keyword: "${kw}"`,
    detail: `"${kw}" appears in 70%+ of job descriptions for this role. Add it naturally to your skills or experience.`,
    impact: '+4–6 ATS',
  }));

  if (hasWeakVerbs) suggs.push({
    id: 'verb_1', type: 'verb',
    title:  'Replace weak action verbs',
    detail: 'Phrases like "was responsible for", "helped", or "worked on" reduce ATS scores. Use: Led, Delivered, Built, Drove.',
    impact: '+5 ATS',
  });

  if (!hasMetrics) suggs.push({
    id: 'metric_1', type: 'metric',
    title:  'Add quantifiable achievements',
    detail: 'Bullets with numbers (%, $, team size, time saved) score 34% higher. Example: "Increased revenue by 28%".',
    impact: '+6 ATS',
  });

  if (summaryLen < 100) suggs.push({
    id: 'sum_1', type: 'format',
    title:  'Expand professional summary',
    detail: 'A 3–5 sentence summary improves keyword density and gives ATS more context. Aim for 80–150 words.',
    impact: '+3 ATS',
  });

  if (skillCount < 8) suggs.push({
    id: 'skills_1', type: 'skills',
    title:  `Add more skills (${skillCount}/10+ recommended)`,
    detail: 'Most competitive profiles list 10–15 skills. ATS parsers count and categorise them directly.',
    impact: '+5 ATS',
    premium: true,
  });

  if (fmtScore < 70) suggs.push({
    id: 'format_1', type: 'format',
    title:  'Complete contact information',
    detail: 'Missing phone, LinkedIn, or location reduces formatting score and can cause ATS rejection.',
    impact: '+3–7 ATS',
  });

  return suggs;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function calculateATS(resume: ResumeContent, targetRole: string): AtsBreakdown {
  const role     = targetRole || resume.targetRole || '';
  const fullText = [
    resume.summary || '',
    ...(resume.experience || []).flatMap(e => [e.jobTitle, e.company, ...e.bullets]),
    (resume.skills || []).join(' '),
  ].join(' ');

  const { score: kwScore, missing }                  = scoreKeywordMatch(fullText, role);
  const { score: csScore, hasWeakVerbs, hasMetrics } = scoreContentStrength(resume);
  const srScore                                       = scoreSkillsRelevance(resume, role);
  const fmtScore                                      = scoreFormatting(resume);

  const overall = Math.round(kwScore * 0.40 + csScore * 0.30 + srScore * 0.20 + fmtScore * 0.10);

  return {
    keywordMatch:    kwScore,
    contentStrength: csScore,
    skillsRelevance: srScore,
    formatting:      fmtScore,
    overall,
    missingKeywords: missing.slice(0, 8),
    suggestions: buildSuggestions(
      missing, hasWeakVerbs, hasMetrics,
      resume.summary?.length || 0,
      resume.skills?.length  || 0,
      fmtScore,
    ),
  };
}

export function quickScore(resume: ResumeContent, role: string): number {
  return calculateATS(resume, role).overall;
}