/**
 * src/layouts/PublicLayout.tsx
 *
 * Lightweight shell for unauthenticated public pages — Vite-native
 *
 * Wraps login, register, landing, and other public routes.
 * No sidebar, no nav chrome — just a centered full-screen container.
 *
 * All providers (QueryProvider, AppProvider, ErrorBoundary) are at root
 * level in AppProviders. This layout adds no additional providers.
 */

import type { ReactNode } from 'react';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
