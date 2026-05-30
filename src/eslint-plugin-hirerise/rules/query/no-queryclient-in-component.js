'use strict';

/**
 * hirerise/query/no-queryclient-in-component
 *
 * Prevents useQueryClient() calls in UI layer files (src/app/, src/components/).
 * Invalidation logic belongs exclusively in mutation hooks (src/hooks/mutations/).
 *
 * BAD (in src/app/dashboard/page.tsx or src/components/MetricsCard.tsx):
 *   const queryClient = useQueryClient();
 *   queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
 *
 * GOOD:
 *   const { submit } = useSubmitProfile(); // mutation hook owns invalidation
 *
 * WHY:
 *   Components declare intent; mutation hooks own cache authority.
 *   Invalidation in components is invisible to governance scanning and
 *   creates competing invalidation owners for the same query namespace.
 *
 * DETECTION:
 *   Flags any CallExpression whose callee is the identifier `useQueryClient`
 *   in a file whose path contains src/app/ or src/components/.
 *   Files under src/components/devtools/ are exempt (developer tooling).
 *
 * SEVERITY: error
 * AUTOFIX:  no
 * GOVERNANCE: Doc 03 — Query Ownership, Doc 06 — Cache Governance
 */

const FORBIDDEN_PATH_SEGMENTS = ['src/app/', 'src/components/'];
const EXEMPT_PATH_SEGMENTS    = ['src/components/devtools/'];

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow useQueryClient() in UI component and page files.',
    },
    messages: {
      noQueryClientInComponent:
        'useQueryClient() is not permitted in components or pages. ' +
        'Move invalidation into a mutation hook at src/hooks/mutations/. ' +
        'Components call the hook; the hook owns the queryClient. ' +
        '[Doc 03 — Query Ownership]',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename().replace(/\\/g, '/');

    const inForbiddenLayer = FORBIDDEN_PATH_SEGMENTS.some(seg =>
      filename.includes(seg)
    );
    const inExemptPath = EXEMPT_PATH_SEGMENTS.some(seg =>
      filename.includes(seg)
    );

    // Rule is inactive outside the forbidden layer, or in exempt paths
    if (!inForbiddenLayer || inExemptPath) {
      return {};
    }

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'useQueryClient'
        ) {
          context.report({ node, messageId: 'noQueryClientInComponent' });
        }
      },
    };
  },
};
