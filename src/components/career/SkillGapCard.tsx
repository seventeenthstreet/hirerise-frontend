'use client';

// components/career/SkillGapCard.tsx — v3 reskin
// Changes: removed all internal border-t dividers, shadow-first card,
//          hover skill-reveal on each row, tooltips on priority badges

import { useState } from 'react';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { cn } from '@/utils/cn';
import type { GapPriority, SkillGapItem } from '@/types/careerHealth';

// ─── Priority config (dark-safe colours, no light-mode bg classes) ────────────

// ─── Sub-skill lookup — derived from TOPIC_ENRICHMENT in LearningRecommendations
// Mirrors the same enrichment map so "see missing skills" shows real sub-skills,
// not the same 3 generic hints for every user with a "high" priority gap.

const SUB_SKILL_MAP: Record<string, string[]> = {
  'Office Coordination & Documentation': ['Filing Systems', 'Meeting Minutes', 'Correspondence Drafting', 'MIS Reports'],
  'MS Office Suite (Word, Excel, PowerPoint)': ['Pivot Tables', 'VLOOKUP / XLOOKUP', 'PowerPoint Design', 'Mail Merge'],
  'MS Office Suite': ['Excel Formulas', 'PowerPoint Slides', 'Word Formatting', 'Outlook Management'],
  'Data Entry & Database Management': ['Data Validation', 'Excel Tables', 'Google Sheets', 'Basic SQL Queries'],
  'Document Management': ['Version Control', 'Cloud Storage (Drive/SharePoint)', 'Naming Conventions', 'Archiving'],
  'Calendar Management': ['Outlook Calendar', 'Google Calendar', 'Travel Coordination', 'Priority Scheduling'],
  'Vendor Management': ['Supplier Evaluation', 'Purchase Orders', 'Contract Basics', 'Cost Tracking'],
  'GST Compliance': ['GSTR-1 / GSTR-3B Filing', 'ITC Reconciliation', 'E-way Bills', 'GST Audit'],
  'Financial Reporting': ['P&L Preparation', 'Balance Sheet Analysis', 'MIS Dashboards', 'Variance Analysis'],
  'Financial Modelling': ['DCF Valuation', 'Budget Forecasting', 'Sensitivity Analysis', 'Advanced Excel'],
  'Tally ERP': ['Ledger Entries', 'GST in Tally', 'Payroll Module', 'Balance Sheet Reports'],
  'Tax Planning': ['ITR Filing', 'Advance Tax', 'Tax Deductions (80C/80D)', 'Corporate Tax'],
  'Talent Acquisition': ['Boolean Sourcing', 'JD Writing', 'ATS Tools', 'Offer Negotiation'],
  'Performance Management': ['OKR Framework', 'KPI Design', '360 Feedback', 'PIP Documentation'],
  'HR Analytics': ['Excel / Power BI for HR', 'Attrition Analysis', 'Headcount Reporting', 'Survey Data'],
  'Payroll Management': ['Salary Structuring', 'TDS on Salary', 'PF & ESIC', 'Payroll Software'],
  'Patient Management': ['Clinical Notes', 'Patient Communication', 'Care Coordination', 'EMR Systems'],
  'Clinical Leadership': ['Team Leadership', 'Clinical Governance', 'Quality Improvement', 'Incident Reporting'],
  'Contract Drafting': ['Agreement Templates', 'Risk Clauses', 'Indemnity & Liability', 'NDAs'],
  'Regulatory Compliance': ['Compliance Mapping', 'Internal Audit', 'Policy Drafting', 'Risk Assessment'],
  'CRM Tools': ['Salesforce Basics', 'Pipeline Management', 'Activity Logging', 'Reports & Dashboards'],
  'Digital Marketing': ['Google Ads', 'SEO Fundamentals', 'Social Media Ads', 'GA4 Analytics'],
  'Inventory Management': ['Stock Control', 'Demand Forecasting', 'ABC Analysis', 'ERP Inventory Module'],
  'SQL': ['Window Functions', 'CTEs', 'Index Strategy', 'Query Plans'],
  'Python': ['AsyncIO', 'Dataclasses', 'Type Hints', 'List Comprehension'],
  'System Design': ['Load Balancing', 'CAP Theorem', 'Database Sharding', 'Caching'],
  'AWS': ['EC2 & ECS', 'S3 & CloudFront', 'Lambda', 'IAM Policies'],
  'Machine Learning': ['Feature Engineering', 'Cross-Validation', 'Gradient Boosting', 'MLflow'],
};

// Derive missing sub-skills for a gap by name, falling back to priority-tier hints
// only when no specific mapping exists — much better than always showing the same 3.
function getMissingSkills(skillName: string, priority: GapPriority): string[] {
  if (SUB_SKILL_MAP[skillName]) return SUB_SKILL_MAP[skillName];
  // Generic fallback by priority — last resort only
  const fallbacks: Record<GapPriority, string[]> = {
    critical: ['Core Concepts', 'Applied Practice', 'Industry Standards'],
    high:     ['Advanced Techniques', 'Real-world Application', 'Best Practices'],
    medium:   ['Foundational Skills', 'Practical Tools', 'Process Knowledge'],
    low:      ['Awareness', 'Basic Proficiency'],
  };
  return fallbacks[priority];
}

const priorityConfig: Record<GapPriority, {
  badge: string;
  bar:   string;
  dot:   string;
  label: string;
}> = {
  critical: { badge: 'bg-red-500/12 text-red-400',    bar: 'bg-red-400',    dot: 'bg-red-400',    label: 'Critical' },
  high:     { badge: 'bg-amber-500/12 text-amber-400', bar: 'bg-amber-400',  dot: 'bg-amber-400',  label: 'High'     },
  medium:   { badge: 'bg-blue-500/12 text-blue-400',   bar: 'bg-blue-400',   dot: 'bg-blue-400',   label: 'Medium'   },
  low:      { badge: 'bg-white/8 text-white/40',       bar: 'bg-white/30',   dot: 'bg-white/30',   label: 'Low'      },
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function InfoTip({ content }: { content: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-white/6 text-[9px] text-white/30 hover:text-white/55 transition-colors select-none">?</span>
      {show && <span className="tooltip-v3 w-52">{content}</span>}
    </span>
  );
}

// ─── Skill reveal ─────────────────────────────────────────────────────────────

function SkillReveal({ skills }: { skills: string[] }) {
  const [open, setOpen] = useState(false);
  if (skills.length === 0) return null;
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="text-[10px] font-semibold text-hr-400/80 hover:text-hr-400 transition-colors underline decoration-dotted underline-offset-2"
      >
        {open ? 'hide' : 'see missing skills'}
      </button>
      {open && (
        <span
          className="absolute bottom-full left-0 mb-2 z-40 rounded-xl p-3 animate-fade-in"
          style={{ background: '#1c2540', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', minWidth: '11rem' }}
        >
          <p className="label-v3 mb-2">Missing skills</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map(s => <span key={s} className="skill-pill">{s}</span>)}
          </div>
        </span>
      )}
    </span>
  );
}

// ─── Gap row ──────────────────────────────────────────────────────────────────

function GapRow({ gap, index }: { gap: SkillGapItem; index: number }) {
  const cfg    = priorityConfig[gap.priority];
  const barPct = Math.min(100, Math.max(0, gap.gap));
  // FIX: derive sub-skills from gap name specifically, not generic priority tier
  const missingSkills = getMissingSkills(gap.skillName, gap.priority);

  return (
    // spacing-based separation — no border-t
    <div className={cn('group px-5 py-3.5 hover:bg-white/[0.025] transition-colors', index !== 0 && 'mt-px')}>
      <div className="flex items-center gap-3 mb-2">
        {/* Rank */}
        <span className="shrink-0 text-[11px] font-bold text-white/22 w-4 text-right tabular-nums">{index + 1}</span>

        {/* Name + badge */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-white/85 truncate">{gap.skillName}</p>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide', cfg.badge)}>
            {cfg.label}
          </span>
          <InfoTip content={`${gap.skillName} is a ${cfg.label.toLowerCase()}-priority gap. You are ${gap.gap} points behind the market average for this skill.`} />
        </div>

        {/* Score */}
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-white/82 tabular-nums">+{gap.gap}</p>
          <p className="text-[9px] text-white/28">pts behind</p>
        </div>
      </div>

      {/* Borderless progress bar */}
      <div className="pl-7">
        <div className="progress-track mb-1.5">
          <div className={cn('h-full rounded-full transition-all duration-700', cfg.bar)} style={{ width: `${barPct}%` }} />
        </div>
        <SkillReveal skills={missingSkills} />
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkillGapSkeleton() {
  return (
    <div className="card-v3 overflow-hidden animate-pulse">
      <div className="px-5 py-4">
        <div className="h-3 w-28 rounded bg-white/8" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-3 w-3 rounded bg-white/8" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-white/8" />
            <div className="h-1.5 w-full rounded-full bg-white/8" />
          </div>
          <div className="h-4 w-8 rounded bg-white/8" />
        </div>
      ))}
    </div>
  );
}

// ─── Lock / empty state ───────────────────────────────────────────────────────

function LockedState({ message }: { message: string }) {
  return (
    <div className="card-v3 overflow-hidden">
      <div className="px-5 py-4">
        <h3 className="label-v3">Top Skill Gaps</h3>
      </div>
      <div className="flex flex-col items-center justify-center py-10 px-5 text-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
          <svg className="h-5 w-5 text-white/22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm text-white/45">{message}</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SkillGapCardProps {
  limit?: number;
  className?: string;
}

export function SkillGapCard({ limit = 6, className }: SkillGapCardProps) {
  const { data: chi, isLoading, isError } = useCareerHealth();

  if (isLoading) return <SkillGapSkeleton />;
  if (isError) return (
    <div className={cn('card-v3 p-5 text-center', className)}>
      <p className="text-sm text-red-400">Failed to load skill gaps.</p>
    </div>
  );
  if (!chi?.isReady) {
    return <LockedState message={!chi
      ? 'Upload your resume to unlock skill gap analysis.'
      : 'Your skill gap analysis is being calculated…'} />;
  }
  if (!chi.skillGaps?.length) return <LockedState message="Analysing your skill gaps — check back shortly." />;

  const gaps = chi.skillGaps.slice(0, limit);
  const criticalCount = gaps.filter(g => g.priority === 'critical').length;
  const highCount     = gaps.filter(g => g.priority === 'high').length;

  return (
    <div className={cn('card-v3 overflow-hidden', className)}>
      {/* Header — no bottom border, padding separation only */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="label-v3">Top Skill Gaps</h3>
          <p className="mt-0.5 text-[11px] text-white/32">
            {criticalCount > 0 && <span className="text-red-400 font-semibold">{criticalCount} critical</span>}
            {criticalCount > 0 && highCount > 0 && <span className="text-white/20"> · </span>}
            {highCount > 0 && <span className="text-amber-400 font-semibold">{highCount} high</span>}
            {criticalCount === 0 && highCount === 0 && <span>No critical gaps</span>}
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-bold text-white/35">
          {chi.skillGaps.length} total
        </span>
      </div>

      {/* Gap list */}
      <div className="pb-2">
        {gaps.map((gap, i) => <GapRow key={gap.skillName} gap={gap} index={i} />)}
      </div>
    </div>
  );
}