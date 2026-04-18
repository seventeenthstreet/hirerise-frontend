'use client';
// components/layout/AdminTopbar.tsx
import { useAuth } from '@/features/auth/components/AuthProvider';
import { Button } from '@/components/ui/Button';

interface AdminTopbarProps {
  title: string;
}

export function AdminTopbar({ title }: AdminTopbarProps) {
  const { user, signOut } = useAuth();

  // Use || instead of ?? so empty strings ("") also fall through to the
  // next value. ?? only falls back on null/undefined — an empty string
  // from displayName or email would cause [0] to return undefined and
  // crash .toUpperCase().
  const displayLabel = user?.displayName || user?.email || 'Admin';
  const avatarLetter = displayLabel[0].toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-100 bg-white px-6">
      <h1 className="text-sm font-semibold text-surface-900">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs font-medium text-surface-800">{displayLabel}</p>
          <p className="text-[10px] text-surface-400">Administrator</p>
        </div>
        <div className="h-7 w-7 rounded-full bg-hr-100 flex items-center justify-center">
          <span className="text-xs font-semibold text-hr-700">
            {avatarLetter}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </header>
  );
}