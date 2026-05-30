import type { ReactNode, HTMLAttributes } from 'react';

/**
 * components/ui/Card.tsx — Foundational card primitive.
 *
 * Matches the existing card styling used throughout HireRise:
 *   rounded-xl border border-border bg-card p-6 shadow-sm
 *
 * Sub-components:
 *  - Card: container
 *  - CardHeader: top section (title + optional description)
 *  - CardContent: main content area
 *  - CardFooter: bottom section (actions, meta)
 *
 * Intentionally no over-abstraction — these are structural wrappers only.
 */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-xl border border-border bg-card shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }: CardProps) {
  return (
    <div {...props} className={`p-6 pb-0 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = '', ...props }: CardProps) {
  return (
    <div {...props} className={`p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }: CardProps) {
  return (
    <div {...props} className={`p-6 pt-0 ${className}`}>
      {children}
    </div>
  );
}
