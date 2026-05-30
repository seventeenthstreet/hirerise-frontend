import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // Next.js core + TypeScript rules
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    rules: {
      // Catch silent `any` leaks — use `unknown` or explicit types instead
      '@typescript-eslint/no-explicit-any': 'warn',

      // Enforce alias imports — no deep relative paths like ../../../
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*/*/*'],
              message: 'Use @/ path aliases instead of deep relative imports.',
            },
          ],
        },
      ],

      // Disallow bare console.log in production paths
      // (structured logging via observability layer is the standard)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FEATURE BOUNDARY ENFORCEMENT
  // ─────────────────────────────────────────────────────────────────────────
  //
  // These rules enforce the ownership model established in Phase 2–4.
  // The goal is ownership boundary enforcement, NOT infrastructure isolation.
  //
  // ALLOWED everywhere (shared infrastructure):
  //   @/context/AppContext
  //   @/lib/query          (queryClient, queryKeys, shouldRetry, retryDelay)
  //   @/lib/api            (transport, parser, client)
  //   @/lib/analytics      (event names, funnel contract, page names)
  //   @/lib/monitoring     (captureError, startTimer)
  //   @/hooks/useUser
  //   @/hooks/useAnalytics
  //
  // ENFORCED: feature internals don't leak into unrelated domains.
  // ─────────────────────────────────────────────────────────────────────────

  {
    // RULE 1: Protected app shell cannot import onboarding internals.
    //
    // WHY: The app shell (dashboard, reports, profile) has no legitimate
    // dependency on onboarding implementation details. If an app-shell
    // component needs to know onboarding status, it reads from AppContext
    // (user.onboarding_completed) or calls a public hook — not from internals.
    //
    // PERMITTED: The onboarding route pages (app/(auth)/onboarding/*) are
    // excluded from this rule — they are the primary consumers and their
    // imports are intentional and visible.
    //
    // ALLOWED sub-paths for app shell (if ever genuinely needed):
    //   @/features/onboarding/queries/queryKeys (for cache key access in
    //   shared cache management utilities — very rare, document if used)
    files: [
      'src/app/(auth)/(app)/**',
      'src/components/dashboard/**',
      'src/components/reports/**',
      'src/components/profile/**',
      'src/components/resume/**',
      'src/components/career/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Sub-path imports from onboarding internals are blocked.
              // Top-level @/features/onboarding import (the public index) is allowed.
              group: [
                '@/features/onboarding/state/**',
                '@/features/onboarding/orchestration/**',
                '@/features/onboarding/queries/**',
              ],
              message:
                'App shell cannot import onboarding sub-modules directly. ' +
                'Use the public API via @/features/onboarding or read status from AppContext.',
            },
          ],
        },
      ],
    },
  },

  {
    // RULE 2: Onboarding feature cannot import from sibling feature domains
    // or from dashboard/metrics/career-health business logic.
    //
    // WHY: Onboarding's only legitimate dependencies on other domains are:
    //   - Reading user state (AppContext, useUser) — allowed
    //   - Invalidating metric caches (via queryKeys.metrics.*) — allowed
    //   - Navigating to post-onboarding destinations (useRouter) — allowed
    // Onboarding must never READ from dashboard, metrics hooks, or CHI hooks.
    // Invalidation (write) is sufficient coupling — adding read coupling would
    // make onboarding a dependent of every domain it invalidates.
    files: [
      'src/features/onboarding/**',
      'src/hooks/onboarding/**',
      'src/hooks/useOnboarding.ts',
      'src/hooks/mutations/useSubmitOnboardingStep.ts',
      'src/hooks/mutations/useResetDirection.ts',
      'src/hooks/mutations/useSetDirection.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/hooks/useDashboard',
                '@/hooks/useMetrics',
                '@/hooks/useCareerHealth',
                '@/hooks/useSkillsPriority',
                '@/hooks/useOpportunities',
              ],
              message:
                'Onboarding must not import from other feature hooks. ' +
                'Cache invalidation via queryKeys is sufficient coupling — no read dependency needed.',
            },
            {
              group: [
                '@/components/dashboard/**',
                '@/components/reports/**',
                '@/components/career/health/**',
              ],
              message:
                'Onboarding must not import UI components from other feature domains.',
            },
          ],
        },
      ],
    },
  },

  {
    // RULE 3: Shared hooks layer cannot import from feature sub-modules.
    //
    // WHY: Hooks in src/hooks/ are second-tier infrastructure — they sit between
    // the API layer and the UI layer. If they import from feature sub-modules,
    // the dependency graph gains a cycle: features depend on hooks AND hooks
    // depend on features. The correct direction is one-way: features depend on
    // hooks, hooks depend only on lib/ and context/.
    //
    // Exception: hooks/onboarding/* may import from features/onboarding/queries
    // (key factory) since that is feature-owned infrastructure, not UI.
    files: [
      'src/hooks/*.ts',
      'src/hooks/*.tsx',
      'src/hooks/mutations/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/features/onboarding/state/**',
                '@/features/onboarding/orchestration/**',
              ],
              message:
                'Shared hooks cannot import from feature state or orchestration modules. ' +
                'Feature modules depend on hooks — not the reverse.',
            },
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LAYER DIRECTION RULES  (Phase 2)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Enforces the dependency direction: lib → hooks → features → pages.
  // Components sit alongside the stack and consume hooks/props only.
  // These rules are additive — they complement the feature boundary rules above.
  // ─────────────────────────────────────────────────────────────────────────

  {
    // RULE 4: Hooks must not import pages or UI components.
    //
    // WHY: Hooks own async orchestration and API coordination. If a hook
    // imports a component, it acquires a render-tree dependency. If a hook
    // imports a page, it couples to route structure.
    files: [
      'src/hooks/**/*.ts',
      'src/hooks/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**'],
              message:
                'Hooks must not import pages. Hooks are data-layer infrastructure — ' +
                'they must not depend on route structure.',
            },
            {
              group: ['@/components/**'],
              message:
                'Hooks must not import UI components. Hooks expose data interfaces; ' +
                'components consume them. Invert this dependency.',
            },
          ],
        },
      ],
    },
  },

  {
    // RULE 5: Components must not import pages or feature internals.
    //
    // WHY: Components are render-only. Importing pages introduces a route
    // dependency that prevents component reuse. Importing feature internals
    // bypasses the feature's public index encapsulation boundary.
    files: [
      'src/components/**/*.ts',
      'src/components/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**'],
              message:
                'Components must not import pages. If a component needs route-level ' +
                'data, receive it as a prop.',
            },
            {
              group: [
                '@/features/*/state/**',
                '@/features/*/orchestration/**',
                '@/features/*/queries/**',
                '@/features/*/mutations/**',
                '@/features/*/api/**',
              ],
              message:
                'Components must not import feature internals directly. ' +
                'Import from the feature public index (@/features/<domain>) or use a hook.',
            },
          ],
        },
      ],
    },
  },

  {
    // RULE 6: lib/api must not import React, hooks, or components.
    //
    // WHY: lib/api is framework-agnostic network transport. React, hook, and
    // component imports would make it a React-only module, preventing non-React
    // use cases and creating implicit render-tree dependencies in the data layer.
    files: ['src/lib/api/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'next/navigation', 'next/headers'],
              message:
                'lib/api must not import React or Next.js framework modules. ' +
                'The API layer is framework-agnostic transport infrastructure.',
            },
            {
              group: ['@/hooks/**'],
              message:
                'lib/api must not import hooks. Hooks depend on lib/api — not the reverse.',
            },
            {
              group: ['@/components/**'],
              message: 'lib/api must not import UI components.',
            },
            {
              group: ['@/context/**'],
              message:
                'lib/api must not import React context. Pass auth tokens as function arguments.',
            },
          ],
        },
      ],
    },
  },

  {
    // RULE 7: Pages must not import lib/api/core directly.
    //
    // WHY: lib/api/core is transport infrastructure. Pages consume data through
    // hooks; hooks own API coordination. Direct page imports bypass the hook
    // layer and make network logic invisible to the governance graph.
    //
    // Exception: `import type { ApiClientError }` is allowed for prop typing
    // in error boundaries — it is a type-only import with no runtime network dependency.
    files: [
      'src/app/**/*.ts',
      'src/app/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/api/core'],
              message:
                'Pages must not import lib/api/core directly. ' +
                'API access belongs in hooks. Use "import type" only if needed for prop typing.',
            },
          ],
        },
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH BOUNDARY GUARD  (Phase 2 — RISK-01)
  // ─────────────────────────────────────────────────────────────────────────
  //
  // Two files are classified exceptions for direct supabase.auth usage:
  //   - context/AppContext.tsx     (owns the auth lifecycle for the whole app)
  //   - app/auth/callback/page.tsx (OAuth PKCE exchange — cannot be server-side)
  //
  // All other files must route auth operations through lib/supabase/auth.ts.
  // This rule prevents the direct-auth pattern from spreading to new files.
  // See docs/frontend-governance.md §7 for the classified exception rationale.
  // ─────────────────────────────────────────────────────────────────────────

  {
    // RULE 8: Prevent direct Supabase client import outside classified exceptions.
    files: [
      'src/app/**/*.ts',
      'src/app/**/*.tsx',
      'src/components/**/*.ts',
      'src/components/**/*.tsx',
      'src/hooks/**/*.ts',
      'src/hooks/**/*.tsx',
      'src/features/**/*.ts',
      'src/features/**/*.tsx',
    ],
    ignores: [
      // Classified exception 1: AppContext owns the full auth lifecycle.
      'src/context/AppContext.tsx',
      // Classified exception 2: OAuth callback — detectSessionInUrl requires
      // the browser client to handle the PKCE code exchange directly.
      'src/app/auth/callback/page.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/supabase/client'],
              message:
                'Direct Supabase client import is restricted to AppContext and the OAuth callback page. ' +
                'Use lib/supabase/auth.ts helpers (signIn, signUp, signInWithGoogle) ' +
                'or lib/supabase/listener.ts for auth event subscription. ' +
                'See docs/frontend-governance.md §7 for the classified exception policy.',
            },
          ],
        },
      ],
    },
  },

  {
    // Relax rules for devtools — they're developer-only and can use any/console
    files: ['src/components/devtools/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },

  {
    // Ignore build output and config files
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];
