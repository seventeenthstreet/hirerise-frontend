/**
 * @file src/features/professional-onboarding/components/ReviewScreen.tsx
 *
 * WP-PRO-09F — Review, Completion & Route Registration
 * Implements requirement #2 (Edit → navigate to Guided Builder step) and
 * requirement #4 (Continue → complete onboarding, then hand off to the
 * Completion screen).
 *
 * Rendered inside `pages/onboarding/profile/ReviewPage.tsx` at
 * `ROUTES.ONBOARDING_PROFILE_REVIEW` — the route both the Guided Builder
 * track (`useAdvanceToNextStep`, once every gating step is done) and the
 * Resume Upload track (`ResumeUploadScreen`, via `resolveStep('profile_review')`)
 * already navigate to. This screen is the first UI to actually live there.
 *
 * DATA SOURCE:
 *   `useGuidedBuilderProfile()` (WP-PRO-09C, read-only, already exists).
 *   `ProfessionalProfile` is intentionally typed as `Record<string, unknown>`
 *   (see types/index.ts) — this screen does its own local narrowing per
 *   section below, matching the exact field names the five step forms'
 *   own `readInitial*` functions already read (personalInformation,
 *   education, experience, skills, careerGoals). No new backend shape is
 *   invented here.
 *
 * COMPLETION:
 *   "Confirm & continue" calls `useCompleteOnboarding()` (WP-PRO-09C,
 *   already exists, deliberately does not call the career-report endpoint)
 *   and, on success, navigates to `ROUTES.ONBOARDING_PROFILE_COMPLETE`.
 *   CompletionScreen.tsx no longer offers career-report generation itself
 *   (WP-PRO-03 follow-up) — it shows a single "Go to Dashboard" action.
 *   AI career-report generation now lives exclusively on the Dashboard.
 */

import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routes.constants';
import { Button, Card, CardContent, Spinner } from '@/components/ui';
import { StepContainer, StepTitle, StepDescription, StepActions } from '@/components/onboarding/steps';

import { useGuidedBuilderProfile } from '../hooks/useGuidedBuilderProfile';
import { useCompleteOnboarding } from '../hooks/useCompleteOnboarding';
import { getGuidedBuilderErrorMessage } from '../utils/error-message';
import { ApiErrorBanner } from './FormField';
import type { ProfessionalProfile } from '../types';
// WP-DIAG-01 TEMP — diagnostic-only import, remove alongside the log calls below.
import { logEvent, createEvent } from '@/lib/observability';

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL NARROWING  (display-only — mirrors the step forms' own readInitial*)
// ─────────────────────────────────────────────────────────────────────────────

interface PersonalInformation {
  fullName?: string;
  email?: string;
  phone?: string;
  currentCity?: string;
  currentJobTitle?: string;
  currentCompany?: string;
  workAuthorization?: string;
}

interface EducationEntry {
  degree?: string;
  institution?: string;
  fieldOfStudy?: string;
  startYear?: string | number;
  endYear?: string | number;
}

interface ExperienceEntry {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
}

interface CareerGoals {
  targetRole?: string;
}

function readPersonalInformation(profile: ProfessionalProfile): PersonalInformation {
  return (profile.personalInformation ?? {}) as PersonalInformation;
}

function readEducation(profile: ProfessionalProfile): EducationEntry[] {
  const raw = profile.education;
  return Array.isArray(raw) ? (raw as EducationEntry[]) : [];
}

function readExperience(profile: ProfessionalProfile): ExperienceEntry[] {
  const raw = profile.experience;
  return Array.isArray(raw) ? (raw as ExperienceEntry[]) : [];
}

function readSkills(profile: ProfessionalProfile): string[] {
  const raw = profile.skills;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === 'string' ? s : (s as { name?: string })?.name))
    .filter((s): s is string => !!s && s.trim().length > 0);
}

function readCareerGoals(profile: ProfessionalProfile): CareerGoals {
  return (profile.careerGoals ?? {}) as CareerGoals;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION SHELL
// ─────────────────────────────────────────────────────────────────────────────

interface ReviewSectionProps {
  title: string;
  editRoute: string;
  isEmpty: boolean;
  emptyLabel: string;
  children: ReactNode;
}

function ReviewSection({ title, editRoute, isEmpty, emptyLabel, children }: ReviewSectionProps) {
  return (
    <Card className="p-0">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Link
            to={editRoute}
            className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Edit
          </Link>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {isEmpty ? <p>{emptyLabel}</p> : children}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ReviewScreen() {
  const navigate = useNavigate();
  const { profile, isLoading, error, refetch } = useGuidedBuilderProfile();
  const completeMutation = useCompleteOnboarding();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16" role="status" aria-live="polite">
        <Spinner size="lg" label="Loading your profile" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-6 text-center" role="alert">
        <p className="text-sm text-destructive">{getGuidedBuilderErrorMessage(error)}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-3 text-sm font-medium text-destructive underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    );
  }

  const data: ProfessionalProfile = profile ?? {};
  const personal = readPersonalInformation(data);
  const education = readEducation(data);
  const experience = readExperience(data);
  const skills = readSkills(data);
  const careerGoals = readCareerGoals(data);

  const hasPersonal = Boolean(personal.fullName || personal.email);

  async function handleConfirm() {
    // WP-DIAG-01 TEMP — remove this whole block (and the logEvent/createEvent
    // import above) once the completion/auth investigation is closed.
    const wpDiagStartedAt = Date.now();
    logEvent(createEvent({
      type:  'system',
      name:  'WP_DIAG_REVIEW_COMPLETE_START',
      level: 'info',
      context: {
        tag:       '[WP-DIAG]',
        stage:     'ReviewScreen:before POST /api/v1/onboarding/complete',
        route:     ROUTES.ONBOARDING_PROFILE_REVIEW,
        timestamp: new Date(wpDiagStartedAt).toISOString(),
      },
    }));

    try {
      await completeMutation.mutateAsync();
      // WP-DIAG-01 TEMP
      logEvent(createEvent({
        type:  'system',
        name:  'WP_DIAG_REVIEW_COMPLETE_RESPONSE',
        level: 'info',
        context: {
          tag:          '[WP-DIAG]',
          stage:        'ReviewScreen:POST /api/v1/onboarding/complete resolved',
          httpOutcome:  'success',
          elapsedMs:    Date.now() - wpDiagStartedAt,
        },
      }));
    } catch (err) {
      // WP-DIAG-01 TEMP
      logEvent(createEvent({
        type:  'system',
        name:  'WP_DIAG_REVIEW_COMPLETE_RESPONSE',
        level: 'error',
        context: {
          tag:         '[WP-DIAG]',
          stage:       'ReviewScreen:POST /api/v1/onboarding/complete rejected',
          httpOutcome: 'error',
          message:     err instanceof Error ? err.message : String(err),
          elapsedMs:   Date.now() - wpDiagStartedAt,
        },
      }));
      // Preserve exact pre-existing behaviour: a failed completion must not
      // navigate to the Completion screen. Re-throw so completeMutation's
      // own isError/error state (already wired to <ApiErrorBanner>) still
      // surfaces exactly as it did before this instrumentation was added.
      throw err;
    }

    navigate(ROUTES.ONBOARDING_PROFILE_COMPLETE);
  }

  return (
    <StepContainer maxWidth="max-w-2xl">
      <StepTitle>Review your profile</StepTitle>
      <StepDescription>
        Here&apos;s what we have so far. Everything can be edited later from your dashboard, but it&apos;s worth a
        quick check now.
      </StepDescription>

      <div className="space-y-4">
        <ReviewSection
          title="Personal details"
          editRoute={ROUTES.ONBOARDING_BUILDER_PERSONAL}
          isEmpty={!hasPersonal}
          emptyLabel="No personal details yet."
        >
          <p className="font-medium text-foreground">{personal.fullName}</p>
          <p>{personal.email}</p>
          {personal.currentJobTitle && (
            <p>
              {personal.currentJobTitle}
              {personal.currentCompany ? ` at ${personal.currentCompany}` : ''}
            </p>
          )}
        </ReviewSection>

        <ReviewSection
          title="Education"
          editRoute={ROUTES.ONBOARDING_BUILDER_EDUCATION}
          isEmpty={education.length === 0}
          emptyLabel="No education added yet."
        >
          <ul className="space-y-1">
            {education.map((entry, i) => (
              <li key={i}>
                {entry.degree}
                {entry.fieldOfStudy ? `, ${entry.fieldOfStudy}` : ''}
                {entry.institution ? ` — ${entry.institution}` : ''}
              </li>
            ))}
          </ul>
        </ReviewSection>

        <ReviewSection
          title="Experience"
          editRoute={ROUTES.ONBOARDING_BUILDER_EXPERIENCE}
          isEmpty={experience.length === 0}
          emptyLabel="No experience added yet."
        >
          <ul className="space-y-1">
            {experience.map((entry, i) => (
              <li key={i}>
                {entry.title}
                {entry.company ? ` at ${entry.company}` : ''}
                {entry.current ? ' (current)' : ''}
              </li>
            ))}
          </ul>
        </ReviewSection>

        <ReviewSection
          title="Skills"
          editRoute={ROUTES.ONBOARDING_BUILDER_SKILLS}
          isEmpty={skills.length === 0}
          emptyLabel="No skills added yet."
        >
          <p>{skills.join(', ')}</p>
        </ReviewSection>

        <ReviewSection
          title="Career goals"
          editRoute={ROUTES.ONBOARDING_BUILDER_CAREER_GOALS}
          isEmpty={!careerGoals.targetRole}
          emptyLabel="No career goals added yet."
        >
          <p>{careerGoals.targetRole}</p>
        </ReviewSection>
      </div>

      <ApiErrorBanner
        message={completeMutation.isError ? getGuidedBuilderErrorMessage(completeMutation.error) : null}
      />

      <StepActions>
        <Button type="button" onClick={handleConfirm} disabled={completeMutation.isPending}>
          {completeMutation.isPending ? 'Saving…' : 'Confirm & continue'}
        </Button>
      </StepActions>
    </StepContainer>
  );
}