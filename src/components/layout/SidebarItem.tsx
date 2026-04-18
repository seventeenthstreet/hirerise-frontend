'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';

interface SidebarItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  collapsed?: boolean;
  badge?: string | number;
}

export function SidebarItem({ href, label, icon, collapsed, badge }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        isActive
          // Active: soft blue glow background, no heavy border
          ? 'text-white'
          : 'text-white/38 hover:text-white/65',
        collapsed && 'justify-center px-2',
      )}
      style={isActive ? {
        background: 'rgba(61,101,246,0.12)',
        boxShadow: 'inset 0 0 0 1px rgba(61,101,246,0.18)',
      } : undefined}
    >
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center transition-colors',
          isActive ? 'text-hr-400' : 'text-white/28 group-hover:text-white/55',
        )}
      >
        {icon}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge != null && (
            <span className="rounded-full bg-hr-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-hr-400">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}