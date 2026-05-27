'use client';

/**
 * @file ActivityDiscovery.tsx
 *
 * SUBSTEP 1: Activity Discovery
 * ══════════════════════════════
 * Grouped, searchable activity taxonomy with multi-select.
 * Taxonomy is ALWAYS loaded from the server — never hardcoded here.
 *
 * UX PRINCIPLES:
 *   • Search filters across all categories simultaneously
 *   • Selected activities shown as chips above the taxonomy
 *   • Each category is collapsible
 *   • Mobile-first grid layout
 *   • Immediate persist on select (addActivity called on click)
 */

import { useState, useMemo, useCallback } from 'react';
import type { TaxonomyCategory, StudentActivity, ActivitySignalQuality, ActivityCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface ActivityDiscoveryProps {
  taxonomy:           TaxonomyCategory[];
  selectedActivities: StudentActivity[];
  signalQuality:      ActivitySignalQuality;
  onAdd:              (activityKey: string, category: ActivityCategory) => Promise<unknown>;
  onRemove:           (activityKey: string) => Promise<unknown>;
  isAdding:           boolean;
  isRemoving:         boolean;
  onNext:             () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ActivityDiscovery({
  taxonomy,
  selectedActivities,
  signalQuality,
  onAdd,
  onRemove,
  isAdding,
  isRemoving,
  onNext,
}: ActivityDiscoveryProps) {
  const [searchQuery, setSearchQuery]     = useState('');
  const [expandedCats, setExpandedCats]   = useState<Set<string>>(new Set(['technical', 'creative']));
  const [pendingKey, setPendingKey]       = useState<string | null>(null);

  const selectedKeys = useMemo(
    () => new Set(selectedActivities.map((a) => a.activityKey)),
    [selectedActivities],
  );

  // ── Search filter ──────────────────────────────────────────────────────────

  const filteredTaxonomy = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return taxonomy;

    return taxonomy
      .map((cat) => ({
        ...cat,
        activities: cat.activities.filter(
          (a) =>
            a.displayName.toLowerCase().includes(q) ||
            a.description?.toLowerCase().includes(q) ||
            a.tags.some((t) => t.toLowerCase().includes(q)),
        ),
      }))
      .filter((cat) => cat.activities.length > 0);
  }, [taxonomy, searchQuery]);

  // ── Expand all categories when searching ───────────────────────────────────

  const isSearching = searchQuery.trim().length > 0;

  const toggleCategory = useCallback((category: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  // ── Activity toggle ────────────────────────────────────────────────────────

  async function handleToggle(activityKey: string, category: ActivityCategory) {
    setPendingKey(activityKey);
    try {
      if (selectedKeys.has(activityKey)) {
        await onRemove(activityKey);
      } else {
        await onAdd(activityKey, category);
      }
    } finally {
      setPendingKey(null);
    }
  }

  const isMutating = isAdding || isRemoving;

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-foreground">
          What do you do outside of school?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select all the activities you're involved in — even casually.
        </p>
      </div>

      {/* Selected activities chips */}
      {selectedActivities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedActivities.map((act) => {
            const catData = taxonomy.find((c) => c.category === act.activityCategory);
            const taxItem = catData?.activities.find((a) => a.activityKey === act.activityKey);
            return (
              <span
                key={act.activityKey}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {taxItem?.displayName ?? act.activityKey}
                <button
                  type="button"
                  onClick={() => handleToggle(act.activityKey, act.activityCategory)}
                  disabled={isMutating}
                  className="ml-0.5 rounded-full p-0.5 text-primary/60 hover:text-primary disabled:opacity-50"
                  aria-label={`Remove ${taxItem?.displayName}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm">
          🔍
        </span>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search activities…"
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Taxonomy categories */}
      <div className="space-y-3">
        {filteredTaxonomy.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No activities match "{searchQuery}".
          </p>
        )}

        {filteredTaxonomy.map((cat) => {
          const isExpanded = isSearching || expandedCats.has(cat.category);
          const selectedInCat = cat.activities.filter((a) =>
            selectedKeys.has(a.activityKey),
          ).length;

          return (
            <div
              key={cat.category}
              className="rounded-lg border border-border overflow-hidden"
            >
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.category)}
                className="flex w-full items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span>{CATEGORY_ICONS[cat.category as ActivityCategory]}</span>
                  <span>{CATEGORY_LABELS[cat.category as ActivityCategory]}</span>
                  {selectedInCat > 0 && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                      {selectedInCat}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </button>

              {/* Activity grid */}
              {isExpanded && (
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                  {cat.activities.map((activity) => {
                    const isSelected = selectedKeys.has(activity.activityKey);
                    const isPending  = pendingKey === activity.activityKey;

                    return (
                      <button
                        key={activity.activityKey}
                        type="button"
                        onClick={() =>
                          handleToggle(activity.activityKey, cat.category as ActivityCategory)
                        }
                        disabled={isMutating && !isPending}
                        className={[
                          'group relative flex flex-col items-start rounded-lg border p-3 text-left transition-all text-sm',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/30',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                        ].join(' ')}
                      >
                        <span className="font-medium leading-tight">
                          {activity.displayName}
                        </span>
                        {activity.description && (
                          <span className="mt-1 text-xs text-muted-foreground line-clamp-2 group-hover:line-clamp-none">
                            {activity.description}
                          </span>
                        )}
                        {isPending && (
                          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                          </span>
                        )}
                        {isSelected && !isPending && (
                          <span className="absolute right-2 top-2 text-xs text-primary">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Signal feedback */}
      {selectedActivities.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedActivities.length} activit{selectedActivities.length === 1 ? 'y' : 'ies'} selected.
          {!signalQuality.isSufficient && ' Add at least one to continue.'}
        </p>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={onNext}
        disabled={!signalQuality.isSufficient}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next: Participation Details →
      </button>
    </div>
  );
}
