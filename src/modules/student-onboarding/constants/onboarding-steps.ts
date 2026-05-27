/**
 * @file src/modules/student-onboarding/constants/onboarding-steps.ts
 *
 * STUDENT ONBOARDING STEP REGISTRY
 * ══════════════════════════════════
 * Single source of truth for all student onboarding step definitions.
 *
 * AcademicsStep is wired via AcademicsStepAdapter to satisfy the
 * OnboardingStepProps registry contract without altering the step component.
 */

import { lazy }                         from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { OnboardingStep }          from '../api/student-onboarding.types';
import { ONBOARDING_STEPS }             from '../api/student-onboarding.types';
import type { OnboardingStepProps }     from './step-props';

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY ENTRY TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface StepRegistryEntry {
  readonly id:           OnboardingStep;
  readonly label:        string;
  readonly subtitle?:    string;
  readonly component:    LazyExoticComponent<ComponentType<OnboardingStepProps>> | null;
  readonly isTerminal?:  boolean;
  readonly isSystemStep?: boolean;
  readonly validate?:    (accumulatedData: Record<string, unknown>) => boolean;
}

export type StepRegistryMap = Record<string, StepRegistryEntry>;

// ─────────────────────────────────────────────────────────────────────────────
// LAZY COMPONENT FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

const EducationStepLazy  = lazy(() => import('../steps/education-step'));
const AcademicsStepLazy  = lazy(() => import('@/features/student-onboarding/components/academics/AcademicsStepAdapter'));
const ActivitiesStepLazy = lazy(() => import('../steps/activities-step'));
const CognitiveStepLazy  = lazy(() => import('../steps/cognitive-step'));
const AspirationStepLazy = lazy(() => import('../steps/aspiration-step'));
const ProcessingStepLazy = lazy(() => import('../steps/processing-step'));
const ResultStepLazy     = lazy(() => import('../steps/result-step'));

// ─────────────────────────────────────────────────────────────────────────────
// STEP REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const STEP_REGISTRY: StepRegistryMap = {

  education: {
    id:           'education' as OnboardingStep,
    label:        'Education',
    subtitle:     'Tell us about your school and board',
    component:    EducationStepLazy,
    isTerminal:   false,
    isSystemStep: false,
  },

  academics: {
    id:           'academics' as OnboardingStep,
    label:        'Academics',
    subtitle:     'Share your subjects and performance',
    component:    AcademicsStepLazy,
    isTerminal:   false,
    isSystemStep: false,
  },

  activities: {
    id:           'activities' as OnboardingStep,
    label:        'Activities',
    subtitle:     'What do you do outside of school?',
    component:    ActivitiesStepLazy,
    isTerminal:   false,
    isSystemStep: false,
  },

  cognitive: {
    id:           'cognitive' as OnboardingStep,
    label:        'Thinking Style',
    subtitle:     'How do you approach problems?',
    component:    CognitiveStepLazy,
    isTerminal:   false,
    isSystemStep: false,
  },

  aspiration: {
    id:           'aspiration' as OnboardingStep,
    label:        'Aspirations',
    subtitle:     'What kind of future do you want to build?',
    component:    AspirationStepLazy,
    isTerminal:   true,
    isSystemStep: false,
  },

  processing: {
    id:           'processing' as OnboardingStep,
    label:        'Processing',
    subtitle:     'Analysing your profile…',
    component:    ProcessingStepLazy,
    isTerminal:   false,
    isSystemStep: true,
  },

  result: {
    id:           'result' as OnboardingStep,
    label:        'Your Results',
    subtitle:     'Your personalised career path is ready',
    component:    ResultStepLazy,
    isTerminal:   false,
    isSystemStep: true,
  },

};

// ─────────────────────────────────────────────────────────────────────────────
// ORDERED STEP SEQUENCE
// Filters out any step IDs in ONBOARDING_STEPS that don't have a registry
// entry yet — prevents runtime crashes when the backend has steps the frontend
// hasn't implemented yet.
// ─────────────────────────────────────────────────────────────────────────────

export const STUDENT_ONBOARDING_STEPS: readonly StepRegistryEntry[] =
  ONBOARDING_STEPS
    .map((id) => STEP_REGISTRY[id as string])
    .filter((entry): entry is StepRegistryEntry => entry !== undefined);

export const COMPLETABLE_STEP_ENTRIES: readonly StepRegistryEntry[] =
  STUDENT_ONBOARDING_STEPS.filter((s) => !s.isSystemStep);

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

export function resolveStep(stepId: string): StepRegistryEntry | null {
  if (!stepId) return null;
  return STEP_REGISTRY[stepId] ?? null;
}

export function isKnownStep(stepId: string): stepId is OnboardingStep {
  return stepId in STEP_REGISTRY;
}

export function getStepIndex(stepId: string): number {
  return STUDENT_ONBOARDING_STEPS.findIndex((s) => s.id === stepId);
}

export function getProgressPercent(completedStepIds: readonly string[]): number {
  const denominator = COMPLETABLE_STEP_ENTRIES.length;
  if (denominator === 0) return 0;

  const completedCount = COMPLETABLE_STEP_ENTRIES.filter(
    (entry) => completedStepIds.includes(entry.id),
  ).length;

  return Math.round((completedCount / denominator) * 100);
}
