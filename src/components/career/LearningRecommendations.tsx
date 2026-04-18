'use client';

// components/career/LearningRecommendations.tsx — v3 reskin + dynamic skill descriptions
// All existing hook logic preserved. UI upgraded to card-v3 system.
// New: each topic card shows specific skills to learn (derived from gap data).

import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useProfile }      from '@/hooks/useProfile';
import { useHasResume }    from '@/hooks/useHasResume';
import { useTargetRole }   from '@/hooks/useTargetRole';
import { useQuery }        from '@tanstack/react-query';
import { apiFetch }        from '@/services/apiClient';
import { cn }              from '@/utils/cn';
import type { GapPriority, SkillGapItem } from '@/types/careerHealth';

// ─── Topic enrichment map ─────────────────────────────────────────────────────

const TOPIC_ENRICHMENT: Record<string, {
  description: string;
  duration: string;
  skills: string[];
  resourceHint?: string; // suggested platform/cert for CTA
}> = {
  // ── Software Engineering (existing) ────────────────────────────────────────
  'System Design':    { description: 'Scalability, databases, caching, and distributed systems.',    duration: '4–6 weeks', skills: ['Load Balancing', 'CAP Theorem', 'Database Sharding', 'Caching'], resourceHint: 'Grokking System Design' },
  'Docker':           { description: 'Containerisation, Docker Compose, and production workflows.', duration: '1–2 weeks', skills: ['Dockerfile', 'Docker Compose', 'Container Networking'], resourceHint: 'Docker Official Docs' },
  'Kubernetes':       { description: 'Orchestration, deployments, and cluster management.',         duration: '3–4 weeks', skills: ['Pods & Deployments', 'Helm Charts', 'Ingress', 'HPA'], resourceHint: 'CKAD Certification' },
  'Microservices':    { description: 'Service decomposition, APIs, and inter-service communication.', duration: '3–5 weeks', skills: ['API Gateway', 'Event Sourcing', 'gRPC', 'Circuit Breaker'], resourceHint: 'Udemy / Pluralsight' },
  'TypeScript':       { description: 'Advanced types, generics, and real-world patterns.',           duration: '2–3 weeks', skills: ['Generics', 'Utility Types', 'Decorators', 'Type Guards'], resourceHint: 'TypeScript Handbook' },
  'React':            { description: 'Hooks, state management, and performance optimisation.',      duration: '2–4 weeks', skills: ['useReducer', 'Context API', 'React Query', 'Memoisation'], resourceHint: 'React Official Docs' },
  'Node.js':          { description: 'REST APIs, streaming, event loop, and performance.',           duration: '3–4 weeks', skills: ['Event Loop', 'Streams', 'Clustering', 'Express Middleware'], resourceHint: 'nodejs.org / Udemy' },
  'Python':           { description: 'Data structures, async, and modern Python idioms.',            duration: '2–3 weeks', skills: ['AsyncIO', 'Dataclasses', 'Type Hints', 'List Comprehension'], resourceHint: 'Python.org / Codecademy' },
  'AWS':              { description: 'Core AWS services, IAM, and cloud deployment patterns.',       duration: '3–5 weeks', skills: ['EC2 & ECS', 'S3 & CloudFront', 'Lambda', 'IAM Policies'], resourceHint: 'AWS Certified Developer' },
  'PostgreSQL':       { description: 'Query optimisation, indexing, and advanced schemas.',          duration: '2–3 weeks', skills: ['EXPLAIN ANALYZE', 'B-tree Indexes', 'CTEs', 'Partitioning'], resourceHint: 'PostgreSQL Tutorial' },
  'Redis':            { description: 'Caching strategies, pub/sub, and data structures.',            duration: '1–2 weeks', skills: ['LRU Eviction', 'Pub/Sub', 'Sorted Sets', 'Pipelining'], resourceHint: 'Redis University' },
  'SQL':              { description: 'Advanced queries, indexing, joins, and performance tuning.',   duration: '2–3 weeks', skills: ['Window Functions', 'CTEs', 'Index Strategy', 'Query Plans'], resourceHint: 'Mode SQL Tutorial' },
  'Machine Learning': { description: 'Supervised learning, model evaluation, and deployment.',      duration: '6–8 weeks', skills: ['Feature Engineering', 'Cross-Validation', 'Gradient Boosting', 'MLflow'], resourceHint: 'Coursera ML Specialisation' },
  'CI/CD':            { description: 'GitHub Actions, pipelines, and deployment automation.',        duration: '1–2 weeks', skills: ['GitHub Actions', 'Docker Build', 'Test Automation', 'Secrets Mgmt'], resourceHint: 'GitHub Actions Docs' },
  'Java':             { description: 'OOP, Spring Boot, and enterprise Java patterns.',              duration: '4–6 weeks', skills: ['Spring Boot', 'JPA / Hibernate', 'Maven', 'JUnit 5'], resourceHint: 'Baeldung / Udemy' },
  'Go':               { description: 'Concurrency, goroutines, and idiomatic Go patterns.',          duration: '3–4 weeks', skills: ['Goroutines', 'Channels', 'Interfaces', 'Testing'], resourceHint: 'Tour of Go' },
  'Git':              { description: 'Branching strategies, rebasing, and collaborative workflows.',  duration: '1 week',    skills: ['Git Rebase', 'Cherry Pick', 'Bisect', 'Submodules'], resourceHint: 'Atlassian Git Tutorial' },
  'GraphQL':          { description: 'Schema design, resolvers, and performance.',                   duration: '1–2 weeks', skills: ['SDL Schema', 'Resolvers', 'DataLoader', 'Apollo Client'], resourceHint: 'GraphQL.org' },
  'Testing':          { description: 'Unit, integration, and E2E testing strategies.',              duration: '1–2 weeks', skills: ['Jest / Vitest', 'Testing Library', 'Cypress / Playwright', 'Mocking'], resourceHint: 'Testing Library Docs' },

  // ── Administration ──────────────────────────────────────────────────────────
  'Office Coordination & Documentation': {
    description: 'End-to-end office workflow management, correspondence drafting, and filing systems.',
    duration: '2–3 weeks',
    skills: ['Filing Systems', 'Meeting Minutes', 'Correspondence Drafting', 'MIS Reports'],
    resourceHint: 'Microsoft Office Specialist (MOS)',
  },
  'MS Office Suite (Word, Excel, PowerPoint)': {
    description: 'Advanced Excel for reporting, PowerPoint presentation design, and Word document automation.',
    duration: '2–3 weeks',
    skills: ['Pivot Tables', 'VLOOKUP / XLOOKUP', 'PowerPoint Design', 'Mail Merge'],
    resourceHint: 'Microsoft Office Specialist (MOS)',
  },
  'MS Office Suite': {
    description: 'Core productivity tools including Excel, Word, PowerPoint, and Outlook workflows.',
    duration: '1–2 weeks',
    skills: ['Excel Formulas', 'PowerPoint Slides', 'Word Formatting', 'Outlook Management'],
    resourceHint: 'Microsoft Office Specialist (MOS)',
  },
  'Data Entry & Database Management': {
    description: 'Accurate data entry workflows, database hygiene, and basic reporting from structured data.',
    duration: '1–2 weeks',
    skills: ['Data Validation', 'Excel Tables', 'Google Sheets', 'Basic SQL Queries'],
    resourceHint: 'Google Sheets / Excel Courses',
  },
  'Document Management': {
    description: 'Organising, versioning, and securing organisational documents across digital and physical systems.',
    duration: '1 week',
    skills: ['Version Control', 'Cloud Storage (Drive/SharePoint)', 'Naming Conventions', 'Archiving'],
    resourceHint: 'SharePoint / Google Drive Training',
  },
  'Calendar Management': {
    description: 'Executive scheduling, multi-party meeting coordination, and travel logistics management.',
    duration: '1 week',
    skills: ['Outlook Calendar', 'Google Calendar', 'Travel Coordination', 'Priority Scheduling'],
    resourceHint: 'Google Workspace Certification',
  },
  'Vendor Management': {
    description: 'Supplier onboarding, contract tracking, and performance monitoring for office procurement.',
    duration: '1–2 weeks',
    skills: ['Supplier Evaluation', 'Purchase Orders', 'Contract Basics', 'Cost Tracking'],
    resourceHint: 'CIPS Foundation Certificate',
  },

  // ── Finance & Accounting ────────────────────────────────────────────────────
  'GST Compliance': {
    description: 'GST filing, input tax credit reconciliation, and compliance reporting under Indian tax law.',
    duration: '2–3 weeks',
    skills: ['GSTR-1 / GSTR-3B Filing', 'ITC Reconciliation', 'E-way Bills', 'GST Audit'],
    resourceHint: 'ICAI GST Certification',
  },
  'Financial Reporting': {
    description: 'Preparing P&L statements, balance sheets, and MIS reports for management decision-making.',
    duration: '2–3 weeks',
    skills: ['P&L Preparation', 'Balance Sheet Analysis', 'MIS Dashboards', 'Variance Analysis'],
    resourceHint: 'ICAI CPE / CPA Exam',
  },
  'Financial Modelling': {
    description: 'Building DCF models, budget forecasts, and scenario analysis in Excel for strategic decisions.',
    duration: '3–4 weeks',
    skills: ['DCF Valuation', 'Budget Forecasting', 'Sensitivity Analysis', 'Advanced Excel'],
    resourceHint: 'CFI Financial Modelling Course',
  },
  'Tally ERP': {
    description: 'Accounting entries, GST configuration, payroll processing, and report generation in Tally.',
    duration: '1–2 weeks',
    skills: ['Ledger Entries', 'GST in Tally', 'Payroll Module', 'Balance Sheet Reports'],
    resourceHint: 'Tally Certified Professional',
  },
  'Tax Planning': {
    description: 'Direct and indirect tax strategies, ITR filing, and advance tax computation for individuals and corporates.',
    duration: '3–4 weeks',
    skills: ['ITR Filing', 'Advance Tax', 'Tax Deductions (80C/80D)', 'Corporate Tax'],
    resourceHint: 'ICAI Tax Certification',
  },

  // ── Human Resources ─────────────────────────────────────────────────────────
  'Talent Acquisition': {
    description: 'Full-cycle recruitment from job profiling to offer management and employer branding.',
    duration: '2–3 weeks',
    skills: ['Boolean Sourcing', 'JD Writing', 'ATS Tools', 'Offer Negotiation'],
    resourceHint: 'LinkedIn Recruiter Certification',
  },
  'Performance Management': {
    description: 'Goal-setting frameworks, appraisal processes, and performance improvement planning.',
    duration: '2–3 weeks',
    skills: ['OKR Framework', 'KPI Design', '360 Feedback', 'PIP Documentation'],
    resourceHint: 'SHRM-CP Certification',
  },
  'HR Analytics': {
    description: 'Using data to measure workforce metrics, attrition trends, and recruitment funnel performance.',
    duration: '2–3 weeks',
    skills: ['Excel / Power BI for HR', 'Attrition Analysis', 'Headcount Reporting', 'Survey Data'],
    resourceHint: 'SHRM People Analytics Certificate',
  },
  'Payroll Management': {
    description: 'End-to-end payroll processing including statutory compliance, TDS, and PF/ESIC filings.',
    duration: '1–2 weeks',
    skills: ['Salary Structuring', 'TDS on Salary', 'PF & ESIC', 'Payroll Software'],
    resourceHint: 'ADP / Greytip Payroll Training',
  },

  // ── Healthcare ──────────────────────────────────────────────────────────────
  'Patient Management': {
    description: 'Clinical documentation, patient communication protocols, and care coordination best practices.',
    duration: '2–3 weeks',
    skills: ['Clinical Notes', 'Patient Communication', 'Care Coordination', 'EMR Systems'],
    resourceHint: 'NABH Quality Standards Course',
  },
  'Clinical Leadership': {
    description: 'Leading ward teams, managing clinical governance, and driving quality improvement initiatives.',
    duration: '3–4 weeks',
    skills: ['Team Leadership', 'Clinical Governance', 'Quality Improvement', 'Incident Reporting'],
    resourceHint: 'Healthcare Management Certificate',
  },
  'Healthcare Compliance': {
    description: 'NABH accreditation, clinical audit processes, and patient safety framework implementation.',
    duration: '2–3 weeks',
    skills: ['NABH Standards', 'Clinical Audit', 'Patient Safety', 'SOP Documentation'],
    resourceHint: 'NABH / JCI Accreditation Training',
  },

  // ── Legal ───────────────────────────────────────────────────────────────────
  'Contract Drafting': {
    description: 'Drafting, reviewing, and negotiating commercial agreements with risk mitigation focus.',
    duration: '3–4 weeks',
    skills: ['Agreement Templates', 'Risk Clauses', 'Indemnity & Liability', 'NDAs'],
    resourceHint: 'Contract Management Certification (IACCM)',
  },
  'Regulatory Compliance': {
    description: 'Mapping regulatory obligations, building compliance frameworks, and conducting internal audits.',
    duration: '3–4 weeks',
    skills: ['Compliance Mapping', 'Internal Audit', 'Policy Drafting', 'Risk Assessment'],
    resourceHint: 'ICA Compliance Certification',
  },

  // ── Sales & Customer Success ────────────────────────────────────────────────
  'CRM Tools': {
    description: 'Using Salesforce or HubSpot to manage pipelines, track customer interactions, and generate reports.',
    duration: '1–2 weeks',
    skills: ['Salesforce Basics', 'Pipeline Management', 'Activity Logging', 'Reports & Dashboards'],
    resourceHint: 'Salesforce Associate Certification',
  },
  'Customer Communication': {
    description: 'Professional written and verbal communication techniques for client-facing roles.',
    duration: '1–2 weeks',
    skills: ['Email Etiquette', 'Active Listening', 'Conflict Resolution', 'Escalation Handling'],
    resourceHint: 'Coursera Business Communication',
  },

  // ── Marketing ──────────────────────────────────────────────────────────────
  'Digital Marketing': {
    description: 'SEO, paid campaigns, social media strategy, and analytics for online marketing.',
    duration: '3–4 weeks',
    skills: ['Google Ads', 'SEO Fundamentals', 'Social Media Ads', 'GA4 Analytics'],
    resourceHint: 'Google Digital Marketing Certificate',
  },
  'Content Marketing': {
    description: 'Building content strategies, writing for web, and measuring content performance.',
    duration: '2–3 weeks',
    skills: ['Content Strategy', 'SEO Writing', 'Editorial Calendar', 'Content Analytics'],
    resourceHint: 'HubSpot Content Marketing Certification',
  },

  // ── Supply Chain ────────────────────────────────────────────────────────────
  'Inventory Management': {
    description: 'Stock control systems, demand forecasting, and warehouse operations optimisation.',
    duration: '2–3 weeks',
    skills: ['Stock Control', 'Demand Forecasting', 'ABC Analysis', 'ERP Inventory Module'],
    resourceHint: 'APICS CSCP Certification',
  },
  'Procurement': {
    description: 'Strategic sourcing, supplier evaluation, tender processes, and contract management.',
    duration: '2–3 weeks',
    skills: ['RFQ / RFP Process', 'Supplier Evaluation', 'Cost Negotiation', 'Purchase Orders'],
    resourceHint: 'CIPS Level 3 Certificate',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface LearningTopic {
  title:        string;
  description:  string;
  duration:     string;
  priority:     GapPriority;
  category:     string;
  gapScore:     number;
  skills:       string[];
  resourceHint: string | null;  // suggested cert/platform for CTA
}

// ─── Gap-analysis hook (Phase 4 enhancement — preserved) ─────────────────────

interface GapAnalysisResult {
  targetRoleId: string;
  gaps: Array<{
    skill:        { name: string; category?: string; demandScore?: number };
    userLevel:    number;
    marketLevel:  number;
    gap:          number;
    priority:     GapPriority;
  }>;
}

function useSkillGapAnalysis(targetRoleId: string | null, userSkills: string[]) {
  return useQuery<GapAnalysisResult | null>({
    queryKey: ['skill-gap-analysis', targetRoleId, userSkills.join(',')],
    queryFn: async () => {
      if (!targetRoleId || userSkills.length === 0) return null;
      try {
        const result = await apiFetch<unknown>('/skills/gap-analysis', {
          method: 'POST',
          body:   JSON.stringify({ targetRoleId, userSkills: userSkills.map(name => ({ name })) }),
        });
        return result as GapAnalysisResult ?? null;
      } catch { return null; }
    },
    enabled:   !!targetRoleId && userSkills.length > 0,
    staleTime: 15 * 60 * 1000,
    retry:     false,
  });
}

// ─── Topic derivation ─────────────────────────────────────────────────────────

function gapItemsToTopics(
  gaps: Array<{ skillName: string; priority: GapPriority; category: string; gap: number }>,
  limit = 6,
): LearningTopic[] {
  return gaps
    .sort((a, b) => {
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return pOrder[a.priority] - pOrder[b.priority];
    })
    .slice(0, limit)
    .map(gap => {
      const enriched = TOPIC_ENRICHMENT[gap.skillName];
      return {
        title:        gap.skillName,
        description:  enriched?.description ?? `Strengthen your ${gap.skillName} skills to improve your marketability and career score.`,
        duration:     enriched?.duration ?? (gap.gap > 30 ? '4–6 weeks' : gap.gap > 15 ? '2–3 weeks' : '1–2 weeks'),
        priority:     gap.priority,
        category:     gap.category,
        gapScore:     gap.gap,
        skills:       enriched?.skills ?? [gap.skillName, 'Core Concepts', 'Applied Practice'],
        resourceHint: enriched?.resourceHint ?? null,
      };
    });
}

function apiGapsToTopics(result: GapAnalysisResult, limit = 6): LearningTopic[] {
  return gapItemsToTopics(
    result.gaps.map(g => ({
      skillName: g.skill.name,
      priority:  g.priority,
      category:  g.skill.category ?? 'technical',
      gap:       g.gap,
    })),
    limit,
  );
}

// ─── Priority styles ──────────────────────────────────────────────────────────

const priorityStyles: Record<GapPriority, { badge: string; accent: string }> = {
  critical: { badge: 'bg-red-500/12 text-red-400',    accent: 'bg-red-500' },
  high:     { badge: 'bg-amber-500/12 text-amber-400', accent: 'bg-amber-400' },
  medium:   { badge: 'bg-blue-500/12 text-blue-400',  accent: 'bg-blue-400' },
  low:      { badge: 'bg-white/8 text-white/40',       accent: 'bg-white/25' },
};

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: LearningTopic }) {
  const styles = priorityStyles[topic.priority];
  return (
    <div className="card-v3 p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-white/85 leading-snug">{topic.title}</p>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide', styles.badge)}>
          {topic.priority}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-white/45 leading-relaxed">{topic.description}</p>

      {/* Skills to learn */}
      <div>
        <p className="label-v3 mb-1.5">Skills to learn</p>
        <div className="flex flex-wrap gap-1.5">
          {topic.skills.slice(0, 4).map(s => (
            <span key={s} className="skill-pill">{s}</span>
          ))}
        </div>
      </div>

      {/* Footer — duration + resource CTA */}
      <div className="flex items-center justify-between mt-auto pt-1 flex-wrap gap-2">
        <span className="text-[10px] text-white/32 uppercase tracking-wider">{topic.category}</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-hr-400">~{topic.duration}</span>
          {topic.resourceHint && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full cursor-default"
              style={{ background: 'rgba(61,101,246,0.12)', color: 'rgba(147,167,255,0.85)' }}
              title={`Recommended: ${topic.resourceHint}`}
            >
              {topic.resourceHint}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Empty / loading states ───────────────────────────────────────────────────

function LearningEmpty() {
  return (
    <div className="card-v3 p-8 flex flex-col items-center gap-3 text-center">
      <svg className="h-8 w-8 text-white/18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <p className="text-sm text-white/45">Upload your resume to get personalised learning recommendations.</p>
    </div>
  );
}

function LearningSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card-v3 p-4 space-y-3">
          <div className="h-3 w-32 rounded bg-white/8" />
          <div className="h-3 w-full rounded bg-white/8" />
          <div className="flex gap-1.5">
            <div className="h-5 w-14 rounded bg-white/8" />
            <div className="h-5 w-16 rounded bg-white/8" />
            <div className="h-5 w-12 rounded bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LearningRecommendations() {
  const { data: chi,     isLoading: chiLoading  } = useCareerHealth();
  const { data: profile, isLoading: profLoading } = useProfile();
  const { hasResume }                              = useHasResume();

  // FIX: use CV-derived role — never stale onboarding value
  const { targetRoleId } = useTargetRole();
  const resumeSkills = (chi?.skillGaps ?? []).map(g => g.skillName);

  const { data: gapAnalysis } = useSkillGapAnalysis(targetRoleId, resumeSkills);

  if (chiLoading || profLoading) return <LearningSkeleton />;

  if (!chi?.isReady && !chi?.skillGaps?.length) {
    if (hasResume) {
      return (
        <div className="card-v3 p-8 flex flex-col items-center gap-3 text-center">
          <svg className="h-8 w-8 text-hr-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-white/45">Generating your personalised learning recommendations…</p>
        </div>
      );
    }
    return <LearningEmpty />;
  }

  let topics: LearningTopic[] = [];
  if (gapAnalysis?.gaps?.length) {
    topics = apiGapsToTopics(gapAnalysis, 6);
  } else if (chi?.skillGaps?.length) {
    topics = gapItemsToTopics(chi.skillGaps, 6);
  }

  if (topics.length === 0) return <LearningEmpty />;

  const isApiPowered = !!gapAnalysis?.gaps?.length;

  return (
    <div className="space-y-3">
      {isApiPowered && (
        <p className="text-[11px] text-white/35">
          Personalised for <span className="font-semibold text-hr-400">{targetRoleId}</span> · Based on role skill requirements
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic, i) => <TopicCard key={i} topic={topic} />)}
      </div>
    </div>
  );
}