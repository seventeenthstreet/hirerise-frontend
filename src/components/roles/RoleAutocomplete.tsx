'use client';

/**
 * components/roles/RoleAutocomplete.tsx
 *
 * Dropdown autocomplete for role search.
 * Uses useRoleAutocomplete hook — fast prefix + fuzzy, no embedding.
 *
 * Usage:
 *   <RoleAutocomplete
 *     agency="hirerise"
 *     onSelect={(item) => console.log(item.role_id, item.role_name)}
 *     placeholder="Search roles..."
 *   />
 */

'use client';

import { useRef, useState, useEffect }   from 'react';
import { useRoleAutocomplete }           from '@/hooks/useRoleAutocomplete';
import type { AutocompleteItem }         from '@/services/roleSearchService';

interface RoleAutocompleteProps {
  agency:       string;
  onSelect:     (item: AutocompleteItem) => void;
  placeholder?: string;
  limit?:       number;
  className?:   string;
  defaultValue?: string;
}

export function RoleAutocomplete({
  agency,
  onSelect,
  placeholder = 'Search roles…',
  limit       = 10,
  className   = '',
  defaultValue = '',
}: RoleAutocompleteProps) {
  const { query, setQuery, items, isLoading, noResults, clear } =
    useRoleAutocomplete({ agency, limit });

  const [open,        setOpen]        = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef                      = useRef<HTMLInputElement>(null);
  const listRef                       = useRef<HTMLUListElement>(null);

  // Open dropdown when items arrive
  useEffect(() => {
    if (items.length > 0) { setOpen(true); setActiveIndex(-1); }
    else                  { setOpen(false); }
  }, [items]);

  function handleSelect(item: AutocompleteItem) {
    onSelect(item);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(items[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (items.length > 0) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="w-full rounded-lg border border-surface-200 bg-white px-4 py-2.5 pr-10 text-sm text-surface-900 placeholder-surface-400 shadow-sm outline-none transition focus:border-hr-400 focus:ring-2 focus:ring-hr-100"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />

        {/* Spinner / clear icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <svg className="h-4 w-4 animate-spin text-surface-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : query ? (
            <button
              type="button"
              onClick={() => { clear(); setOpen(false); }}
              className="text-surface-400 hover:text-surface-600"
              tabIndex={-1}
              aria-label="Clear"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <svg className="h-4 w-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-surface-200 bg-white shadow-lg"
        >
          {items.map((item, idx) => (
            <li
              key={item.role_id}
              role="option"
              aria-selected={idx === activeIndex}
              onMouseDown={() => handleSelect(item)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={[
                'flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm transition-colors',
                idx === activeIndex
                  ? 'bg-hr-50 text-hr-700'
                  : 'text-surface-800 hover:bg-surface-50',
              ].join(' ')}
            >
              <span className="font-medium">{item.role_name}</span>
              <span className="ml-2 text-xs text-surface-400">
                {item.score === 2 ? 'exact' : item.score >= 1.5 ? 'alt title' : `${Math.round(item.score * 100)}%`}
              </span>
            </li>
          ))}

          {noResults && (
            <li className="px-4 py-3 text-sm text-surface-400">
              No roles found for "{query}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
}