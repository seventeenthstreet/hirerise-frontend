/**
 * src/layouts/AuthLayout.tsx
 *
 * Auth pages shell — Vite-native
 *
 * Applied to all /auth/* routes (login, register, forgot-password, callback).
 * No sidebar, no nav chrome. GuestGuard (in routes/index.tsx) handles
 * redirect-if-authenticated before this layout renders.
 */

import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
