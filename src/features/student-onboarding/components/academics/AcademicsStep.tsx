/**
 * front/src/features/student-onboarding/components/academics/AcademicsStep.tsx
 *
 * ACADEMICS STEP — Main Orchestration Component
 * ──────────────────────────────────────────────
 * Top-level step component for academic signal collection.
 *
 * ARCHITECTURE:
 *   AcademicsStep
 *     ├─ AcademicProgressIndicator   (header: signal quality + completion bar)
 *     ├─ AcademicYearNavigator       (year selector tabs)
 *     └─ AcademicYearCard            (active year form)
 *
 * STATE MODEL:
 *   Server state  → useAcademicRecords (React Query cache)
 *   Local draft   → React.useReducer (unsaved edits for the active year)
 *   Active year   → useState (which year card is open)
 *
 * SAVE STRATEGY:
 *   Autosave     → partial save (is_partial: true) on blur / year switch
 *   Manual save  → partial save on "Save Progress" button
 *   Commit save  → is_partial: false on "Continue" — only when signal sufficient
 *
 * PROGRESSION:
 *   next_step comes ONLY from the POST response.
 *   This component NEVER calculates advancement locally.
 */

'use client';

import './academics.css';

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  AcademicProgressIndicator,
  AcademicYearNavigator,
  AcademicYearCard,
} from './AcademicComponents';

import {
  useAcademicRecords,
  useSaveAcademicYear,
  useAcademicProgress,
} from '@/modules/student-onboarding/hooks/use-academics';

import {
  logOnboardingEvent,
} from '@/features/student-onboarding/lib/onboarding-diagnostics';

import type {
  AcademicYear,
  AcademicYearDraft,
  AcademicsDraftState,
  SubjectMarksInput,
  AcademicBoardType,
} from '@/features/student-onboarding/lib/academic.types';

import { ACADEMIC_YEARS_LIST } from '@/features/student-onboarding/lib/academic.types';

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT REDUCER
// Manages unsaved local edits per year without touching server state.
// ─────────────────────────────────────────────────────────────────────────────

type DraftAction =
  | { type: 'INIT_FROM_SERVER';  years: Record<string, any> }
  | { type: 'SET_BOARD';         year: AcademicYear; board: AcademicBoardType }
  | { type: 'SET_PREDICTED';     year: AcademicYear; value: boolean }
  | { type: 'UPSERT_SUBJECT';    year: AcademicYear; subject: SubjectMarksInput }
  | { type: 'REMOVE_SUBJECT';    year: AcademicYear; subjectName: string }
  | { type: 'SET_SAVING';        year: AcademicYear; value: boolean }
  | { type: 'SET_SAVE_ERROR';    year: AcademicYear; error: string | null }
  | { type: 'MARK_SAVED';        year: AcademicYear }
  | { type: 'SET_SUBMITTING';    value: boolean }
  | { type: 'SET_SUBMIT_ERROR';  error: string | null };

function buildEmptyYearDraft(year: AcademicYear): AcademicYearDraft {
  return {
    academic_year: year,
    board_type:    'cbse',
    is_predicted:  false,
    subjects:      [],
    is_touched:    false,
    is_saving:     false,
    save_error:    null,
  };
}

function initDraftFromServer(
  serverYears: Record<string, any>,
): AcademicsDraftState['years'] {
  const draft = {} as Record<AcademicYear, AcademicYearDraft>;
  for (const year of ACADEMIC_YEARS_LIST) {
    const saved = serverYears[year];
    draft[year] = saved
      ? {
          academic_year: year,
          board_type:    saved.board_type    ?? 'cbse',
          is_predicted:  saved.is_predicted  ?? false,
          subjects:      (saved.subjects ?? []).map((s: any): SubjectMarksInput => ({
            subject:        s.subject,
            marks_obtained: s.marks_obtained,
            max_marks:      s.max_marks,
            grade:          s.grade,
            source_type:    s.source_type ?? 'manual',
            is_predicted:   s.is_predicted ?? false,
          })),
          is_touched:  false,
          is_saving:   false,
          save_error:  null,
        }
      : buildEmptyYearDraft(year);
  }
  return draft;
}

function draftReducer(
  state: AcademicsDraftState,
  action: DraftAction,
): AcademicsDraftState {
  switch (action.type) {
    case 'INIT_FROM_SERVER':
      return {
        ...state,
        years: initDraftFromServer(action.years),
      };

    case 'SET_BOARD':
      return {
        ...state,
        years: {
          ...state.years,
          [action.year]: {
            ...state.years[action.year],
            board_type: action.board,
            is_touched: true,
          },
        },
      };

    case 'SET_PREDICTED':
      return {
        ...state,
        years: {
          ...state.years,
          [action.year]: {
            ...state.years[action.year],
            is_predicted: action.value,
            is_touched:   true,
          },
        },
      };

    case 'UPSERT_SUBJECT': {
      const existing = state.years[action.year].subjects;
      const idx      = existing.findIndex((s) => s.subject === action.subject.subject);
      const updated  = idx >= 0
        ? existing.map((s, i) => (i === idx ? action.subject : s))
        : [...existing, action.subject];

      return {
        ...state,
        years: {
          ...state.years,
          [action.year]: {
            ...state.years[action.year],
            subjects:   updated,
            is_touched: true,
          },
        },
      };
    }

    case 'REMOVE_SUBJECT':
      return {
        ...state,
        years: {
          ...state.years,
          [action.year]: {
            ...state.years[action.year],
            subjects:   state.years[action.year].subjects.filter(
              (s) => s.subject !== action.subjectName,
            ),
            is_touched: true,
          },
        },
      };

    case 'SET_SAVING':
      return {
        ...state,
        years: {
          ...state.years,
          [action.year]: { ...state.years[action.year], is_saving: action.value },
        },
      };

    case 'SET_SAVE_ERROR':
      return {
        ...state,
        years: {
          ...state.years,
          [action.year]: { ...state.years[action.year], save_error: action.error },
        },
      };

    case 'MARK_SAVED':
      return {
        ...state,
        years: {
          ...state.years,
          [action.year]: {
            ...state.years[action.year],
            is_touched: false,
            is_saving:  false,
            save_error: null,
          },
        },
      };

    case 'SET_SUBMITTING':
      return { ...state, is_submitting: action.value };

    case 'SET_SUBMIT_ERROR':
      return { ...state, submit_error: action.error };

    default:
      return state;
  }
}

const INITIAL_DRAFT_STATE: AcademicsDraftState = {
  years:         {} as Record<AcademicYear, AcademicYearDraft>,
  active_year:   null,
  is_submitting: false,
  submit_error:  null,
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AcademicsStep() {
  const router = useRouter();

  // Server state
  const { years: serverYears, signalQuality, isLoading, isError, refetch } = useAcademicRecords();
  const { progress }                                               = useAcademicProgress();
  const { saveYear, isSaving }                                     = useSaveAcademicYear();

  // Local draft
  const [draft, dispatch] = useReducer(draftReducer, INITIAL_DRAFT_STATE);
  const [activeYear, setActiveYear] = useState<AcademicYear>('class_10');

  // Guard: ensures INIT_FROM_SERVER only dispatches once, on first successful
  // load. Without this, serverYears produces a new object reference on every
  // React Query render, causing the useEffect to re-fire and loop infinitely.
  const hasInitialized = useRef(false);

  // ── Hydrate draft from server state on first load ──────────────────────────
  useEffect(() => {
    if (hasInitialized.current || isLoading || !serverYears) return;
    hasInitialized.current = true;
    dispatch({ type: 'INIT_FROM_SERVER', years: serverYears });
  }, [isLoading, serverYears]);

  // ── Autosave: triggered on year switch if the leaving year is dirty ────────
  const handleYearSwitch = useCallback(
    async (newYear: AcademicYear) => {
      const leavingDraft = draft.years[activeYear];
      if (leavingDraft?.is_touched && leavingDraft.subjects.length > 0) {
        await triggerPartialSave(activeYear, leavingDraft);
      }
      setActiveYear(newYear);
    },
    [activeYear, draft.years],
  );

  // ── Partial save (autosave + manual save) ─────────────────────────────────
  const triggerPartialSave = useCallback(
    async (year: AcademicYear, yearDraft: AcademicYearDraft) => {
      dispatch({ type: 'SET_SAVING',     year, value: true });
      dispatch({ type: 'SET_SAVE_ERROR', year, error: null });

      try {
        await saveYear({
          academicYear: year,
          yearInput: {
            board_type:   yearDraft.board_type,
            is_predicted: yearDraft.is_predicted,
            subjects:     yearDraft.subjects,
          },
          isPartial: true,
        });
        dispatch({ type: 'MARK_SAVED', year });
      } catch (err: any) {
        dispatch({ type: 'SET_SAVE_ERROR', year, error: err.message });
      }
    },
    [saveYear],
  );

  // ── Commit save (Continue button) ─────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    if (!signalQuality?.is_sufficient) return;

    dispatch({ type: 'SET_SUBMITTING',   value: true });
    dispatch({ type: 'SET_SUBMIT_ERROR', error: null });

    // Log privacy-safe info event before committing (no marks/grades in payload)
    logOnboardingEvent({
      event:          'onboarding_resumed',
      severity:       'info',
      timestamp:      new Date().toISOString(),
      onboardingStep: 'academics',
      metadata: {
        resumeStep:         'academics',
        completedStepCount: signalQuality.committed_year_count,
        isStaleSession:     false,
      },
    });

    try {
      // Commit the current active year — server evaluates quality
      const activeDraft = draft.years[activeYear];
      const result = await saveYear({
        academicYear: activeYear,
        yearInput: {
          board_type:   activeDraft.board_type,
          is_predicted: activeDraft.is_predicted,
          subjects:     activeDraft.subjects,
        },
        isPartial: false,
      });

      if (result.next_step && result.next_step !== 'academics') {
        // Session advanced — let the onboarding router handle navigation
        router.refresh();
      } else {
        // Signal insufficient despite commit attempt
        dispatch({
          type:  'SET_SUBMIT_ERROR',
          error: 'Please add more academic subjects to continue.',
        });
      }
    } catch (err: any) {
      dispatch({ type: 'SET_SUBMIT_ERROR', error: err.message });
      logOnboardingEvent({
        event:          'session_fetch_failed',
        severity:       'error',
        timestamp:      new Date().toISOString(),
        onboardingStep: 'academics',
        metadata: {
          errorCategory: 'academic_commit_failed',
          errorMessage:  err.message,
        },
      });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', value: false });
    }
  }, [signalQuality, activeYear, draft.years, saveYear, router]);

  // ── Subject handlers (passed down to AcademicYearCard) ────────────────────
  const handleUpsertSubject = useCallback(
    (year: AcademicYear, subject: SubjectMarksInput) => {
      dispatch({ type: 'UPSERT_SUBJECT', year, subject });
    },
    [],
  );

  const handleRemoveSubject = useCallback(
    (year: AcademicYear, subjectName: string) => {
      dispatch({ type: 'REMOVE_SUBJECT', year, subjectName });
    },
    [],
  );

  const handleSetBoard = useCallback(
    (year: AcademicYear, board: AcademicBoardType) => {
      dispatch({ type: 'SET_BOARD', year, board });
    },
    [],
  );

  const handleSetPredicted = useCallback(
    (year: AcademicYear, value: boolean) => {
      dispatch({ type: 'SET_PREDICTED', year, value });
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="academics-step academics-step--loading">
        <div className="academics-step__skeleton" aria-busy="true" aria-label="Loading your academic history" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="academics-step academics-step--error" role="alert">
        <p>Unable to load your academic history. Please try refreshing.</p>
        <button
          onClick={() => refetch()}
          className="academics-step__retry-btn"
          style={{ marginTop: '0.75rem' }}
        >
          Try again
        </button>
      </div>
    );
  }

  const activeDraft = draft.years[activeYear];

  return (
    <div className="academics-step">
      {/* Progress header */}
      <AcademicProgressIndicator
        progress={progress}
        activeYear={activeYear}
      />

      {/* Year selector */}
      <AcademicYearNavigator
        activeYear={activeYear}
        progress={progress}
        onYearSelect={handleYearSwitch}
      />

      {/* Active year form */}
      {activeDraft && (
        <AcademicYearCard
          key={activeYear}
          yearDraft={activeDraft}
          onUpsertSubject={(subject: SubjectMarksInput) => handleUpsertSubject(activeYear, subject)}
          onRemoveSubject={(name: string) => handleRemoveSubject(activeYear, name)}
          onSetBoard={(board: AcademicBoardType) => handleSetBoard(activeYear, board)}
          onSetPredicted={(val: boolean) => handleSetPredicted(activeYear, val)}
          onSave={() => triggerPartialSave(activeYear, activeDraft)}
          isSaving={isSaving || activeDraft.is_saving}
          saveError={activeDraft.save_error}
        />
      )}

      {/* Footer: error + continue */}
      <div className="academics-step__footer">
        {draft.submit_error && (
          <p className="academics-step__submit-error" role="alert">
            {draft.submit_error}
          </p>
        )}

        <button
          className="academics-step__continue-btn"
          onClick={handleContinue}
          disabled={draft.is_submitting || !signalQuality?.is_sufficient}
          aria-disabled={!signalQuality?.is_sufficient}
        >
          {draft.is_submitting ? 'Saving…' : 'Continue'}
        </button>

        {!signalQuality?.is_sufficient && (
          <p className="academics-step__hint">
            Add at least 4 subjects for one year, or subjects across 2 years, to continue.
          </p>
        )}
      </div>
    </div>
  );
}