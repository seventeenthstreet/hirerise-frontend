/**
 * (auth)/layout.tsx — Auth Group Root Layout (passthrough)
 *
 * PHASE 1 ROUTE RESTRUCTURING:
 *  Previously, this layout mounted AppShell unconditionally for ALL (auth)/*
 *  routes. That caused the full sidebar + header to render during onboarding
 *  flows (/direction, /onboarding, /career/onboarding, /education/onboarding),
 *  which are pre-app-entry and should not show the protected app chrome.
 *
 * AFTER RESTRUCTURING:
 *  The (auth) group now contains two sub-groups:
 *
 *    (auth)/(app)/         ← Protected app routes: gets AppShell
 *      ├── layout.tsx      ← Mounts AppShell (was: this file)
 *      ├── dashboard/
 *      ├── resume/
 *      └── market-insights/
 *
 *    (auth)/(onboarding)/  ← Pre-app-entry routes: no AppShell
 *      ├── layout.tsx      ← Minimal full-screen container
 *      ├── direction/
 *      ├── onboarding/
 *      ├── career/
 *      └── education/
 *
 *  This file is now a passthrough. It exists to:
 *    1. Retain the (auth) route group as the parent for both sub-groups —
 *       Next.js requires a layout.tsx at each group level that has children.
 *    2. Keep (auth)/loading.tsx in place — that file provides the shared
 *       loading boundary for ALL (auth)/* segments (both app and onboarding),
 *       which is the correct shared behavior during route transitions.
 *
 * WHY NOT DELETE THIS FILE:
 *  Next.js App Router requires each directory that acts as a route group
 *  parent to have a layout. Removing it may break the loading.tsx boundary
 *  and segment loading behavior across (auth)/(app) and (auth)/(onboarding).
 *  Keep this as a passthrough until confirmed unnecessary by Next.js internals.
 *
 * PRESERVED:
 *  ✅ (auth)/loading.tsx continues to serve both sub-groups
 *  ✅ (auth)/(app)/layout.tsx now solely owns AppShell
 *  ✅ (auth)/(onboarding)/layout.tsx owns onboarding chrome
 *  ✅ No provider changes — all providers are at root (app/layout.tsx) level
 */

import type { ReactNode } from 'react';

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  // Pure passthrough — domain isolation is handled by sub-group layouts.
  // (app)/ sub-group mounts AppShell for protected routes.
  // (onboarding)/ sub-group mounts minimal layout for pre-app-entry routes.
  return <>{children}</>;
}