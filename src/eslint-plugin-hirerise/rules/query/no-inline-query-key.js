'use strict';

/**
 * hirerise/query/no-inline-query-key
 *
 * Prevents array literals used directly as React Query `queryKey` values.
 * All query keys must be constructed via the queryKeys factory from @/lib/query.
 *
 * BAD:
 *   useQuery({ queryKey: ['metrics', 'overview', filters], ... })
 *   useQuery({ queryKey: ['user', 'me'], ... })
 *
 * GOOD:
 *   useQuery({ queryKey: queryKeys.metrics.section('overview', filters), ... })
 *   useQuery({ queryKey: queryKeys.user.me(), ... })
 *
 * WHY:
 *   Inline keys bypass the factory hierarchy. invalidateQueries(['metrics'])
 *   will not match ['metrics', 'overview'] unless the exact same array is used
 *   at every call site. The factory guarantees consistent prefix-matching.
 *
 * DETECTION:
 *   Flags any `queryKey` property whose value is an ArrayExpression containing
 *   at least one string literal. Variable references are permitted — only
 *   literal arrays are flagged.
 *
 * SEVERITY: error
 * AUTOFIX:  no
 * GOVERNANCE: Doc 03 — Query Ownership
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require queryKeys factory usage instead of inline array literals for React Query queryKey.',
    },
    messages: {
      noInlineQueryKey:
        'Inline queryKey array is not permitted. ' +
        'Use the queryKeys factory from @/lib/query: ' +
        'queryKey: queryKeys.<domain>.<method>(...args). ' +
        'Inline keys cause invalidation mismatches when keys diverge across call sites. ' +
        '[Doc 03 — Query Ownership]',
    },
    schema: [],
  },

  create(context) {
    /**
     * Returns true when node is an ArrayExpression that contains at least one
     * string literal element — i.e. a hand-written key tuple.
     *
     * Allows: queryKey: someVariable
     * Allows: queryKey: queryKeys.x.y()
     * Flags:  queryKey: ['a', 'b', ...]
     * Flags:  queryKey: ['a', someVar]   (mixed — string present)
     */
    function isInlineKeyArray(node) {
      return (
        node.type === 'ArrayExpression' &&
        node.elements.some(
          el => el !== null &&
                el.type === 'Literal' &&
                typeof el.value === 'string'
        )
      );
    }

    return {
      Property(node) {
        // Only interested in `queryKey:` properties
        if (
          node.key.type !== 'Identifier' ||
          node.key.name !== 'queryKey'
        ) {
          return;
        }

        if (isInlineKeyArray(node.value)) {
          context.report({ node, messageId: 'noInlineQueryKey' });
        }
      },
    };
  },
};
