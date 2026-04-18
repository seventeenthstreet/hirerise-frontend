import { cn } from '@/utils/cn';
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, disabled, ...props },
    ref,
  ) {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-hr-600 text-white shadow-sm hover:bg-hr-700 active:bg-hr-800 focus-visible:ring-hr-500',
      secondary:
        'bg-surface-100 text-surface-800 hover:bg-surface-200 active:bg-surface-300 focus-visible:ring-surface-400',
      ghost:
        'text-surface-600 hover:bg-surface-100 hover:text-surface-900 active:bg-surface-200 focus-visible:ring-surface-400',
      danger:
        'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500',
      outline:
        'border border-surface-200 bg-white text-surface-700 hover:bg-surface-50 active:bg-surface-100 focus-visible:ring-surface-400',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-9 px-4 text-sm',
      lg: 'h-11 px-6 text-sm',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : leftIcon ? (
          <span className="h-4 w-4 shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !loading && (
          <span className="h-4 w-4 shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  },
);
