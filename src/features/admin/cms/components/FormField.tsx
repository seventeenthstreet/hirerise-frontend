'use client';

// features/admin/cms/components/FormField.tsx
// Thin wrapper for consistent modal form field spacing.

interface FormFieldProps {
  label:     string;
  required?: boolean;
  error?:    string;
  children:  React.ReactNode;
}

export function FormField({ label, required, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-surface-800">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Textarea with same styling as Input
export function Textarea({
  value, onChange, placeholder, rows = 3, error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={[
        'w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-surface-900 placeholder:text-surface-300',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-hr-500 focus:border-hr-500',
        error ? 'border-red-400' : 'border-surface-200 hover:border-surface-300',
      ].join(' ')}
    />
  );
}