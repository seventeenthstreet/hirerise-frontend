'use client';

/**
 * components/roles/RoleSearchResults.tsx
 *
 * Full hybrid search UI — input + scored results list.
 * Uses useRoleSearch hook (semantic + FTS + recency).
 *
 * Usage:
 *   <RoleSearchResults
 *     agency="hirerise"
 *     onSelect={(role) => console.log(role)}
 *   />
 */

import { useRoleSearch }          from '@/hooks/useRoleSearch';
import type { HybridRoleResult }  from '@/services/roleSearchService';

interface RoleSearchResultsProps {
  agency:      string;
  onSelect?:   (role: HybridRoleResult) => void;
  limit?:      number;
  className?:  string;
}

function ScoreBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label} {Math.round(value * 100)}%
    </span>
  );
}

export function RoleSearchResults({
  agency,
  onSelect,
  limit     = 20,
  className = '',
}: RoleSearchResultsProps) {
  const {
    query, setQuery,
    results, total,
    isSearching, noResults, isEnabled, isError,
  } = useRoleSearch({ agency, limit });

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search roles by name, skills, or description…"
          className="w-full rounded-xl border border-surface-200 bg-white px-4 py-3 pr-12 text-sm shadow-sm outline-none transition focus:border-hr-400 focus:ring-2 focus:ring-hr-100"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <svg className="h-4 w-4 animate-spin text-surface-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Result count */}
      {isEnabled && !isSearching && results.length > 0 && (
        <p className="text-xs text-surface-500">
          {total} result{total !== 1 ? 's' : ''} for <span className="font-medium text-surface-700">"{query}"</span>
        </p>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          Search failed. Please try again.
        </div>
      )}

      {/* No results */}
      {noResults && (
        <div className="rounded-lg border border-surface-100 bg-surface-50 px-4 py-6 text-center text-sm text-surface-500">
          No roles found for "{query}". Try different keywords.
        </div>
      )}

      {/* Empty state */}
      {!isEnabled && (
        <div className="rounded-lg border border-surface-100 bg-surface-50 px-4 py-6 text-center text-sm text-surface-400">
          Type at least 2 characters to search roles
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((role) => (
            <li
              key={role.role_id}
              onClick={() => onSelect?.(role)}
              className={[
                'rounded-xl border border-surface-100 bg-white p-4 shadow-sm transition',
                onSelect ? 'cursor-pointer hover:border-hr-300 hover:shadow-md' : '',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-surface-900">{role.role_name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <ScoreBadge
                      label="Match"
                      value={role.hybrid_score}
                      color="bg-hr-50 text-hr-700"
                    />
                    <ScoreBadge
                      label="Semantic"
                      value={role.semantic_score}
                      color="bg-blue-50 text-blue-700"
                    />
                    {role.fts_score > 0 && (
                      <ScoreBadge
                        label="Text"
                        value={role.fts_score}
                        color="bg-green-50 text-green-700"
                      />
                    )}
                  </div>
                </div>

                {/* Hybrid score ring */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-hr-50">
                  <span className="text-sm font-bold text-hr-700">
                    {Math.round(role.hybrid_score * 100)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}