/**
 * components/permissions/PrincipalPicker.tsx
 *
 * Reusable principal lookup for the Permission Assignment and Evaluation
 * UIs. Every "principal" in this system is an enterprise User — there is
 * no separate Principal directory — so this searches the existing Admin
 * User Directory (`useAdminUsersList`, lib/api/adminUsers.ts) rather than
 * introducing any new backend capability. Debounces locally (300ms, same
 * pattern and duration as MasterDataSearch) so keystrokes don't each fire
 * a request; the actual filtering always happens server-side via the
 * Admin Users API's `search` param — this component never filters
 * candidates itself.
 *
 * Renders as an accessible combobox: a text input (role="combobox") that
 * opens a listbox of matching users. Selecting a result commits that
 * user's id as the principalId and collapses to a read-only "chip"
 * showing who's selected, with a "Change" action to reopen the search.
 */

import { useEffect, useRef, useState } from 'react';
import { useAdminUsersList } from '@/hooks/admin/useAdminUsers';
import type { AdminUserListItem } from '@/lib/api/adminUsers';
import { Button } from '@/components/ui/Button';

interface PrincipalPickerProps {
  /** Currently-selected principal's user id, or null if none selected. */
  value: string | null;
  /** Called with the selected user's id and full record. */
  onChange: (principalId: string, user: AdminUserListItem) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Set when `value` was restored from elsewhere (e.g. a route param) and the matching user record isn't loaded yet — shows the raw id instead of a blank chip. */
  selectedUserFallbackLabel?: string;
}

export function PrincipalPicker({
  value,
  onChange,
  label = 'Principal',
  placeholder = 'Search users by name or email…',
  disabled = false,
  selectedUserFallbackLabel,
}: PrincipalPickerProps) {
  const [draft, setDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(draft), 300);
    return () => clearTimeout(timer);
  }, [draft]);

  const { data, isFetching } = useAdminUsersList({
    limit: 8,
    offset: 0,
    search: debouncedSearch || undefined,
  });

  // Collapse the dropdown on outside click.
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  function handleSelect(user: AdminUserListItem) {
    setSelectedUser(user);
    setIsOpen(false);
    setDraft('');
    onChange(user.id, user);
  }

  function handleChangeClick() {
    setSelectedUser(null);
    setDraft('');
    setIsOpen(true);
  }

  const hasSelection = Boolean(value);

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="principal-picker-input" className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>

      {hasSelection && !isOpen ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {selectedUser?.displayName || selectedUser?.email || selectedUserFallbackLabel || value}
            </p>
            {selectedUser?.email && selectedUser.displayName && (
              <p className="truncate text-xs text-muted-foreground">{selectedUser.email}</p>
            )}
          </div>
          {!disabled && (
            <Button type="button" variant="ghost" size="sm" onClick={handleChangeClick}>
              Change
            </Button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            id="principal-picker-input"
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls="principal-picker-listbox"
            aria-autocomplete="list"
            autoComplete="off"
            value={draft}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setDraft(e.target.value);
              setIsOpen(true);
            }}
            className={[
              'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm',
              'text-foreground placeholder:text-muted-foreground',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              disabled ? 'cursor-not-allowed opacity-60' : '',
            ].join(' ')}
          />

          {isOpen && (
            <ul
              id="principal-picker-listbox"
              role="listbox"
              className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card shadow-md"
            >
              {isFetching && (
                <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
              )}
              {!isFetching && (data?.items.length ?? 0) === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">No users found.</li>
              )}
              {!isFetching &&
                data?.items.map((user) => (
                  <li key={user.id} role="option" aria-selected={user.id === value}>
                    <button
                      type="button"
                      onClick={() => handleSelect(user)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className="block truncate font-medium text-foreground">
                        {user.displayName || user.email}
                      </span>
                      {user.displayName && (
                        <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
