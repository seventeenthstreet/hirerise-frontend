'use strict';

/**
 * eslint-plugin-hirerise
 *
 * Foundation enforcement plugin for frond/ (Next.js).
 *
 * APPROVED RULES — Foundation Phase:
 *   query/no-inline-query-key         — enforce queryKeys factory usage
 *   query/no-queryclient-in-component — restrict queryClient to mutation hooks
 *
 * INSTALL:
 *   In frond/package.json:
 *     "eslint-plugin-hirerise": "file:src/eslint-plugin-hirerise"
 *
 *   In frond/eslint.config.mjs, add to plugins and rules:
 *     import hirerise from 'eslint-plugin-hirerise';
 *     plugins: { hirerise }
 *     rules: {
 *       'hirerise/query/no-inline-query-key':         'error',
 *       'hirerise/query/no-queryclient-in-component': 'error',
 *     }
 */

module.exports = {
  rules: {
    'query/no-inline-query-key':         require('./rules/query/no-inline-query-key'),
    'query/no-queryclient-in-component': require('./rules/query/no-queryclient-in-component'),
  },
};
