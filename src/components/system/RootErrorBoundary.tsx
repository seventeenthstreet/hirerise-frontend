

/**
 * @file src/components/system/RootErrorBoundary.tsx
 * @description Client-side root crash boundary for the app shell.
 *
 * WHY THIS FILE EXISTS:
 *  layout.tsx is a Server Component (no 'use client'). In Next.js App Router,
 *  a server layout cannot directly render a 'use client' class component
 *  (ErrorBoundary) as a wrapper around its children — doing so prevents the
 *  bundler from cleanly splitting the server chunk from the client chunk,
 *  producing a malformed app/layout.js that the browser times out loading.
 *
 *  The fix is to extract the ErrorBoundary + AppCrashFallback pairing into
 *  this dedicated 'use client' wrapper. layout.tsx renders <RootErrorBoundary>
 *  as an opaque client leaf — Next.js can then correctly emit the server chunk
 *  and the client chunk independently, and the browser loads both successfully.
 *
 * USAGE (in src/app/layout.tsx):
 *
 *   import { RootErrorBoundary } from '@/components/system/RootErrorBoundary';
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html lang="en">
 *         <body>
 *           <RootErrorBoundary>
 *             <QueryProvider>
 *               <AppProvider>
 *                 {children}
 *               </AppProvider>
 *             </QueryProvider>
 *           </RootErrorBoundary>
 *         </body>
 *       </html>
 *     );
 *   }
 *
 * ARCHITECTURE POSITION: System layer — outermost client crash guard.
 *   Server layout → [RootErrorBoundary] → QueryProvider → AppProvider → Pages
 */

import type { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AppCrashFallback } from './fallbacks/AppCrashFallback';

interface RootErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Wraps the entire client app tree in an ErrorBoundary with AppCrashFallback.
 *
 * Renders as a transparent pass-through when no error has occurred.
 * On crash: replaces the entire viewport with AppCrashFallback, which gives
 * the user a Reload and Try Again action.
 *
 * ErrorBoundary injects onReset, error, isChunkError, and errorId into
 * AppCrashFallback automatically via React.cloneElement — no manual wiring needed.
 */
export function RootErrorBoundary({ children }: RootErrorBoundaryProps) {
  return (
    <ErrorBoundary
      context="RootLayout"
      fallback={<AppCrashFallback />}
    >
      {children}
    </ErrorBoundary>
  );
}