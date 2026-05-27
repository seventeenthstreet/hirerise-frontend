'use client';

/**
 * components/onboarding/shell/OnboardingHeader.tsx
 *
 * Onboarding page header primitive.
 *
 * Extracted from the duplicated header patterns in:
 *   - /onboarding/page.tsx (centered h1 + subtitle)
 *   - career/onboarding/page.tsx (left-rail wordmark + title block)
 *
 * Responsibilities:
 *   - Render onboarding page/flow title
 *   - Render optional subtitle/description
 *   - Apply consistent typography and spacing
 *
 * Does NOT own:
 *   - Variant detection
 *   - Navigation
 *   - Step state
 */

interface OnboardingHeaderProps {
  title: string;
  description?: string;
  /** 'center' (default) or 'left' */
  align?: 'center' | 'left';
  className?: string;
}

export function OnboardingHeader({
  title,
  description,
  align = 'center',
  className = '',
}: OnboardingHeaderProps) {
  const textAlign = align === 'center' ? 'text-center' : 'text-left';

  return (
    <header className={`mb-8 ${textAlign} ${className}`}>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      )}
    </header>
  );
}