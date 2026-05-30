

/**
 * components/onboarding/steps/StepLayout.tsx
 *
 * Reusable onboarding step layout primitives.
 *
 * Extracted from the duplicated layout patterns in:
 *   - career/onboarding/page.tsx (StepWrapper)
 *   - Future step components
 *
 * These primitives prevent:
 *   - Duplicated step layout code
 *   - Duplicated spacing systems
 *   - Duplicated action-row patterns
 *
 * They are lightweight and composable — not abstract config-driven components.
 * Each can be used independently.
 *
 * USAGE:
 *   <StepContainer>
 *     <StepTitle>Your professional background</StepTitle>
 *     <StepDescription>Tell us where you are today.</StepDescription>
 *     <StepSection>
 *       <input ... />
 *     </StepSection>
 *     <StepActions>
 *       <button>Continue</button>
 *     </StepActions>
 *   </StepContainer>
 */

import type { ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// STEP CONTAINER
// Root wrapper for a single step's content.
// ─────────────────────────────────────────────────────────────────────────────

interface StepContainerProps {
  children: ReactNode;
  /** Optional max-width constraint. Default: 'max-w-[560px]' */
  maxWidth?: string;
  className?: string;
}

export function StepContainer({
  children,
  maxWidth = 'max-w-[560px]',
  className = '',
}: StepContainerProps) {
  return (
    <div className={`${maxWidth} ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP TITLE
// ─────────────────────────────────────────────────────────────────────────────

interface StepTitleProps {
  children: ReactNode;
  /** Optional monospace step label above the title (e.g. "Step 01") */
  stepLabel?: string;
  className?: string;
}

export function StepTitle({ children, stepLabel, className = '' }: StepTitleProps) {
  return (
    <div className={`mb-6 ${className}`}>
      {stepLabel && (
        <span className="block text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
          {stepLabel}
        </span>
      )}
      <h2 className="text-2xl font-light leading-tight text-foreground">
        {children}
      </h2>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP DESCRIPTION
// ─────────────────────────────────────────────────────────────────────────────

interface StepDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function StepDescription({ children, className = '' }: StepDescriptionProps) {
  return (
    <p className={`mb-6 text-sm leading-relaxed text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP SECTION
// Groups related form fields or content within a step.
// ─────────────────────────────────────────────────────────────────────────────

interface StepSectionProps {
  children: ReactNode;
  /** Optional section heading */
  heading?: string;
  className?: string;
}

export function StepSection({ children, heading, className = '' }: StepSectionProps) {
  return (
    <div className={`mb-6 ${className}`}>
      {heading && (
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {heading}
        </p>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP ACTIONS
// Bottom action row (primary button + optional secondary).
// ─────────────────────────────────────────────────────────────────────────────

interface StepActionsProps {
  children: ReactNode;
  /** 'left' | 'right' | 'full-width'. Default: 'left' */
  align?: 'left' | 'right' | 'full-width';
  className?: string;
}

export function StepActions({
  children,
  align = 'left',
  className = '',
}: StepActionsProps) {
  const alignClass =
    align === 'right'
      ? 'flex justify-end'
      : align === 'full-width'
      ? 'flex flex-col'
      : 'flex justify-start';

  return (
    <div className={`mt-8 ${alignClass} gap-3 ${className}`}>
      {children}
    </div>
  );
}