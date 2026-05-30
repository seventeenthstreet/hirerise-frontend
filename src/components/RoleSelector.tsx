

import { useState } from 'react';
import { Spinner } from '@/components/ui';
import type { Role } from '@/lib/api/roles';
import type { ApiClientError } from '@/lib/api/core';

/**
 * components/RoleSelector.tsx — Role picker used in the direction/onboarding flow.
 *
 * RISK-03 (Phase 2 governance): Converted from hook-owning to controlled component.
 *
 * BEFORE: Called useRoles() internally. The component owned data fetching,
 *   loading state, and error state — coupling it to the React Query layer and
 *   making it impossible to use in contexts that provide role data differently
 *   (Storybook, tests, alternate onboarding flows).
 *
 * AFTER: All data is received via props. The parent (page or feature wrapper)
 *   calls useRoles() and passes roles, isLoading, error, and refetch down.
 *   This component owns only UI selection state (selectedRole).
 *
 * Design token migration (Phase A.5):
 *  - Semantic tokens: text-foreground, text-muted-foreground, border-border,
 *    bg-primary, bg-primary/10, text-primary, border-primary, bg-destructive/10,
 *    border-destructive/30, text-destructive.
 */

export interface RoleSelectorProps {
  roles:     Role[];
  isLoading: boolean;
  error:     ApiClientError | null;
  refetch:   () => void;
}

export default function RoleSelector({ roles, isLoading, error, refetch }: RoleSelectorProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-semibold text-foreground mb-1">Select Your Role</h2>
      <p className="text-sm text-muted-foreground mb-6">Choose the role that best matches your career goals.</p>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error.message ?? 'Failed to load roles. Please try again.'}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div aria-busy={isLoading} className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Spinner size="sm" label="Loading roles" />
          Loading roles…
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && roles.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">No roles available at the moment.</p>
          <button
            onClick={() => refetch()}
            aria-label="Retry fetching roles"
            className="text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80"
          >
            Retry
          </button>
        </div>
      )}

      {/* Roles list */}
      {!isLoading && roles.length > 0 && (
        <ul className="space-y-2">
          {roles.map((role: Role) => {
            const isSelected = selectedRole?.id === role.id;
            return (
              <li key={role.id}>
                <button
                  onClick={() => setSelectedRole(role)}
                  aria-label={`Select role: ${role.title}`}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-foreground hover:border-border/80 hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{role.title}</p>
                      {role.category && (
                        <p className="text-xs text-muted-foreground mt-0.5">{role.category}</p>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-primary">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Selected summary */}
      {selectedRole && (
        <div className="mt-6 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-foreground">
          Selected: <span className="font-semibold">{selectedRole.title}</span>
        </div>
      )}
    </div>
  );
}