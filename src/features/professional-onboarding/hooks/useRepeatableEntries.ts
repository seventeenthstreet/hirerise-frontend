/**
 * @file src/features/professional-onboarding/hooks/useRepeatableEntries.ts
 *
 * WP-PRO-09D — Guided Profile Builder UI Implementation
 *
 * Small, generic local-state helper for the repeatable-entry lists shared by
 * the Education and Experience step forms (add / update / remove one row of
 * a typed shape). Exists purely to avoid writing the same
 * add/update-by-index/remove-by-index logic twice — no network, validation,
 * or normalization logic lives here; those stay in each form and on the
 * backend, respectively.
 */

import { useState } from 'react';

export function useRepeatableEntries<T>(initial: T[], emptyItem: T) {
  const [entries, setEntries] = useState<T[]>(initial.length > 0 ? initial : [emptyItem]);

  function updateEntry(index: number, patch: Partial<T>) {
    setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }

  function addEntry() {
    setEntries((prev) => [...prev, emptyItem]);
  }

  function removeEntry(index: number) {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  return { entries, updateEntry, addEntry, removeEntry, setEntries };
}
