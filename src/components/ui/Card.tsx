import { cn } from '@/utils/cn';
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'bordered' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ className, variant = 'default', padding = 'md', ...props }: CardProps) {
  const variants = {
    default: 'bg-white border border-surface-100 shadow-card',
    elevated: 'bg-white border border-surface-100 shadow-card-md',
    bordered: 'bg-white border border-surface-200',
    ghost: 'bg-surface-50',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div
      className={cn('rounded-xl', variants[variant], paddings[padding], className)}
      {...props}
    />
  );
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function StatCard({ label, value, sub, icon, iconBg, trend, className }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white p-5 shadow-card', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-surface-400 truncate">{label}</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-surface-900 truncate">{value}</p>
          {sub && <p className="mt-0.5 text-[11px] text-surface-400 truncate">{sub}</p>}
          {trend && (
            <p className={cn('mt-1 text-[11px] font-medium', trend.positive ? 'text-green-600' : 'text-red-500')}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', iconBg ?? 'bg-surface-50')}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CardSkeleton ─────────────────────────────────────────────────────────────
// Used by dashboard/page.tsx while career health data loads

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-surface-100 bg-white p-5 shadow-card animate-pulse', className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="h-3 w-24 rounded bg-surface-100" />
        <div className="h-7 w-7 rounded-xl bg-surface-100" />
      </div>
      <div className="h-6 w-16 rounded bg-surface-100 mb-2" />
      <div className="h-3 w-32 rounded bg-surface-100" />
    </div>
  );
}

// ─── IntelCard ────────────────────────────────────────────────────────────────
// Career intelligence card used on the dashboard

interface IntelCardProps {
  title: string;
  value: React.ReactNode;
  description?: string;
  accentColor?: string;
  iconBg?: string;
  icon?: React.ReactNode;
  locked?: boolean;
  badge?: string;
  cta?: React.ReactNode;
  className?: string;
}

export function IntelCard({
  title, value, description, accentColor, iconBg, icon, locked, badge, cta, className,
}: IntelCardProps) {
  return (
    <div className={cn(
      'relative flex flex-col rounded-xl border border-surface-100 bg-white p-5 shadow-card overflow-hidden',
      locked && 'opacity-70',
      className,
    )}>
      {/* Accent bar */}
      {accentColor && (
        <div className={cn('absolute left-0 top-0 h-1 w-full rounded-t-xl', accentColor)} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mt-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">{title}</p>
        {icon && (
          <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', iconBg ?? 'bg-surface-50')}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mt-3 text-2xl font-bold tracking-tight text-surface-900">
        {value}
      </div>

      {/* Description */}
      {description && (
        <p className="mt-1.5 flex-1 text-xs leading-relaxed text-surface-400">{description}</p>
      )}

      {/* Badge */}
      {badge && (
        <span className="mt-2 self-start rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
          {badge}
        </span>
      )}

      {/* CTA */}
      {cta && <div className="mt-4">{cta}</div>}

      {/* Lock overlay */}
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-[1px]">
          <svg className="h-5 w-5 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      )}
    </div>
  );
}