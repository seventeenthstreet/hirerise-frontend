/**
 * src/components/analytics/formatters.ts
 *
 * Pure formatting utilities for analytics display.
 * Extracted from analytics/index.tsx for Vite Fast Refresh compatibility.
 * No state, no side effects.
 */

export function fmtRate(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function fmtDecimal(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

/**
 * Format a Unix timestamp (ms) as a human-readable relative time string.
 * Pure function — no side effects. Returns '' when ts is 0/null/undefined
 * so callers can use it directly in a conditional render.
 *
 * Examples: "just now", "2 min ago", "1 hr ago"
 *
 * Intentionally limited resolution (minutes / hours) — analytics sections
 * refresh on a 2-minute TTL so sub-minute precision adds no value.
 */
export function fmtRelativeTime(ts: number | undefined): string {
  if (!ts) return '';
  const diffMs = Date.now() - ts;
  if (diffMs < 10_000)          return 'just now';
  if (diffMs < 60_000)          return `${Math.floor(diffMs / 1_000)}s ago`;
  if (diffMs < 3_600_000)       return `${Math.floor(diffMs / 60_000)} min ago`;
  return `${Math.floor(diffMs / 3_600_000)} hr ago`;
}