'use client';

// components/career/CareerPathCard.tsx — PHASE 3 UPDATE
//
// CHANGE: Career Path steps now come from GET /api/v1/growth/projected
// when a targetRoleId is available on the user profile.
//
// Previously: all steps were derived client-side from skill gap names only.
// Now: backend growth.service.js projection (milestones, levelPath,
// skillCoverage, yearsToNextLevel) drives the steps when available.
//
// FALLBACK: If targetRoleId is not set or growth API fails, the component
// falls back to the original client-side step derivation.

import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useProfile }      from '@/hooks/useProfile';
import { useTargetRole }   from '@/hooks/useTargetRole';
import { useQuery }        from '@tanstack/react-query';
import { apiFetch }        from '@/services/apiClient';
import { cn }              from '@/utils/cn';

// ─── Growth API types ─────────────────────────────────────────────────────────

interface GrowthMilestone {
  title:       string;
  description: string;
  year:        number;
  priority?:   'urgent' | 'important' | 'recommended';
}

interface GrowthProjection {
  targetRoleId:      string;
  milestones?:       GrowthMilestone[];
  levelPath?:        Array<{ level: string; yearsToReach: number; estimatedSalaryLPA?: number }>;
  skillCoverage?:    number;
  currentLevel?:     string;
  nextLevel?:        string;
  yearsToNextLevel?: number;
}

interface CareerStep {
  number:      number;
  title:       string;
  description: string;
  priority:    'urgent' | 'important' | 'recommended';
}

// ─── Growth API hook ──────────────────────────────────────────────────────────

function useGrowthProjection(targetRoleId: string | null | undefined) {
  return useQuery<GrowthProjection | null>({
    queryKey: ['growth-projection', targetRoleId],
    queryFn: async () => {
      if (!targetRoleId) return null;
      try {
        const result = await apiFetch<unknown>(
          `/growth/projected?targetRoleId=${encodeURIComponent(targetRoleId)}&years=3`
        );
        return result as GrowthProjection ?? null;
      } catch {
        return null;
      }
    },
    enabled:   !!targetRoleId,
    staleTime: 10 * 60 * 1000,
    retry:     false,
  });
}

// ─── Step derivation from growth API ─────────────────────────────────────────

function stepsFromGrowthData(growth: GrowthProjection, targetRole: string): CareerStep[] {
  const steps: CareerStep[] = [];
  let n = 1;

  if (growth.milestones?.length) {
    growth.milestones.slice(0, 4).forEach((m) => {
      steps.push({
        number:      n++,
        title:       m.title,
        description: m.description,
        priority:    m.priority ?? (m.year <= 1 ? 'urgent' : m.year <= 2 ? 'important' : 'recommended'),
      });
    });
  }

  if (growth.nextLevel && growth.yearsToNextLevel != null) {
    steps.push({
      number:      n++,
      title:       `Reach ${growth.nextLevel}`,
      description: `At your current pace, you can reach ${growth.nextLevel} in ~${growth.yearsToNextLevel} year${growth.yearsToNextLevel !== 1 ? 's' : ''}. Focus on the milestones above.`,
      priority:    'recommended',
    });
  }

  if (growth.skillCoverage != null && growth.skillCoverage < 70) {
    steps.push({
      number:      n++,
      title:       `Improve skill coverage (${Math.round(growth.skillCoverage)}%)`,
      description: `Your skill coverage for ${targetRole} is ${Math.round(growth.skillCoverage)}%. Aim for 80%+ before applying.`,
      priority:    growth.skillCoverage < 50 ? 'urgent' : 'important',
    });
  }

  return steps.slice(0, 5);
}

// ─── Fallback: client-side derivation ────────────────────────────────────────

function deriveCareerSteps(params: {
  hasResume:   boolean;
  hasProfile:  boolean;
  targetRole?: string | null;
  topGaps:     Array<{ skillName: string; priority: string }>;
  chiScore:    number | null;
}): CareerStep[] {
  const steps: CareerStep[] = [];
  let n = 1;

  if (!params.hasProfile) steps.push({ number: n++, title: 'Complete your profile', description: 'Add your target role, experience level, and location to unlock personalised guidance.', priority: 'urgent' });
  if (!params.hasResume)  steps.push({ number: n++, title: 'Upload your resume', description: 'AI-powered analysis extracts your skills and calculates your Career Health Index.', priority: 'urgent' });

  params.topGaps.filter(g => g.priority === 'critical').slice(0, 2).forEach(gap =>
    steps.push({ number: n++, title: `Learn ${gap.skillName}`, description: `Critical gap for your target role. Close this to significantly boost your CHI score.`, priority: 'urgent' })
  );
  params.topGaps.filter(g => g.priority === 'high').slice(0, 2).forEach(gap =>
    steps.push({ number: n++, title: `Build proficiency in ${gap.skillName}`, description: `High-priority skill increasingly in demand. Improves marketability significantly.`, priority: 'important' })
  );

  if (steps.length < 3) {
    if (params.targetRole) steps.push({ number: n++, title: 'Build portfolio projects', description: `Demonstrate ${params.targetRole} skills with 2–3 real-world projects on GitHub.`, priority: 'important' });
    steps.push({ number: n++, title: 'Apply for target roles', description: 'Start applying once your CHI score reaches 70+. Use HireRise insights to tailor applications.', priority: 'recommended' });
  }

  return steps.slice(0, 5);
}

// ─── UI ───────────────────────────────────────────────────────────────────────

const priorityCfg = {
  urgent:      { ring: 'border-red-400 bg-red-500 text-white',     line: 'bg-red-100',    badge: 'bg-red-50 text-red-500'    },
  important:   { ring: 'border-amber-400 bg-amber-500 text-white', line: 'bg-amber-100',  badge: 'bg-amber-50 text-amber-600' },
  recommended: { ring: 'border-hr-300 bg-hr-500 text-white',       line: 'bg-hr-100',     badge: 'bg-hr-50 text-hr-600'      },
};

function StepItem({ step, isLast }: { step: CareerStep; isLast: boolean }) {
  const cfg = priorityCfg[step.priority];
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black', cfg.ring)}>{step.number}</div>
        {!isLast && <div className={cn('mt-1 h-full w-0.5 rounded-full min-h-[24px]', cfg.line)} />}
      </div>
      <div className={cn('pb-5 flex-1 min-w-0', isLast && 'pb-0')}>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white/88">{step.title}</p>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', cfg.badge)}>{step.priority}</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{step.description}</p>
      </div>
    </div>
  );
}

function PathSkeleton() {
  return (
    <div className="card-v3 p-5 animate-pulse space-y-4">
      <div className="h-3 w-28 rounded bg-white/8" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-7 w-7 rounded-full bg-white/8 shrink-0" />
          <div className="flex-1 space-y-1.5 pt-1">
            <div className="h-3 w-40 rounded bg-white/8" />
            <div className="h-3 w-56 rounded bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CareerPathCard({ className }: { className?: string }) {
  const { data: chi,     isLoading: chiLoading  } = useCareerHealth();
  const { data: profile, isLoading: profLoading } = useProfile();

  // FIX: always use CV-derived role — never stale onboarding value
  const { targetRoleId, isCvDerived } = useTargetRole();
  const user = profile?.user as any;

  const { data: growth, isLoading: growthLoading } = useGrowthProjection(targetRoleId);

  if (chiLoading || profLoading) return <PathSkeleton />;

  const hasGrowthData = growth && !growthLoading && targetRoleId;
  const apiSteps      = hasGrowthData ? stepsFromGrowthData(growth!, targetRoleId) : [];
  const steps         = apiSteps.length > 0
    ? apiSteps
    : deriveCareerSteps({
        hasResume:  !!user?.resumeUploaded,
        hasProfile: !!user?.onboardingCompleted,
        targetRole: targetRoleId,
        topGaps:    chi?.skillGaps?.slice(0, 4) ?? [],
        chiScore:   chi?.chiScore ?? null,
      });

  return (
    <div className={cn('card-v3 overflow-hidden', className)}>
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/35">Career Path Guidance</h3>
          {targetRoleId && (
            <p className="mt-0.5 text-[11px] text-white/35">
              Towards: {targetRoleId}
              {isCvDerived && <span className="ml-1.5 text-hr-500">· CV-matched</span>}
              {!isCvDerived && hasGrowthData && apiSteps.length > 0 && <span className="ml-1.5 text-hr-500">· AI-powered</span>}
            </p>
          )}
        </div>
        <svg className="h-4 w-4 text-hr-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <div className="p-5">
        {steps.map((step, i) => (
          <StepItem key={step.number} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}