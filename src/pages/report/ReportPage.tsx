

/**
 * app/(auth)/(app)/report/page.tsx — Career Report Page
 *
 * TASK 2: Reads the career report from sessionStorage (set by the onboarding
 * flow), parses it, and renders it cleanly using existing UI components.
 *
 * Flow:
 *  1. Hydrate from sessionStorage on mount
 *  2. Show PageLoading while hydrating
 *  3. Show error card + redirect CTA if no report found
 *  4. Render report sections using Card primitives
 *  5. Render placeholder upgrade CTA at the bottom
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/ui/PageShell';
import { PageLoading } from '@/components/ui/PageLoading';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { billingApi } from '@/lib/api/endpoints/billing';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CareerReport {
  overallAssessment?: string;
  educationGaps?: string[];
  experienceGaps?: string[];
  skillRecommendations?: string[];
  careerOpportunities?: string[];
  nextSteps?: string[];
  marketInsight?: string;
}

interface ReportPayload {
  userId?: string;
  step?: string;
  careerReport?: CareerReport;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground">{children}</h2>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-3">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
            aria-hidden="true"
          />
          <span className="text-sm text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function BorderedList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-border">
      {items.map((item, idx) => (
        <li key={idx} className="py-3 text-sm text-foreground first:pt-0 last:pb-0">
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<CareerReport | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('careerReport');
      if (raw) {
        const parsed: ReportPayload = JSON.parse(raw);
        setReport(parsed?.careerReport ?? null);
      }
    } catch {
      // Malformed JSON — treat as missing
    } finally {
      setHydrated(true);
    }
  }, []);

  // ── Loading state ───────────────────────────────────────────────────────────
  if (!hydrated) {
    return <PageLoading label="Loading your report…" />;
  }

  // ── Missing report state ────────────────────────────────────────────────────
  if (!report) {
    return (
      <PageShell>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <h1 className="text-base font-semibold text-foreground">No report found</h1>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              We couldn&apos;t find a career report for this session. Please complete
              the onboarding flow to generate your report.
            </p>
            <Button
              variant="primary"
              onClick={() => navigate('/onboarding', { replace: true })}
            >
              Return to onboarding
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Normalise arrays ────────────────────────────────────────────────────────
  const opportunities = toArray(report.careerOpportunities);
  const skills = toArray(report.skillRecommendations);
  const educationGaps = toArray(report.educationGaps);
  const experienceGaps = toArray(report.experienceGaps);
  const nextSteps = toArray(report.nextSteps);

  // ── Report render ───────────────────────────────────────────────────────────
  return (
    <PageShell>
      {/* Page title */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Your Career Report
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI-generated analysis based on your profile and goals.
        </p>
      </header>

      <div className="space-y-6">

        {/* Overall Assessment */}
        {report.overallAssessment && (
          <Card>
            <CardHeader>
              <SectionHeading>Overall Assessment</SectionHeading>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{report.overallAssessment}</p>
            </CardContent>
          </Card>
        )}

        {/* Career Opportunities */}
        {opportunities.length > 0 && (
          <Card>
            <CardHeader>
              <SectionHeading>Career Opportunities</SectionHeading>
            </CardHeader>
            <CardContent>
              <BorderedList items={opportunities} />
            </CardContent>
          </Card>
        )}

        {/* Skill Recommendations */}
        {skills.length > 0 && (
          <Card>
            <CardHeader>
              <SectionHeading>Skill Recommendations</SectionHeading>
            </CardHeader>
            <CardContent>
              <BulletList items={skills} />
            </CardContent>
          </Card>
        )}

        {/* Education Gaps */}
        {educationGaps.length > 0 && (
          <Card>
            <CardHeader>
              <SectionHeading>Education Gaps</SectionHeading>
            </CardHeader>
            <CardContent>
              <BulletList items={educationGaps} />
            </CardContent>
          </Card>
        )}

        {/* Experience Gaps */}
        {experienceGaps.length > 0 && (
          <Card>
            <CardHeader>
              <SectionHeading>Experience Gaps</SectionHeading>
            </CardHeader>
            <CardContent>
              <BulletList items={experienceGaps} />
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        {nextSteps.length > 0 && (
          <Card>
            <CardHeader>
              <SectionHeading>Next Steps</SectionHeading>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {nextSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Market Insight */}
        {report.marketInsight && (
          <Card>
            <CardHeader>
              <SectionHeading>Market Insight</SectionHeading>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{report.marketInsight}</p>
            </CardContent>
          </Card>
        )}

        {/* Upgrade CTA — TASK 3: wired to Stripe Checkout */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold text-foreground">
                  Want a deeper analysis?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upgrade for your full career intelligence report.
                </p>
                {upgradeError && (
                  <p className="mt-2 text-sm text-destructive">{upgradeError}</p>
                )}
              </div>
              <Button
                variant="primary"
                size="md"
                className="shrink-0"
                isLoading={upgradeLoading}
                disabled={upgradeLoading}
                onClick={async () => {
                  setUpgradeError(null);
                  setUpgradeLoading(true);
                  try {
                    const data = await billingApi.createCheckoutSession();
                    window.location.href = data.url;
                  } catch {
                    setUpgradeError('Something went wrong. Please try again.');
                    setUpgradeLoading(false);
                  }
                }}
              >
                Upgrade now
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </PageShell>
  );
}