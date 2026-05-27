'use client';

/**
 * @file src/modules/student-onboarding/components/onboarding-step-renderer.tsx
 *
 * ONBOARDING STEP RENDERER
 * ═══════════════════════════
 * Resolves a step ID string → React component and renders it.
 *
 * ARCHITECTURE POSITION (HireRise Blueprint):
 *
 *   Page (student onboarding page)
 *     ↓  passes: currentStep (string), session data, mutation callbacks
 *   [THIS COMPONENT]
 *     ↓  calls: resolveStep(currentStep) → StepRegistryEntry
 *     ↓  renders: <Suspense> → <ErrorBoundary> → <StepComponent>
 *   Step Component (education-step, academics-step, …)
 *     ↓  calls: onComplete(data) → page mutation handler
 *   Mutation Hook (useSaveEducationProfile, useUpdateOnboardingStep, …)
 *     ↓  advances session, invalidates cache
 *   useStudentOnboardingSession (React Query)
 *     ↓  refetches → new currentStep
 *   Page re-renders → Renderer gets new stepId → resolves next component
 *
 * RESPONSIBILITIES:
 *   ✅ Resolve step ID → registry entry
 *   ✅ Lazy-load the step component (Suspense)
 *   ✅ Isolate step errors (ErrorBoundary per step)
 *   ✅ Render a safe fallback for unknown step IDs
 *   ✅ Render a loading skeleton while the component chunk loads
 *
 * WHAT THIS COMPONENT DOES NOT DO:
 *   ✅ No API calls — orchestration stays in the page
 *   ✅ No session state — read by the page, passed as props
 *   ✅ No routing — page owns navigation
 *   ✅ No switch statements — registry handles all dispatch
 *
 * NULL SAFETY:
 *   - currentStep === null → renders <StepLoadingPlaceholder>
 *   - currentStep is unknown (not in registry) → renders <StepFallback>
 *   - component === null (system step) → renders <SystemStepPlaceholder>
 *   - component throws during load → <StepErrorBoundary> catches it
 *
 * FUTURE AI INTEGRATION:
 *   If an AI layer injects a dynamic step into the registry at runtime,
 *   this renderer picks it up automatically — no code changes needed here.
 *   The AI layer only needs to call mergeStepRegistry() in constants/onboarding-steps.ts.
 */

import {
  Component,
  Suspense,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { resolveStep } from '../constants/onboarding-steps';
import type { OnboardingStepProps } from '../constants/step-props';

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PROPS
// ─────────────────────────────────────────────────────────────────────────────

export interface OnboardingStepRendererProps {
  /**
   * The current step ID from the session.
   * e.g. 'education' | 'academics' | 'activities' | …
   * Null while the session is loading.
   */
  currentStepId: string | null;

  /** Called when the step form is submitted. Page handles mutation. */
  onComplete: (data: Record<string, unknown>) => Promise<void>;

  /** True while save/submit mutation is in flight. */
  isBusy: boolean;

  /** Pre-filled data from restored session or prior navigation. */
  initialData?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY
// Isolates per-step failures — a broken step won't crash the entire flow.
// ─────────────────────────────────────────────────────────────────────────────

interface StepErrorBoundaryProps {
  stepId: string;
  children: ReactNode;
}

interface StepErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class StepErrorBoundary extends Component<StepErrorBoundaryProps, StepErrorBoundaryState> {
  constructor(props: StepErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): StepErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, this is where you'd send to your error tracking service
    console.error(
      `[OnboardingStepRenderer] Step "${this.props.stepId}" threw:`,
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <StepErrorFallback
          stepId={this.props.stepId}
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Shown while a step component chunk is loading (React.lazy Suspense). */
function StepLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-xl border border-border bg-card p-6">
      <div className="h-5 w-1/3 rounded bg-muted" />
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="mt-6 space-y-3">
        <div className="h-10 rounded-lg bg-muted" />
        <div className="h-10 rounded-lg bg-muted" />
        <div className="h-10 w-1/2 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

/** Shown when the step is loading (currentStepId === null). */
function StepLoadingPlaceholder() {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <p className="mt-3">Loading your next step…</p>
    </div>
  );
}

/** Shown when a step ID is not in the registry — safe fallback, never crashes. */
function StepFallback({ stepId }: { stepId: string }) {
  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 px-6 py-5">
      <p className="text-sm font-medium text-orange-800">
        Unknown step: <code className="font-mono">{stepId}</code>
      </p>
      <p className="mt-1 text-xs text-orange-600">
        This step isn&apos;t registered yet. Please contact support or refresh the page.
      </p>
    </div>
  );
}

/** Shown when a step component throws during load or render. */
function StepErrorFallback({
  stepId,
  error,
  onRetry,
}: {
  stepId: string;
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-6 py-5">
      <p className="text-sm font-medium text-destructive">
        Step <code className="font-mono">{stepId}</code> failed to load.
      </p>
      {error?.message && (
        <p className="mt-1 text-xs text-destructive/80">{error.message}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
      >
        Try again
      </button>
    </div>
  );
}

/**
 * Shown for system-driven steps (processing, result) that have their own
 * full-screen renderers. The registry entry exists but component is null.
 */
function SystemStepPlaceholder({ stepId }: { stepId: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <p className="mt-3">
        {stepId === 'processing'
          ? 'Analysing your profile…'
          : 'Your results are ready — loading…'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RENDERER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * OnboardingStepRenderer
 *
 * The only component in the system that translates a step ID string into
 * a rendered React component. No switch. No hardcoding. Pure registry lookup.
 *
 * Usage in the student onboarding page:
 *
 *   <OnboardingStepRenderer
 *     currentStepId={session?.currentStep ?? null}
 *     onComplete={handleStepComplete}
 *     isBusy={isSaving}
 *     initialData={restoredData}
 *   />
 */
export function OnboardingStepRenderer({
  currentStepId,
  onComplete,
  isBusy,
  initialData,
}: OnboardingStepRendererProps) {

  // ── 1. Null guard: session loading ───────────────────────────────────────
  if (currentStepId === null) {
    return <StepLoadingPlaceholder />;
  }

  // ── 2. Registry lookup ───────────────────────────────────────────────────
  const entry = resolveStep(currentStepId);

  // ── 3. Unknown step guard ────────────────────────────────────────────────
  if (!entry) {
    return <StepFallback stepId={currentStepId} />;
  }

  // ── 4. System step guard (processing / result) ───────────────────────────
  if (entry.isSystemStep || entry.component === null) {
    return <SystemStepPlaceholder stepId={currentStepId} />;
  }

  // ── 5. Resolve and render step component ─────────────────────────────────
  const StepComponent = entry.component as ComponentType<OnboardingStepProps>;

  return (
    <StepErrorBoundary stepId={currentStepId}>
      <Suspense fallback={<StepLoadingSkeleton />}>
        <StepComponent
          onComplete={onComplete}
          isBusy={isBusy}
          initialData={initialData}
        />
      </Suspense>
    </StepErrorBoundary>
  );
}