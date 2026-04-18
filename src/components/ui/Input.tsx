// components/ui/Input.tsx
import { cn } from '@/utils/cn';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string;
  error?:   string;
  hint?:    string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-surface-800">
          {label}
          {props.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={cn(
          'h-9 w-full rounded-lg border bg-white px-3 text-sm text-surface-900 placeholder:text-surface-300',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-hr-500 focus:border-hr-500',
          error
            ? 'border-red-400 focus:ring-red-400'
            : 'border-surface-200 hover:border-surface-300',
          className,
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-surface-400">{hint}</p>}
    </div>
  );
}
