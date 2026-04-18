'use client';

// src/app/providers.tsx
// All client-side providers in one place, imported by the root layout.
// Keeps the root layout a Server Component.
//
// This is the CANONICAL providers file. src/components/Providers.tsx is
// the old pre-migration version and should be deleted.
//
// Provider order:
//   1. QueryClientProvider  — TanStack Query, must wrap everything that uses hooks
//   2. AuthProvider         — Supabase auth state
//   3. Toaster              — react-hot-toast, no upstream deps

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/features/auth/components/AuthProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontSize: '14px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgb(0 0 0 / 0.10)',
            },
            success: { iconTheme: { primary: '#3d65f6', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}