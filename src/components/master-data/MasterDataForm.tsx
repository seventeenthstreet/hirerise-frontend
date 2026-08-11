/**
 * components/master-data/MasterDataForm.tsx
 *
 * Configuration-driven form. Skills (and future Roles/Career
 * Domains/Skill Clusters) pass a `fields: MasterDataFieldConfig[]` array;
 * this component owns rendering, labelling, and field-level error display.
 * It does NOT own submission — the caller wires onSubmit and owns the
 * mutation, since save semantics (create vs. update) differ per caller.
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui';
import type { MasterDataFieldConfig, MasterDataFieldErrors } from './types';

interface MasterDataFormProps<TValues extends Record<string, unknown>> {
  fields: MasterDataFieldConfig<TValues>[];
  initialValues: TValues;
  fieldErrors?: MasterDataFieldErrors;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (values: TValues) => void;
  onCancel: () => void;
}

export function MasterDataForm<TValues extends Record<string, unknown>>({
  fields,
  initialValues,
  fieldErrors = {},
  isSubmitting = false,
  submitLabel,
  onSubmit,
  onCancel,
}: MasterDataFormProps<TValues>) {
  const [values, setValues] = useState<TValues>(initialValues);

  const setField = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Duplicate-submission protection: caller disables the submit button via
    // isSubmitting, but guard here too in case the event still fires.
    if (isSubmitting) return;
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {fields.map((field) => {
        const fieldId = `mdf-${field.name}`;
        const error = fieldErrors[field.name];
        const rawValue = values[field.name];

        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
              {field.label}
              {field.required && <span className="text-destructive"> *</span>}
            </label>

            {field.type === 'textarea' && (
              <textarea
                id={fieldId}
                value={(rawValue as string) ?? ''}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                required={field.required}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                onChange={(e) => setField(field.name, e.target.value)}
                rows={4}
                className={inputClassName(Boolean(error), true)}
              />
            )}

            {field.type === 'select' && (
              <select
                id={fieldId}
                value={(rawValue as string) ?? ''}
                required={field.required}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                onChange={(e) => setField(field.name, e.target.value)}
                className={inputClassName(Boolean(error))}
              >
                <option value="" disabled>
                  Select {field.label.toLowerCase()}
                </option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'tags' && (
              <input
                id={fieldId}
                type="text"
                value={Array.isArray(rawValue) ? (rawValue as string[]).join(', ') : ''}
                placeholder={field.placeholder ?? 'Comma-separated'}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${fieldId}-error` : `${fieldId}-help`}
                onChange={(e) =>
                  setField(
                    field.name,
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                className={inputClassName(Boolean(error))}
              />
            )}

            {field.type === 'number' && (
              <input
                id={fieldId}
                type="number"
                value={(rawValue as number | undefined) ?? ''}
                min={field.min}
                max={field.max}
                required={field.required}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                onChange={(e) => setField(field.name, e.target.value === '' ? undefined : Number(e.target.value))}
                className={inputClassName(Boolean(error))}
              />
            )}

            {field.type === 'text' && (
              <input
                id={fieldId}
                type="text"
                value={(rawValue as string) ?? ''}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                required={field.required}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                onChange={(e) => setField(field.name, e.target.value)}
                className={inputClassName(Boolean(error))}
              />
            )}

            {field.helpText && !error && (
              <p id={`${fieldId}-help`} className="text-xs text-muted-foreground">
                {field.helpText}
              </p>
            )}
            {error && (
              <p id={`${fieldId}-error`} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="md" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function inputClassName(hasError: boolean, multiline = false): string {
  return [
    multiline ? 'w-full py-2' : 'h-10 w-full',
    'rounded-lg border bg-background px-3 text-sm text-foreground',
    'placeholder:text-muted-foreground',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    hasError ? 'border-destructive' : 'border-border',
  ].join(' ');
}
