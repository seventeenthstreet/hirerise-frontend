// components/ui/Select.tsx
import { cn } from '@/utils/cn';
import type { SelectHTMLAttributes } from 'react';

interface SelectOption { value: string; label: string; }

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?:   string;
  error?:   string;
  options:  SelectOption[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className, id, ...props }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-surface-800">
          {label}
          {props.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <select
        id={selectId}
        {...props}
        className={cn(
          'h-9 w-full rounded-lg border bg-white px-3 text-sm text-surface-900',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-hr-500 focus:border-hr-500',
          'appearance-none cursor-pointer',
          error
            ? 'border-red-400 focus:ring-red-400'
            : 'border-surface-200 hover:border-surface-300',
          className,
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
