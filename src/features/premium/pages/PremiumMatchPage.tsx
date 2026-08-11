/**
 * @file src/features/premium/pages/PremiumMatchPage.tsx
 * @description Page component for the WP-13B Premium Match feature.
 *
 * Responsibilities:
 * - Accept resumeId from route params
 * - Trigger or display premium match analysis
 * - Render all 5 premium sub-components
 *
 * Architecture position: Pages layer (fourth tier)
 *   API → Hooks → Components → Pages
 */

import React, { useEffect } from 'react';
import { usePremiumMatch }        from '../hooks/usePremiumMatch';
import { MatchScoreCard }         from '../components/MatchScoreCard';
import { BreakdownChart }         from '../components/BreakdownChart';
import { SkillGapList }           from '../components/SkillGapList';
import { ExplainabilityPanel }    from '../components/ExplainabilityPanel';
import { PremiumInsightPanel }    from '../components/PremiumInsightPanel';
import type { MatchResult }       from '../types';
import type { ApiClientError }    from '@/lib/api/core';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumMatchPageProps {
  /** The resumeId to analyse. Typically from route params. */
  resumeId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="premium-page__loading" role="status" aria-live="polite">
      <div className="premium-page__spinner" aria-hidden="true" />
      <p>Running premium analysis…</p>
    </div>
  );
}

function ErrorState({ error }: { error: ApiClientError | null }) {
  const status  = (error as ApiClientError & { status?: number })?.status;
  const message = error?.message ?? 'An unexpected error occurred.';

  if (status === 402) {
    return (
      <div className="premium-page__error premium-page__error--payment" role="alert">
        <h2>Insufficient Credits</h2>
        <p>You don't have enough credits to run a premium match. Please top up your account.</p>
      </div>
    );
  }

  return (
    <div className="premium-page__error" role="alert">
      <h2>Analysis Failed</h2>
      <p>{message}</p>
    </div>
  );
}

function ResultView({ result }: { result: MatchResult }) {
  return (
    <div className="premium-page__result">
      <MatchScoreCard
        matchScore={result.matchScore}
        tier={result.tier}
        cacheHit={result.cacheHit}
        scoredAt={result.scoredAt}
      />
      <BreakdownChart breakdown={result.breakdown} />
      <SkillGapList skillGap={result.skillGap} />
      <ExplainabilityPanel explanation={result.explanation} />
      <PremiumInsightPanel insights={result.insights} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function PremiumMatchPage({ resumeId }: PremiumMatchPageProps) {
  const {
    triggerMatch,
    isRunning,
    triggerError,
    matchResult,
    latestMatch,
    isLoadingLatest,
    latestError,
    fetchLatest,
  } = usePremiumMatch();

  // On mount: load latest result, then decide whether to auto-trigger
  useEffect(() => {
    if (resumeId) {
      fetchLatest(resumeId);
    }
  }, [resumeId, fetchLatest]);

  // While loading latest from cache/DB
  if (isLoadingLatest) {
    return (
      <main className="premium-page" aria-busy="true">
        <LoadingState />
      </main>
    );
  }

  // Active analysis in progress
  if (isRunning) {
    return (
      <main className="premium-page" aria-busy="true">
        <LoadingState />
      </main>
    );
  }

  // Error from trigger
  if (triggerError && !matchResult) {
    return (
      <main className="premium-page">
        <ErrorState error={triggerError} />
      </main>
    );
  }

  // Show result: mutation result takes precedence over persisted latest
  const displayResult: MatchResult | null = matchResult ?? latestMatch ?? null;

  if (displayResult) {
    return (
      <main className="premium-page">
        <header className="premium-page__header">
          <h1 className="premium-page__heading">Premium Match Analysis</h1>
          <button
            className="premium-page__rerun-btn"
            onClick={() => triggerMatch(resumeId)}
            disabled={isRunning}
            type="button"
          >
            Re-run Analysis
          </button>
        </header>
        <ResultView result={displayResult} />
      </main>
    );
  }

  // No analysis exists yet — prompt user to run
  return (
    <main className="premium-page">
      <header className="premium-page__header">
        <h1 className="premium-page__heading">Premium Match Analysis</h1>
      </header>
      <div className="premium-page__empty">
        <p>No premium analysis found for this resume.</p>
        <button
          className="premium-page__run-btn"
          onClick={() => triggerMatch(resumeId)}
          disabled={isRunning}
          type="button"
        >
          Run Premium Analysis
        </button>
        {latestError && (
          <p className="premium-page__minor-error" role="alert">
            Could not load previous results. Run a new analysis to begin.
          </p>
        )}
      </div>
    </main>
  );
}
