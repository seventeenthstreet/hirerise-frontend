/**
 * (auth)/loading.tsx — Shared auth-scoped loading boundary.
 *
 * Next.js App Router automatically renders this file during:
 *  - Route segment transitions within (auth)
 *  - Suspense boundaries triggered by async Server Components
 *
 * Uses shared primitives: PageLoading → Spinner + PageShell.
 * Replaces the inline animate-spin divs scattered across auth pages.
 *
 * NOTE: This does NOT replace the per-page hydration guards in useAppContext().
 * Those guards handle client-side auth state — this handles the Next.js
 * route-level loading boundary, which is a separate concern.
 */
import { PageLoading } from '@/components/ui/PageLoading';

export default function AuthLoading() {
  return <PageLoading label="Loading…" />;
}
