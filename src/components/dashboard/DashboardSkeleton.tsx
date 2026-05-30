/**
 * components/dashboard/DashboardSkeleton.tsx
 *
 * Full-page loading skeleton shown while the dashboard's primary data loads.
 * Uses the same grid layout as the dashboard page so the layout shift is minimal.
 */

import React from 'react';

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-6 shadow-sm animate-pulse ${className}`}>
      <div className="h-4 w-40 rounded bg-muted mb-4" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 animate-pulse">
          <div className="h-7 w-56 rounded bg-muted mb-2" />
          <div className="h-4 w-40 rounded bg-muted" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SkeletonCard className="lg:col-span-2 h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="lg:col-span-2 h-40" />
          <SkeletonCard className="h-40" />
          <SkeletonCard className="lg:col-span-3 h-36" />
        </div>
      </div>
    </div>
  );
}