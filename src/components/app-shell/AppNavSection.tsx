

/**
 * components/app-shell/AppNavSection.tsx
 *
 * Groups related nav items under an optional section heading.
 * Used for: "Core", "Tools", "Settings" groupings in the sidebar.
 *
 * Lightweight — no collapse/expand state yet. That is a future Phase D concern.
 */

import type { ReactNode } from 'react';

interface AppNavSectionProps {
  /** Optional heading label shown above the items. */
  label?: string;
  children: ReactNode;
  className?: string;
}

export function AppNavSection({ label, children, className = '' }: AppNavSectionProps) {
  return (
    <div className={`space-y-0.5 ${className}`}>
      {label && (
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}