/**
 * front/src/features/student-onboarding/components/academics/AcademicYearCard.tsx
 *
 * ACADEMIC YEAR CARD
 * ───────────────────
 * Renders the form for a single academic year.
 * Shows board selector, predicted toggle, and a list of subject rows.
 *
 * Mobile-first, lightweight, guided — not a table.
 */



import React, { useState } from 'react';

import type {
  AcademicBoardType,
  AcademicSubject,
  AcademicYearDraft,
  SubjectMarksInput,
} from '@/features/student-onboarding/lib/academic.types';

import {
  ACADEMIC_BOARD_TYPES_LIST,
  ACADEMIC_BOARD_LABELS,
  ACADEMIC_SUBJECTS_LIST,
  ACADEMIC_SUBJECT_LABELS,
  ACADEMIC_YEAR_LABELS,
} from '@/features/student-onboarding/lib/academic.types';

// SubjectMarksInputRow is defined below in this file — no import needed.

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface AcademicYearCardProps {
  yearDraft:        AcademicYearDraft;
  onUpsertSubject:  (subject: SubjectMarksInput) => void;
  onRemoveSubject:  (subjectName: string) => void;
  onSetBoard:       (board: AcademicBoardType) => void;
  onSetPredicted:   (value: boolean) => void;
  onSave:           () => void;
  isSaving:         boolean;
  saveError:        string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function AcademicYearCard({
  yearDraft,
  onUpsertSubject,
  onRemoveSubject,
  onSetBoard,
  onSetPredicted,
  onSave,
  isSaving,
  saveError,
}: AcademicYearCardProps) {
  // Subject picker: which subjects the student has chosen to add
  const selectedSubjects = new Set(yearDraft.subjects.map((s) => s.subject));
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleAddSubject = (subject: AcademicSubject) => {
    if (selectedSubjects.has(subject)) return;
    onUpsertSubject({
      subject,
      marks_obtained: null,
      max_marks:      100,   // Sensible default for most Indian boards
      grade:          null,
      source_type:    'manual',
      is_predicted:   yearDraft.is_predicted,
    });
    setPickerOpen(false);
  };

  return (
    <div className="academic-year-card" aria-label={`${ACADEMIC_YEAR_LABELS[yearDraft.academic_year]} academic record`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="academic-year-card__header">
        <h3 className="academic-year-card__title">
          {ACADEMIC_YEAR_LABELS[yearDraft.academic_year]}
        </h3>

        {/* Board selector */}
        <label className="academic-year-card__board-label" htmlFor={`board-${yearDraft.academic_year}`}>
          Board
        </label>
        <select
          id={`board-${yearDraft.academic_year}`}
          className="academic-year-card__board-select"
          value={yearDraft.board_type}
          onChange={(e) => onSetBoard(e.target.value as AcademicBoardType)}
        >
          {ACADEMIC_BOARD_TYPES_LIST.map((board) => (
            <option key={board} value={board}>
              {ACADEMIC_BOARD_LABELS[board]}
            </option>
          ))}
        </select>

        {/* Predicted toggle (Class 12 awaiting results) */}
        <label className="academic-year-card__predicted-toggle">
          <input
            type="checkbox"
            checked={yearDraft.is_predicted}
            onChange={(e) => onSetPredicted(e.target.checked)}
          />
          <span>Predicted / awaiting results</span>
        </label>
      </div>

      {/* ── Subject rows ───────────────────────────────────────────────── */}
      <div className="academic-year-card__subjects">
        {yearDraft.subjects.length === 0 && (
          <p className="academic-year-card__empty">
            No subjects added yet. Tap "Add Subject" to begin.
          </p>
        )}

        {yearDraft.subjects.map((subject) => (
          <SubjectMarksInputRow
            key={subject.subject}
            value={subject}
            onChange={onUpsertSubject}
            onRemove={() => onRemoveSubject(subject.subject)}
          />
        ))}
      </div>

      {/* ── Add subject picker ─────────────────────────────────────────── */}
      <div className="academic-year-card__add-subject">
        <button
          type="button"
          className="academic-year-card__add-btn"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
        >
          + Add Subject
        </button>

        {pickerOpen && (
          <div className="academic-year-card__subject-picker" role="listbox" aria-label="Select a subject">
            {ACADEMIC_SUBJECTS_LIST.filter((s) => !selectedSubjects.has(s)).map((subject) => (
              <button
                key={subject}
                role="option"
                aria-selected={false}
                className="academic-year-card__subject-option"
                onClick={() => handleAddSubject(subject)}
              >
                {ACADEMIC_SUBJECT_LABELS[subject]}
              </button>
            ))}
            {ACADEMIC_SUBJECTS_LIST.every((s) => selectedSubjects.has(s)) && (
              <p className="academic-year-card__all-added">All subjects added.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Save footer ────────────────────────────────────────────────── */}
      <div className="academic-year-card__footer">
        {saveError && (
          <p className="academic-year-card__error" role="alert">{saveError}</p>
        )}

        {yearDraft.is_touched && (
          <button
            type="button"
            className="academic-year-card__save-btn"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Progress'}
          </button>
        )}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════

/**
 * front/src/features/student-onboarding/components/academics/SubjectMarksInput.tsx
 *
 * SUBJECT MARKS INPUT ROW
 * ────────────────────────
 * A single subject row with marks inputs (or grade selector as fallback).
 * Mobile-first: large touch targets, inline layout.
 *
 * UX RULES:
 *   • If student enters both marks AND grade, marks take precedence.
 *   • max_marks defaults to 100 but is editable (IB uses different scales).
 *   • Grade is optional — student can leave it blank.
 */

interface SubjectMarksInputRowProps {
  value:    SubjectMarksInput;
  onChange: (updated: SubjectMarksInput) => void;
  onRemove: () => void;
}

export function SubjectMarksInputRow({
  value,
  onChange,
  onRemove,
}: SubjectMarksInputRowProps) {
  const update = (partial: Partial<SubjectMarksInput>) =>
    onChange({ ...value, ...partial });

  return (
    <div className="subject-marks-input" role="group" aria-label={ACADEMIC_SUBJECT_LABELS[value.subject]}>

      {/* Subject label + remove */}
      <div className="subject-marks-input__header">
        <span className="subject-marks-input__name">
          {ACADEMIC_SUBJECT_LABELS[value.subject]}
        </span>
        <button
          type="button"
          className="subject-marks-input__remove"
          onClick={onRemove}
          aria-label={`Remove ${ACADEMIC_SUBJECT_LABELS[value.subject]}`}
        >
          ✕
        </button>
      </div>

      {/* Marks row */}
      <div className="subject-marks-input__marks-row">
        <label className="subject-marks-input__field">
          <span>Marks</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={value.max_marks ?? 100}
            value={value.marks_obtained ?? ''}
            placeholder="e.g. 88"
            onChange={(e) =>
              update({
                marks_obtained: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className="subject-marks-input__number"
          />
        </label>

        <span className="subject-marks-input__divider">out of</span>

        <label className="subject-marks-input__field">
          <span>Max</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={value.max_marks ?? ''}
            placeholder="100"
            onChange={(e) =>
              update({
                max_marks: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className="subject-marks-input__number"
          />
        </label>
      </div>

      {/* Predicted toggle per subject */}
      <label className="subject-marks-input__predicted">
        <input
          type="checkbox"
          checked={value.is_predicted}
          onChange={(e) => update({ is_predicted: e.target.checked })}
        />
        <span>Predicted</span>
      </label>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════

/**
 * front/src/features/student-onboarding/components/academics/AcademicProgressIndicator.tsx
 *
 * ACADEMIC PROGRESS INDICATOR
 * ────────────────────────────
 * Header bar showing overall academic signal quality.
 * Stays mounted above the year navigator — does not re-render on subject edit.
 */

import type {
  AcademicProgressSummary,
  AcademicYear as AcYear,
} from '@/features/student-onboarding/lib/academic.types';

interface AcademicProgressIndicatorProps {
  progress:   AcademicProgressSummary | null;
  activeYear: AcYear;
}

export function AcademicProgressIndicator({
  progress,
  activeYear: _activeYear,
}: AcademicProgressIndicatorProps) {
  if (!progress) return null;

  const { total_years_touched, total_subjects_saved, can_advance } = progress;

  return (
    <div className="academic-progress-indicator" aria-label="Academic progress summary">
      <div className="academic-progress-indicator__stats">
        <span className="academic-progress-indicator__stat">
          <strong>{total_years_touched}</strong> year{total_years_touched !== 1 ? 's' : ''} added
        </span>
        <span className="academic-progress-indicator__divider" aria-hidden>·</span>
        <span className="academic-progress-indicator__stat">
          <strong>{total_subjects_saved}</strong> subject{total_subjects_saved !== 1 ? 's' : ''} saved
        </span>
      </div>

      {/* Signal quality badge */}
      <div
        className={`academic-progress-indicator__badge ${
          can_advance
            ? 'academic-progress-indicator__badge--sufficient'
            : 'academic-progress-indicator__badge--insufficient'
        }`}
        aria-live="polite"
      >
        {can_advance
          ? '✓ Ready to continue'
          : 'Add more subjects to continue'}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════

/**
 * front/src/features/student-onboarding/components/academics/AcademicYearNavigator.tsx
 *
 * ACADEMIC YEAR NAVIGATOR
 * ────────────────────────
 * Horizontal tab strip for switching between academic years.
 * Shows completion indicators per year.
 * Mobile-scrollable on narrow viewports.
 */

interface AcademicYearNavigatorProps {
  activeYear:    AcYear;
  progress:      AcademicProgressSummary | null;
  onYearSelect:  (year: AcYear) => void;
}

export function AcademicYearNavigator({
  activeYear,
  progress,
  onYearSelect,
}: AcademicYearNavigatorProps) {
  if (!progress) return null;

  return (
    <nav
      className="academic-year-navigator"
      aria-label="Academic years"
      role="tablist"
    >
      {progress.years.map((yearProgress) => (
        <button
          key={yearProgress.academic_year}
          role="tab"
          aria-selected={yearProgress.academic_year === activeYear}
          className={[
            'academic-year-navigator__tab',
            yearProgress.academic_year === activeYear
              ? 'academic-year-navigator__tab--active'
              : '',
            yearProgress.is_complete
              ? 'academic-year-navigator__tab--complete'
              : '',
            yearProgress.subject_count > 0 && !yearProgress.is_complete
              ? 'academic-year-navigator__tab--partial'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onYearSelect(yearProgress.academic_year as AcYear)}
        >
          <span className="academic-year-navigator__label">
            {yearProgress.label}
          </span>

          {/* Completion dot */}
          {yearProgress.is_complete && (
            <span
              className="academic-year-navigator__dot academic-year-navigator__dot--complete"
              aria-label="complete"
            >
              ✓
            </span>
          )}
          {!yearProgress.is_complete && yearProgress.subject_count > 0 && (
            <span
              className="academic-year-navigator__dot academic-year-navigator__dot--partial"
              aria-label={`${yearProgress.subject_count} subjects`}
            >
              {yearProgress.subject_count}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}