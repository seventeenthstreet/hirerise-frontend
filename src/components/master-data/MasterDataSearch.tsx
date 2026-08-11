/**
 * components/master-data/MasterDataSearch.tsx
 *
 * Debounced search input. Debounces locally (300ms) so keystrokes don't
 * each fire a backend request, but the actual filtering always happens
 * server-side via the `search` query param — this component never filters
 * rows itself (see WP-ADMIN-02A §10: "Do NOT duplicate search client-side").
 */

import { useEffect, useState } from 'react';

interface MasterDataSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function MasterDataSearch({
  value,
  onChange,
  placeholder = 'Search…',
  debounceMs = 300,
}: MasterDataSearchProps) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Keep local draft in sync if `value` is reset externally (e.g. a "Clear
  // search" button elsewhere). Adjusted during render — not in an effect —
  // per React's guidance for resetting state when a prop changes.
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, debounceMs]);

  return (
    <div className="relative">
      <label htmlFor="master-data-search" className="sr-only">
        {placeholder}
      </label>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 3.61 9.65l3.62 3.62a.75.75 0 1 0 1.06-1.06l-3.62-3.62A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        id="master-data-search"
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className={[
          'h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm',
          'text-foreground placeholder:text-muted-foreground',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        ].join(' ')}
      />
    </div>
  );
}
