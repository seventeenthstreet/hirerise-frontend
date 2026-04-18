import { cn } from '@/utils/cn';

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

const badgeVariants = {
  default:  'bg-hr-50 text-hr-700 border-hr-100',
  success:  'bg-green-50 text-green-700 border-green-100',
  warning:  'bg-amber-50 text-amber-700 border-amber-100',
  danger:   'bg-red-50 text-red-600 border-red-100',
  info:     'bg-violet-50 text-violet-700 border-violet-100',
  neutral:  'bg-surface-50 text-surface-500 border-surface-100',
};

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold uppercase tracking-widest',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        badgeVariants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
  xl: 'h-14 w-14 text-base',
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        src ? '' : 'bg-hr-100 text-hr-700',
        avatarSizes[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, badge, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-surface-900">{title}</h2>
          {badge}
        </div>
        {description && (
          <p className="mt-0.5 text-sm text-surface-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
