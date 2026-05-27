import type { ReactNode } from 'react';

/**
 * (public)/layout.tsx — Lightweight shell for unauthenticated pages.
 *
 * Wraps login, signup, and register routes.
 * No sidebar, no nav chrome — just a centered auth-page container.
 *
 * The root layout (app/layout.tsx) still provides:
 *  - QueryProvider
 *  - AppProvider
 *  - ErrorBoundary
 *
 * This layout adds no additional providers — it is purely structural.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
