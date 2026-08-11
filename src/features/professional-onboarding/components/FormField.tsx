/**
 * @file src/features/professional-onboarding/components/FormField.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Small, accessible form-field primitives for the Guided Builder step forms.
 * No shared `<Input>` primitive exists yet in '@/components/ui' — this file
 * matches the input/label styling already established in
 * `pages/auth/LoginPage.tsx` / `RegisterPage.tsx`
 * (`rounded-md border border-input bg-background px-3 py-2 text-sm
 * focus:outline-none focus:ring-2 focus:ring-primary`) rather than
 * introducing a new visual language.
 *
 * Accessibility:
 *  - Every field has a real, associated <label htmlFor>.
 *  - Validation errors are linked via aria-describedby + role="alert" and
 *    aria-invalid, so screen readers announce them without extra plumbing
 *    in each step form.
 */

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

const FIELD_CLASSES =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50';

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: (describedBy: string | undefined) => ReactNode;
}

function FieldWrapper({ label, htmlFor, error, required, children }: FieldWrapperProps) {
  const errorId = useId();
  const describedBy = error ? errorId : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </label>
      {children(describedBy)}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT INPUT
// ─────────────────────────────────────────────────────────────────────────────

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  required?: boolean;
  id?: string;
}

export function TextField({ label, error, required, id, className = '', ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} required={required}>
      {(describedBy) => (
        <input
          id={fieldId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${FIELD_CLASSES} ${className}`}
          {...props}
        />
      )}
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXTAREA
// ─────────────────────────────────────────────────────────────────────────────

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string;
  required?: boolean;
  id?: string;
}

export function TextAreaField({ label, error, required, id, className = '', ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldWrapper label={label} htmlFor={fieldId} error={error} required={required}>
      {(describedBy) => (
        <textarea
          id={fieldId}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`${FIELD_CLASSES} min-h-[80px] resize-y ${className}`}
          {...props}
        />
      )}
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKBOX
// ─────────────────────────────────────────────────────────────────────────────

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string;
  id?: string;
}

export function CheckboxField({ label, id, className = '', ...props }: CheckboxFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className="flex items-center gap-2">
      <input
        id={fieldId}
        type="checkbox"
        className={`h-4 w-4 rounded border-input text-primary focus:outline-none focus:ring-2 focus:ring-primary ${className}`}
        {...props}
      />
      <label htmlFor={fieldId} className="text-sm text-foreground">
        {label}
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE API ERROR
// ─────────────────────────────────────────────────────────────────────────────

interface ApiErrorBannerProps {
  message: string | null | undefined;
}

/**
 * Server/network error banner for a single step form. Distinct from
 * `OnboardingErrorBanner` in '@/components/onboarding/shell' only in that
 * this one is scoped to sit directly above a form's action row rather than
 * at the top of the whole shell — visually identical styling, reused
 * intentionally rather than re-invented.
 */
export function ApiErrorBanner({ message }: ApiErrorBannerProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
