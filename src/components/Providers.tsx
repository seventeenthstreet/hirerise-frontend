'use client';

// src/components/Providers.tsx
// Single place to assemble ALL app-wide React context providers.
// Adding a new provider? Add it here — never scatter them across layouts.
//
// Order matters:
//   1. QueryClientProvider  — TanStack Query, must wrap everything that uses hooks
//   2. AuthProvider         — Firebase auth state, uses Query internally
//   3. ToastProvider        — react-hot-toast Toaster, no upstream deps

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/components/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  // Create the QueryClient inside useState so it's stable across renders
  // but not shared between server and client (avoids SSR cache leaking).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:          60 * 1000,   // 1 min — avoid refetching on every focus
            retry:              1,           // one retry on failure
            refetchOnWindowFocus: false,     // less noisy for a dashboard app
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        {/* Toast Toaster rendered inside body, outside page content */}
        <ToastProvider />
      </AuthProvider>
    </QueryClientProvider>
  );
}