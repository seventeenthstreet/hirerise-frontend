import type { HTMLAttributes } from 'react';

/**
 * components/ui/Skeleton.tsx — Foundational skeleton loading primitive.
 *
 * Matches existing usage: rounded bg-muted animate-pulse
 *
 * Usage:
 *   <Skeleton className="h-4 w-40" />
 *   <Skeleton className="h-32 w-full rounded-xl" />
 */

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={`animate-pulse rounded bg-muted ${className}`}
    />
  );
}
