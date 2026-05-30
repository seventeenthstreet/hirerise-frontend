import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * components/ui/Button.tsx — Foundational button primitive.
 *
 * Intentionally lightweight — covers the core variants used across HireRise.
 * Does NOT attempt to cover every edge case. Extend as needed.
 *
 * Variants:
 *  - primary (default): filled primary bg
 *  - secondary: muted bg
 *  - outline: bordered, transparent bg
 *  - ghost: no bg, hover only
 *  - destructive: destructive bg for dangerous actions
 *
 * Sizes:
 *  - sm, md (default), lg
 */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:     'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary:   'bg-muted text-foreground hover:bg-muted/80',
  outline:     'border border-border bg-transparent text-foreground hover:bg-muted',
  ghost:       'bg-transparent text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors focus-visible:outline focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-busy={isLoading}
    >
      {isLoading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
