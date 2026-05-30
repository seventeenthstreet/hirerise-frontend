/**
 * components/ui/Spinner.tsx — Standardized loading spinner primitive.
 *
 * Replaces all inline `animate-spin` implementations scattered across pages.
 * Use this via <PageLoading /> for full-page states, or directly for inline use.
 *
 * Props:
 *  - size: 'sm' | 'md' | 'lg' (default: 'md')
 *  - label: aria-label for screen readers (default: 'Loading')
 *  - className: additional classes
 */

type SpinnerSize = 'sm' | 'md' | 'lg';

const sizeMap: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-10 w-10 border-4',
};

interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

export function Spinner({
  size = 'md',
  label = 'Loading',
  className = '',
}: SpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-primary border-t-transparent ${sizeMap[size]} ${className}`}
      role="status"
      aria-label={label}
    />
  );
}
