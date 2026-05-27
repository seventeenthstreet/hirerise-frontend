/**
 * frond/.dependency-cruiser.cjs
 *
 * Foundation enforcement — static dependency graph validation.
 * Covers circular dependencies and the three structural invariants
 * that have zero false-positive risk at this codebase size.
 *
 * APPROVED RULES — Foundation Phase:
 *   no-circular                  — circular imports (universal)
 *   no-feature-internal-cross    — feature internals are private
 *   no-lib-importing-feature     — lib/ is infrastructure, not domain
 *   no-presentation-importing-ai — presentation never invokes AI
 *
 * RUN:
 *   npx depcruise src --config .dependency-cruiser.cjs
 *
 * GOVERNANCE: Doc 08 — Dependency Rules
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [

    // ── Circular dependencies ─────────────────────────────────────────────────
    // Universal rule. Cycles create unpredictable initialisation order and
    // make tree-shaking impossible.
    {
      name:     'no-circular',
      severity: 'error',
      from:     {},
      to:       { circular: true },
    },

    // ── Feature boundary isolation ────────────────────────────────────────────
    // Feature sub-paths (state/, orchestration/, queries/, hooks/, mutations/)
    // are private. Cross-feature access must go through the public index.ts.
    //
    // Allowed:  import { useOnboarding } from '@/features/onboarding'
    // Forbidden: import { store } from '@/features/onboarding/state/store'
    {
      name:    'no-feature-internal-cross-import',
      severity: 'error',
      from: {
        // Any file inside a feature sub-directory
        path: '^src/features/([^/]+)/.+',
      },
      to: {
        // Targeting a sub-path of a DIFFERENT feature
        // (depcruise doesn't support backrefs; ESLint no-restricted-imports
        //  handles the same-feature exemption at the import level)
        path:     '^src/features/[^/]+/(?!index\\.ts)',
        pathNot:  '^src/features/([^/]+)/\\1/', // same-feature self-reference
      },
    },

    // ── lib/ layer purity ─────────────────────────────────────────────────────
    // lib/ is infrastructure (api client, query client, analytics wrapper, etc.).
    // It must not import from feature domains — that would invert the dependency
    // direction and create implicit feature coupling in infrastructure code.
    {
      name:     'no-lib-importing-feature',
      severity: 'error',
      from:     { path: '^src/lib/' },
      to:       { path: '^src/features/' },
    },

    // ── AI boundary (presentation layer) ─────────────────────────────────────
    // app/ and components/ must never import AI feature modules.
    // AI results arrive via props from orchestration hooks.
    {
      name:     'no-presentation-importing-ai',
      severity: 'error',
      from:     { path: '^src/(app|components)/' },
      to:       { path: '^src/(lib/ai|features/career-copilot|features/ava|features/ai-)' },
    },

  ],

  options: {
    doNotFollow:          { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig:             { fileName: './tsconfig.json' },
    outputType:           'err-long',
  },
};
