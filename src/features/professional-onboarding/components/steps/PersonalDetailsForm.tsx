/**
 * @file src/features/professional-onboarding/components/steps/PersonalDetailsForm.tsx
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Personal Details step (`guided_personal_details` → `POST /guided/personal_details`).
 * Field set matches `normalizePersonalInformation`
 * (core/src/domain/professionalProfile/professionalProfile.normalizer.js) —
 * fullName, email, phone, currentCity, currentJobTitle, currentCompany,
 * workAuthorization. Client-side validation only checks the three fields
 * the backend treats as the practical minimum for a usable profile
 * (fullName, email, phone); the backend's normalizer remains authoritative
 * for anything beyond "is this field present/well-formed enough to submit".
 *
 * Implements the shared `OnboardingStepProps` contract from
 * '@/components/onboarding/steps/types' — reused, not redefined.
 */

import { useState, type FormEvent } from 'react';

import type { OnboardingStepProps } from '@/components/onboarding/steps/types';
import { StepContainer, StepTitle, StepDescription, StepActions } from '@/components/onboarding/steps';
import { Button } from '@/components/ui';

import { TextField, ApiErrorBanner } from '../FormField';
import { getGuidedBuilderErrorMessage } from '../../utils/error-message';

interface PersonalDetailsValues {
  fullName: string;
  email: string;
  phone: string;
  currentCity: string;
  currentJobTitle: string;
  currentCompany: string;
  workAuthorization: string;
}

function readInitialValues(initialData: Record<string, unknown> | undefined): PersonalDetailsValues {
  const pi = (initialData?.personalInformation ?? {}) as Partial<Record<keyof PersonalDetailsValues, string>>;
  return {
    fullName: pi.fullName ?? '',
    email: pi.email ?? '',
    phone: pi.phone ?? '',
    currentCity: pi.currentCity ?? '',
    currentJobTitle: pi.currentJobTitle ?? '',
    currentCompany: pi.currentCompany ?? '',
    workAuthorization: pi.workAuthorization ?? '',
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PersonalDetailsForm({ onComplete, isBusy, initialData }: OnboardingStepProps) {
  const [values, setValues] = useState<PersonalDetailsValues>(() => readInitialValues(initialData));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof PersonalDetailsValues, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  function setField<K extends keyof PersonalDetailsValues>(key: K, value: PersonalDetailsValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof PersonalDetailsValues, string>> = {};
    if (!values.fullName.trim()) errors.fullName = 'Enter your full name.';
    if (!values.email.trim()) {
      errors.email = 'Enter your email address.';
    } else if (!EMAIL_PATTERN.test(values.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!values.phone.trim()) errors.phone = 'Enter your phone number.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    if (!validate()) return;

    setApiError(null);
    try {
      await onComplete({ ...values });
    } catch (error) {
      setApiError(getGuidedBuilderErrorMessage(error));
    }
  }

  return (
    <StepContainer>
      <StepTitle>Personal details</StepTitle>
      <StepDescription>Let&apos;s start with the basics — your name and how employers can reach you.</StepDescription>

      <form onSubmit={handleSubmit} noValidate aria-busy={isBusy}>
        <div className="space-y-4">
          <TextField
            label="Full name"
            required
            autoComplete="name"
            value={values.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            error={fieldErrors.fullName}
            disabled={isBusy}
          />
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={values.email}
            onChange={(e) => setField('email', e.target.value)}
            error={fieldErrors.email}
            disabled={isBusy}
          />
          <TextField
            label="Phone"
            type="tel"
            required
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => setField('phone', e.target.value)}
            error={fieldErrors.phone}
            disabled={isBusy}
          />
          <TextField
            label="Current city"
            autoComplete="address-level2"
            value={values.currentCity}
            onChange={(e) => setField('currentCity', e.target.value)}
            disabled={isBusy}
          />
          <TextField
            label="Current job title"
            value={values.currentJobTitle}
            onChange={(e) => setField('currentJobTitle', e.target.value)}
            disabled={isBusy}
          />
          <TextField
            label="Current company"
            value={values.currentCompany}
            onChange={(e) => setField('currentCompany', e.target.value)}
            disabled={isBusy}
          />
          <TextField
            label="Work authorization"
            placeholder="e.g. Citizen, Permanent Resident, Visa Required"
            value={values.workAuthorization}
            onChange={(e) => setField('workAuthorization', e.target.value)}
            disabled={isBusy}
          />
        </div>

        {apiError && (
          <div className="mt-6">
            <ApiErrorBanner message={apiError} />
          </div>
        )}

        <StepActions>
          <Button type="submit" isLoading={isBusy}>
            Continue
          </Button>
        </StepActions>
      </form>
    </StepContainer>
  );
}
