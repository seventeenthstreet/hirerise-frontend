'use client';

/**
 * @file src/components/system/index.ts
 * @description Barrel export for the system stability layer.
 *
 * 'use client' is required here because every module re-exported from this
 * barrel is itself a 'use client' component. Without this directive, Next.js
 * cannot correctly attribute these exports as client modules when the barrel
 * is imported from a server component, contributing to bundle split failures.
 *
 * Import from '@/components/system' — never from individual files.
 * Exception: RootErrorBoundary is imported directly in layout.tsx to make
 * the RSC boundary explicit and avoid barrel-import ambiguity at the root.
 */

export { ErrorBoundary }             from './ErrorBoundary';
export type { FallbackInjectedProps } from './ErrorBoundary';

export { RootErrorBoundary }         from './RootErrorBoundary';

export { AppCrashFallback }          from './fallbacks/AppCrashFallback';
export { WidgetErrorFallback }       from './fallbacks/WidgetErrorFallback';
export { SectionErrorFallback }      from './fallbacks/SectionErrorFallback';
export { ObservabilityProvider }     from './ObservabilityProvider';