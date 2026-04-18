// hooks/useTargetRole.ts
//
// Single source of truth for the user's target role.
//
// PROBLEM FIXED:
//   Previously, every component read `user.targetRole` directly — a value set
//   during onboarding that never updates after resume analysis. This caused
//   Career Probability, Career Path Guidance, Salary Benchmark, and the 90-Day
//   Plan to all show the wrong role (e.g. "Product Manager" for an Admin CV).
//
// SOLUTION:
//   1. If CHI is ready, derive the top career path from the actual CV analysis.
//   2. If the user has manually selected a role that matches a CV-derived path, honour it.
//   3. Only fall back to onboarding targetRole if no CV-derived paths exist.
//
// Usage:
//   const { targetRole, targetRoleId, cvPaths } = useTargetRole();

'use client';

import { useMemo }         from 'react';
import { useCareerHealth } from './useCareerHealth';
import { useProfile }      from './useProfile';

// Re-use the same deriveCareerPaths logic from dashboard
// (imported here so all consumers stay in sync)
export interface CareerPathSuggestion {
  role:      string;
  match:     number;
  domain:    string;
  topSkills: string[];
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function deriveCareerPaths(chi: any): CareerPathSuggestion[] {
  const score      = chi?.chiScore ?? 0;
  const profession = (chi?.detectedProfession ?? '').toLowerCase();
  const jobTitle   = (chi?.currentJobTitle    ?? '').toLowerCase();
  const profId     = `${profession} ${jobTitle}`.trim();
  const topSkills  = (chi?.topSkills ?? []).map((s: string) => s.toLowerCase()).join(' ');
  const gaps       = (chi?.skillGaps    ?? []).map((g: any) => (g.skillName ?? '').toLowerCase());
  const demand     = (chi?.demandMetrics ?? []).map((d: any) => (d.skillName ?? '').toLowerCase());
  const keywords   = `${profId} ${topSkills} ${gaps.join(' ')} ${demand.join(' ')}`;
  const has        = (kw: string[]) => kw.some(k => keywords.includes(k));

  if (has(['accountant','accounting','tally','gst','tds','bookkeeping','accounts payable',
            'accounts receivable','financial reporting','payroll','tax consultant','auditor',
            'audit manager','reconciliation','mis report','zoho books','quickbooks',
            'finance manager','cost accountant','chartered accountant','cfo','treasurer',
            'financial analyst'])) return [
    { role: 'Finance Manager',   match: clamp(score+32,62,96), domain: 'Finance',    topSkills: ['Financial Modelling','ERP Systems','Team Leadership'] },
    { role: 'Senior Accountant', match: clamp(score+28,60,94), domain: 'Accounting', topSkills: ['GST / TDS Compliance','MIS Reporting','Advanced Excel'] },
    { role: 'Tax Consultant',    match: clamp(score+22,55,90), domain: 'Taxation',   topSkills: ['Direct & Indirect Tax','ITR Filing','Tax Planning'] },
  ];

  if (has(['doctor','physician','surgeon','mbbs','medical officer','resident','nurse',
            'nursing','pharmacist','dentist','radiologist','pathologist','hospital',
            'clinical','patient care','healthcare','ward','icu','general practitioner',
            'specialist','physiotherapist','therapist'])) return [
    { role: 'Senior Medical Officer', match: clamp(score+30,62,96), domain: 'Healthcare',   topSkills: ['Clinical Leadership','Patient Management','Medical Research'] },
    { role: 'Healthcare Manager',     match: clamp(score+24,58,92), domain: 'Health Admin', topSkills: ['Hospital Operations','Quality Standards','Team Management'] },
    { role: 'Medical Consultant',     match: clamp(score+18,52,88), domain: 'Consulting',   topSkills: ['Specialist Expertise','Clinical Guidelines','Telemedicine'] },
  ];

  if (has(['lawyer','advocate','attorney','solicitor','barrister','legal counsel',
            'paralegal','llb','llm','corporate law','litigation','contract review',
            'legal advisor','compliance officer','intellectual property','patent'])) return [
    { role: 'Senior Legal Counsel', match: clamp(score+30,62,96), domain: 'Legal',        topSkills: ['Contract Drafting','Litigation Management','Legal Research'] },
    { role: 'Corporate Lawyer',     match: clamp(score+24,58,92), domain: 'Corporate Law',topSkills: ["M&A Due Diligence",'Regulatory Compliance','Negotiation'] },
    { role: 'Compliance Manager',   match: clamp(score+18,52,88), domain: 'Compliance',   topSkills: ['Regulatory Frameworks','Risk Assessment','Policy Writing'] },
  ];

  if (has(['teacher','professor','lecturer','educator','principal','school','curriculum',
            'pedagogy','academic','training','instructional design','b.ed','learning & development',
            'l&d','corporate trainer'])) return [
    { role: 'Senior Educator / HOD',  match: clamp(score+30,62,96), domain: 'Education',    topSkills: ['Curriculum Design','Academic Leadership','Assessment'] },
    { role: 'L&D Manager',            match: clamp(score+24,58,92), domain: 'Corporate L&D',topSkills: ['Training Needs Analysis','eLearning Tools','ROI Measurement'] },
    { role: 'EdTech Curriculum Lead', match: clamp(score+18,52,88), domain: 'EdTech',       topSkills: ['Content Development','LMS Platforms','Instructional Design'] },
  ];

  if (has(['recruitment','hr manager','human resource','talent acquisition','hrbp',
            'hr business partner','onboarding','performance management','employee relations',
            'compensation','hris','hr generalist','people ops'])) return [
    { role: 'HR Manager',              match: clamp(score+34,62,96), domain: 'Human Resources',topSkills: ['HRIS Systems','Talent Acquisition','L&D Strategy'] },
    { role: 'Talent Acquisition Lead', match: clamp(score+27,55,92), domain: 'Recruitment',   topSkills: ['Sourcing Strategies','ATS Tools','Employer Branding'] },
    { role: 'HR Business Partner',     match: clamp(score+20,48,87), domain: 'HR Strategy',   topSkills: ['Workforce Planning','OKRs','Change Management'] },
  ];

  if (has(['marketing','seo','sem','content marketing','social media','brand manager',
            'digital marketing','growth hacker','performance marketing','ppc',
            'campaign manager','crm','email marketing','copywriter','martech'])) return [
    { role: 'Marketing Manager', match: clamp(score+32,62,96), domain: 'Marketing', topSkills: ['Campaign Strategy','Analytics & Attribution','Team Leadership'] },
    { role: 'Growth Manager',    match: clamp(score+26,55,92), domain: 'Growth',    topSkills: ['A/B Testing','Funnel Optimisation','Data Analysis'] },
    { role: 'Brand Strategist',  match: clamp(score+20,48,87), domain: 'Brand',     topSkills: ['Brand Positioning','Consumer Research','Content Strategy'] },
  ];

  if (has(['admin','administrative','office management','office coordinator',
            'executive assistant','personal assistant','office executive',
            'office administration','clerical','secretary','receptionist',
            'correspondence','filing','data entry','stationery','attendance',
            'meeting minutes','document management','office operations',
            'ms office','google workspace','typing','scheduling',
            'junior admin','admin executive','admin intern'])) return [
    { role: 'Admin Executive',    match: clamp(score+35,60,95), domain: 'Administration', topSkills: ['MS Office Suite','Office Coordination','Document Management'] },
    { role: 'Office Manager',     match: clamp(score+27,54,90), domain: 'Administration', topSkills: ['Team Coordination','Vendor Management','MIS Reporting'] },
    { role: 'Executive Assistant',match: clamp(score+20,48,85), domain: 'Administration', topSkills: ['Calendar Management','Stakeholder Communication','Reporting'] },
  ];

  if (has(['machine learning','ml engineer','tensorflow','pytorch','nlp','data science','llm'])) return [
    { role: 'ML Engineer',        match: clamp(score+36,60,97), domain: 'AI / ML',      topSkills: ['PyTorch / TF','MLOps','Feature Engineering'] },
    { role: 'Data Scientist',     match: clamp(score+29,55,93), domain: 'Data Science', topSkills: ['Statistical Modelling','Python','Experiment Design'] },
    { role: 'AI Product Manager', match: clamp(score+22,48,88), domain: 'Product × AI', topSkills: ['AI Roadmapping','LLM APIs','Product Metrics'] },
  ];

  if (has(['sql','tableau','power bi','looker','dbt','bigquery','data analyst','bi engineer'])) return [
    { role: 'Data Analyst',    match: clamp(score+35,60,96), domain: 'Analytics', topSkills: ['SQL (Advanced)','Tableau / Power BI','Python Pandas'] },
    { role: 'BI Engineer',     match: clamp(score+28,55,92), domain: 'BI',        topSkills: ['dbt','Redshift / BigQuery','Dashboard Design'] },
    { role: 'Product Analyst', match: clamp(score+21,48,87), domain: 'Product',   topSkills: ['Mixpanel / Amplitude','A/B Testing','SQL'] },
  ];

  if (has(['software engineer','developer','react','typescript','node','python','java',
            'aws','docker','kubernetes','fullstack','backend','frontend'])) return [
    { role: 'Software Engineer',     match: clamp(score+33,60,96), domain: 'Engineering', topSkills: ['System Design','TypeScript','AWS / Cloud'] },
    { role: 'Backend Engineer',      match: clamp(score+26,55,92), domain: 'Engineering', topSkills: ['Node.js / Go','PostgreSQL','Docker / K8s'] },
    { role: 'Full Stack Developer',  match: clamp(score+20,48,87), domain: 'Engineering', topSkills: ['React','REST / GraphQL','CI/CD'] },
  ];

  if (has(['logistics','supply chain','procurement','warehouse','inventory','dispatch',
            'freight','shipping','vendor management','purchase','import export',
            'customs','delivery','fleet management'])) return [
    { role: 'Supply Chain Analyst',  match: clamp(score+32,58,94), domain: 'Supply Chain', topSkills: ['Inventory Optimisation','ERP Systems','Vendor Negotiation'] },
    { role: 'Procurement Executive', match: clamp(score+25,52,89), domain: 'Procurement',  topSkills: ['Purchase Orders','Supplier Management','Cost Reduction'] },
    { role: 'Logistics Coordinator', match: clamp(score+18,46,84), domain: 'Logistics',    topSkills: ['Freight Management','Route Planning','Documentation'] },
  ];

  if (has(['customer service','customer support','client servicing','call centre',
            'help desk','bpo','crm','ticketing','customer relations',
            'after sales','complaints handling','customer success'])) return [
    { role: 'Customer Success Manager', match: clamp(score+33,58,94), domain: 'Customer Success', topSkills: ['CRM Tools','Retention Strategy','Escalation Management'] },
    { role: 'Senior Support Executive', match: clamp(score+26,52,89), domain: 'Support',           topSkills: ['SLA Management','Ticketing Systems','Customer Communication'] },
    { role: 'Team Leader – CS',         match: clamp(score+19,46,84), domain: 'Support Ops',       topSkills: ['Team Coaching','Quality Monitoring','KPI Tracking'] },
  ];

  return [
    { role: 'Business Analyst',    match: clamp(score+30,58,94), domain: 'Business',   topSkills: ['Requirements Gathering','Process Mapping','Stakeholder Mgmt'] },
    { role: 'Operations Manager',  match: clamp(score+24,52,90), domain: 'Operations', topSkills: ['KPI Tracking','Process Optimisation','Team Leadership'] },
    { role: 'Management Consultant',match: clamp(score+18,46,84),domain: 'Consulting', topSkills: ['Problem Solving','Data Analysis','Presentation Skills'] },
  ];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseTargetRoleResult {
  /** The resolved target role name — always CV-derived when possible */
  targetRole:   string | null;
  /** Same value — alias used by components expecting "targetRoleId" */
  targetRoleId: string | null;
  /** All CV-derived career path suggestions */
  cvPaths:      CareerPathSuggestion[];
  /** True when CHI is ready and paths are derived from the actual CV */
  isCvDerived:  boolean;
}

export function useTargetRole(
  /** Optional: user-selected role from UI (e.g. clicked in CareerPathAI) */
  selectedRole?: string | null,
): UseTargetRoleResult {
  const { data: chi }     = useCareerHealth();
  const { data: profile } = useProfile();

  return useMemo(() => {
    const user     = profile?.user as any;
    const cvPaths  = chi?.isReady ? deriveCareerPaths(chi) : [];
    const isCvDerived = cvPaths.length > 0;

    // 1. User explicitly selected a role that exists in CV-derived paths → honour it
    if (selectedRole && cvPaths.some(p => p.role === selectedRole)) {
      return { targetRole: selectedRole, targetRoleId: selectedRole, cvPaths, isCvDerived };
    }

    // 2. CV-derived top path exists → always prefer this over stale onboarding value
    if (isCvDerived) {
      return { targetRole: cvPaths[0].role, targetRoleId: cvPaths[0].role, cvPaths, isCvDerived };
    }

    // 3. No CV analysis yet → fall back to onboarding value (may be null)
    const onboardingRole = user?.targetRoleId ?? user?.targetRole ?? null;
    return { targetRole: onboardingRole, targetRoleId: onboardingRole, cvPaths, isCvDerived: false };
  }, [chi, profile, selectedRole]);
}