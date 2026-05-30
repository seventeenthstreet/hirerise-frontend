

/**
 * @file front/src/modules/student-onboarding/cognitive/components/ScenarioCard.tsx
 *
 * SCENARIO CARD — Core interactive unit for the cognitive step.
 *
 * Renders one cognitive question as a scenario card with selectable
 * option buttons. Supports both single-select and multi-select modes.
 *
 * DESIGN PRINCIPLES:
 *   • Low cognitive load — one scenario at a time
 *   • No psychometric language
 *   • Clear selection state via visual affordance
 *   • Mobile-first — touch-friendly tap targets (min 44px)
 *
 * PROPS:
 *   question        — the question to render
 *   selectedKeys    — currently selected option_key values
 *   onSelect        — called with updated selection after each tap
 *   isSaving        — true while a save mutation is in flight
 *   isRequired      — controls the required badge visibility
 */

import type { CognitiveOption, CognitiveQuestion } from '../types';

interface ScenarioCardProps {
  readonly question:     CognitiveQuestion;
  readonly selectedKeys: string[];
  readonly onSelect:     (questionId: string, selectedKeys: string[]) => void;
  readonly isSaving?:   boolean;
}

export default function ScenarioCard({
  question,
  selectedKeys,
  onSelect,
  isSaving = false,
}: ScenarioCardProps) {
  function handleOptionClick(optionKey: string) {
    if (isSaving) return;

    if (question.allowsMulti) {
      // Toggle: add or remove from selection
      const next = selectedKeys.includes(optionKey)
        ? selectedKeys.filter((k) => k !== optionKey)
        : [...selectedKeys, optionKey];
      onSelect(question.id, next);
    } else {
      // Single-select: replace entirely
      onSelect(question.id, [optionKey]);
    }
  }

  const isAnswered = selectedKeys.length > 0;

  return (
    <div
      className={[
        'rounded-xl border bg-card transition-shadow',
        isAnswered ? 'border-primary/20 shadow-sm' : 'border-border',
      ].join(' ')}
    >
      {/* Question header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {question.questionText}
          </p>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {question.isRequired && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Required
              </span>
            )}
            {question.allowsMulti && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Choose all that apply
              </span>
            )}
          </div>
        </div>

        {question.hintText && (
          <p className="mt-1.5 text-xs text-muted-foreground">{question.hintText}</p>
        )}
      </div>

      {/* Options */}
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {question.options.map((option) => {
          const isSelected = selectedKeys.includes(option.optionKey);
          return (
            <OptionButton
              key={option.optionKey}
              option={option}
              isSelected={isSelected}
              isSaving={isSaving}
              onClick={() => handleOptionClick(option.optionKey)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OptionButton
// ─────────────────────────────────────────────────────────────────────────────

interface OptionButtonProps {
  readonly option:     CognitiveOption;
  readonly isSelected: boolean;
  readonly isSaving:   boolean;
  readonly onClick:    () => void;
}

function OptionButton({ option, isSelected, isSaving, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      aria-pressed={isSelected}
      className={[
        'relative min-h-[44px] rounded-lg border px-4 py-3 text-left text-sm',
        'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-primary focus-visible:ring-offset-1',
        isSelected
          ? 'border-primary bg-primary/8 text-foreground shadow-sm'
          : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
        isSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ].join(' ')}
    >
      {/* Selection indicator */}
      <span
        className={[
          'absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background',
        ].join(' ')}
        aria-hidden="true"
      >
        {isSelected && '✓'}
      </span>

      <span className="pr-6 font-medium leading-snug">{option.optionText}</span>
    </button>
  );
}
