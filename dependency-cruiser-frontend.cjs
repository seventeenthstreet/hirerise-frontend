/**
 * .dependency-cruiser-frontend.cjs
 *
 * Frontend layer ceiling rules for HireRise (frond/).
 *
 * Equivalent to backend .dependency-cruiser.cjs governance.
 * Run:
 *   npx depcruise src --config .dependency-cruiser-frontend.cjs
 *
 * Rules mirror the ESLint layer direction rules but operate on the resolved
 * dependency graph rather than AST-level import declarations. The two tools
 * are complementary: depcruise catches transitive violations; ESLint catches
 * direct import semantics. Both must pass for governance to be clean.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [

    // ─────────────────────────────────────────────────────────────────────
    // LAYER CEILING: HOOKS
    // Hooks sit between lib/ and features/pages. They must not import
    // upward into pages or sideways into UI components.
    // ─────────────────────────────────────────────────────────────────────

    {
      name: 'no-hook-importing-page',
      severity: 'error',
      comment:
        'Hooks must not import pages. Hooks are data-layer infrastructure; ' +
        'they must not acquire route-level dependencies.',
      from: { path: '^src/hooks/' },
      to:   { path: '^src/app/' },
    },

    {
      name: 'no-hook-importing-component',
      severity: 'error',
      comment:
        'Hooks must not import UI components. The dependency direction is ' +
        'component → hook, never hook → component.',
      from: { path: '^src/hooks/' },
      to:   { path: '^src/components/' },
    },

    // ─────────────────────────────────────────────────────────────────────
    // LAYER CEILING: COMPONENTS
    // Components render and receive data via props or hooks.
    // They must not import pages or feature internals.
    // ─────────────────────────────────────────────────────────────────────

    {
      name: 'no-component-importing-page',
      severity: 'error',
      comment:
        'Components must not import pages. If a component needs route-level ' +
        'data, it must receive it as a prop.',
      from: { path: '^src/components/' },
      to:   { path: '^src/app/' },
    },

    {
      name: 'no-component-importing-feature-internals',
      severity: 'error',
      comment:
        'Components must not import feature sub-paths directly. ' +
        'The feature public index is the only approved external interface.',
      from: { path: '^src/components/' },
      to:   {
        path: '^src/features/[^/]+/(state|orchestration|queries|mutations|api)/',
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // LAYER CEILING: lib/api
    // lib/api is framework-agnostic network transport.
    // It must not import React, hooks, components, or context.
    // ─────────────────────────────────────────────────────────────────────

    {
      name: 'no-lib-api-importing-react',
      severity: 'error',
      comment:
        'lib/api must not import React. The API layer is framework-agnostic ' +
        'transport infrastructure — React imports create an implicit render-tree dependency.',
      from: { path: '^src/lib/api/' },
      to:   { path: '^node_modules/react(/|$)' },
    },

    {
      name: 'no-lib-api-importing-hooks',
      severity: 'error',
      comment:
        'lib/api must not import hooks. Hooks depend on lib/api — not the reverse.',
      from: { path: '^src/lib/api/' },
      to:   { path: '^src/hooks/' },
    },

    {
      name: 'no-lib-api-importing-components',
      severity: 'error',
      comment: 'lib/api must not import UI components.',
      from: { path: '^src/lib/api/' },
      to:   { path: '^src/components/' },
    },

    {
      name: 'no-lib-api-importing-context',
      severity: 'error',
      comment:
        'lib/api must not import React context. Auth tokens must be passed ' +
        'as function arguments, not read from context.',
      from: { path: '^src/lib/api/' },
      to:   { path: '^src/context/' },
    },

    // ─────────────────────────────────────────────────────────────────────
    // LAYER CEILING: PAGES
    // Pages are route entry points. They orchestrate via hooks.
    // They must not reach into lib/api/core or feature internals.
    // ─────────────────────────────────────────────────────────────────────

    {
      name: 'no-page-importing-lib-api-core',
      severity: 'error',
      comment:
        'Pages must not import lib/api/core directly. ' +
        'API access belongs in hooks. lib/api/core is transport infrastructure.',
      from: { path: '^src/app/' },
      to:   { path: '^src/lib/api/core/' },
    },

    // ─────────────────────────────────────────────────────────────────────
    // FEATURE ENCAPSULATION
    // Feature sub-paths must not be imported by files outside the feature
    // unless they are the primary page consumer.
    // ─────────────────────────────────────────────────────────────────────

    {
      name: 'no-external-feature-internal-import',
      severity: 'error',
      comment:
        'Files outside a feature must not import feature sub-paths directly. ' +
        'Use the feature public index. ' +
        'lib/query/queryKeys is a classified BC exception for onboarding query key re-export.',
      from: {
        path: '^src/',
        pathNot: [
          '^src/features/onboarding/',
          '^src/hooks/onboarding/',
          '^src/hooks/useOnboarding\\.tsx?$',
          '^src/hooks/mutations/useSubmitOnboardingStep\\.tsx?$',
          '^src/hooks/mutations/useResetDirection\\.tsx?$',
          '^src/hooks/mutations/useSetDirection\\.tsx?$',
          '^src/hooks/mutations/useGenerateCareerReport\\.tsx?$',
          '^src/hooks/useDirection\\.tsx?$',
          '^src/app/\\(auth\\)/\\(onboarding\\)/',
          '^src/app/career/onboarding/',
          // lib/query/queryKeys re-exports onboarding query keys — classified BC exception.
          '^src/lib/query/queryKeys\\.ts$',
        ],
      },
      to: {
        path: '^src/features/[^/]+/(state|orchestration|queries|mutations|api)/',
      },
    },

    {
      name: 'no-sibling-feature-internal-coupling',
      severity: 'error',
      comment:
        'Forward-looking rule: once a second feature domain exists, it must not ' +
        'import internals of sibling features. Cross-feature data flows via hooks or lib/.',
      from: { path: '^src/features/onboarding/' },
      to: {
        // Matches internals of any feature that is NOT onboarding.
        path: '^src/features/(?!onboarding/)[^/]+/(state|orchestration|queries|mutations|api)/',
      },
    },
    // ─────────────────────────────────────────────────────────────────────────────
    // CIRCULAR DEPENDENCY DETECTION
    // ─────────────────────────────────────────────────────────────────────────────

    {
      name: 'no-circular',
      severity: 'error',
      comment: 'No circular dependencies anywhere in the module graph.',
      from: {},
      to: { circular: true },
    },

  ],

  options: {
    // Resolve TypeScript path aliases (@/ → src/)
    tsConfig: { fileName: 'tsconfig.json' },

    // Module systems used in the frontend
    moduleSystems: ['es6', 'cjs'],

    // Exclude build output, tests, and generated files
    exclude: {
      path: [
        '\\.(test|spec)\\.(ts|tsx|js)$',
        '__tests__',
        '\\.next/',
        'node_modules',
        '\\.stories\\.(ts|tsx|js)$',
      ],
    },
  },
};
