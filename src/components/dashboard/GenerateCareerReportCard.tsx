/**
 * components/dashboard/GenerateCareerReportCard.tsx
 *
 * WP-PRO-03 — Post-Onboarding Experience & AI Feature Entry
 *
 * Dashboard entry point for AI career-report generation. Previously this
 * call lived inline in onboarding completion (pages/onboarding/WelcomePage.tsx),
 * blocking the user's first post-onboarding screen on an AI call. It has been
 * moved here — a place where a failure is just a retryable widget, not a
 * broken "you're all set" moment.
 *
 * Reuses the existing canonical mutation — no new AI logic, no new
 * career-report endpoint, no duplicated retry/error-category handling.
 * Same hook CompletionScreen (WP-PRO-09F) already uses.
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useGenerateCareerReport } from '@/features/onboarding/mutations/useGenerateCareerReport';
import { isApiClientError } from '@/lib/api/core';

function reportErrorCopy(error: unknown): string {
  if (isApiClientError(error)) {
    if (error.isTierGate) {
      return 'Not available on your current plan, or you\u2019ve reached today\u2019s limit.';
    }
    if (error.isRateLimit) {
      return error.retryAfter
        ? `Too many requests — try again in about ${error.retryAfter}s.`
        : 'Too many requests — please wait a moment and try again.';
    }
    if (error.isNetworkError) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    if (error.isServerError) {
      return 'Something went wrong on our end. Please try again in a moment.';
    }
  }
  return 'We couldn\u2019t generate your report. Please try again.';
}

export function GenerateCareerReportCard() {
  const navigate = useNavigate();
  const reportMutation = useGenerateCareerReport();

  const handleGenerate = () => {
    reportMutation.mutate(undefined, {
      onSuccess: (result) => {
        // Same handoff contract ReportPage already expects.
        sessionStorage.setItem('careerReport', JSON.stringify(result));
        navigate('/report');
      },
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">AI Career Report</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Get a personalised assessment of your skills, gaps, and next steps.
      </p>

      {reportMutation.isError && (
        <div role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {reportErrorCopy(reportMutation.error)}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={handleGenerate}
        isLoading={reportMutation.isPending}
      >
        {reportMutation.isError ? 'Try again' : 'Generate career report'}
      </Button>
    </div>
  );
}
