'use client';

/**
 * components/onboarding/shell/OnboardingContent.tsx
 *
 * The main content area of the onboarding shell.
 *
 * Responsibilities:
 *   - Wraps the active step component
 *   - Provides consistent vertical spacing
 *   - Houses error banners + restore notices (non-layout concerns
 *     that belong between header and step content)
 *
 * Does NOT own:
 *   - Step rendering or orchestration
 *   - Navigation logic
 *   - API interaction
 */

import type { ReactNode } from 'react';

interface OnboardingContentProps {
  children: ReactNode;
  className?: string;
}

export function OnboardingContent({
  children,
  className = '',
}: OnboardingContentProps) {
  return (
    <div className={`w-full ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE ERROR BANNER — normalised error display for onboarding pages
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingErrorBannerProps {
  message: string | null | undefined;
  className?: string;
}

export function OnboardingErrorBanner({
  message,
  className = '',
}: OnboardingErrorBannerProps) {
  if (!message) return null;

  return (
    <div
      className={`mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive ${className}`}
    >
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORED DATA NOTICE
// ─────────────────────────────────────────────────────────────────────────────

interface OnboardingRestoreNoticeProps {
  visible: boolean;
  className?: string;
}

export function OnboardingRestoreNotice({
  visible,
  className = '',
}: OnboardingRestoreNoticeProps) {
  if (!visible) return null;

  return (
    <div
      className={`mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/80 ${className}`}
    >
      ↩ Your progress has been restored. Continue from where you left off.
    </div>
  );
}