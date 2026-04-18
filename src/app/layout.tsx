// src/app/layout.tsx
// Root layout — wraps ALL routes.
//
// FIX: Imports Providers from './providers' (the canonical migrated version
// that uses the queryClient singleton from lib/queryClient.ts).
//
// Previously imported from '@/components/Providers' — the old Firebase-era
// file that creates a new QueryClient on each render and has stale comments.
//
// Provider order:
//   1. QueryClientProvider  — TanStack Query
//   2. AuthProvider         — Supabase auth state
//   3. Toaster              — react-hot-toast

import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'HireRise — Career Intelligence Platform',
  description: 'Know exactly where your career stands with AI-powered insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}