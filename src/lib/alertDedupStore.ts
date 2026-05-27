/**
 * @file lib/alertDedupStore.ts
 * @description Storage abstraction for the alert deduplication cache.
 *
 * POSITION IN THE PIPELINE:
 *
 *   alertDedup.ts (public dedup API)
 *           ↓
 *   ► DedupStore  ← YOU ARE HERE  (storage contract + in-memory default)
 *           ↓
 *   In-memory Map  (today)
 *   Redis / backend  (future — inject via setDedupStore())
 *
 * PURPOSE:
 *   alertDedup.ts currently owns both the dedup LOGIC (cooldown calculation,
 *   key construction, eviction) and the STORAGE (a module-level Map). This
 *   coupling makes the storage layer impossible to swap without touching the
 *   logic — a problem when Redis or a backend cache is introduced in future.
 *
 *   This file extracts storage into a minimal interface (DedupStore) and
 *   provides an in-memory default that is behaviourally identical to the
 *   original Map-based implementation. The logic in alertDedup.ts is
 *   unchanged; it just calls through the store abstraction instead of
 *   operating on a private Map.
 *
 * DESIGN DECISIONS:
 *
 *   1. SYNCHRONOUS interface.
 *      alertDedup.isDuplicate() is called inside a tight for-loop inside
 *      alertDispatcher.ts. Making it async would require await chains that
 *      propagate into the dispatcher, complicating the fire-and-forget model.
 *
 *      The in-memory implementation is always synchronous. When Redis is
 *      introduced, the adapter layer (metricsAdapter or a future worker)
 *      can pre-hydrate a local Set from Redis before the dispatch loop so
 *      that dedup checks remain synchronous per batch.
 *
 *      Alternative: if a fully async store is required in future, the
 *      dispatcher loop can be refactored to pre-fetch all dedup keys in a
 *      single async call before the per-alert loop begins — one await, not N.
 *
 *   2. TTL-based has() / set().
 *      The store accepts a TTL on set() so that future implementations
 *      (Redis SETEX, DynamoDB TTL) can express expiry natively. The
 *      in-memory implementation approximates TTL via passive eviction on has().
 *
 *   3. NO Redis implementation here.
 *      The Redis adapter belongs in a separate file (alertDedupStoreRedis.ts)
 *      and is injected via setDedupStore(). This file stays dependency-free.
 *
 *   4. Module-level active store.
 *      setDedupStore() is the injection point. It is called once at
 *      application bootstrap (e.g. in a server component or adapter init).
 *      The default is InMemoryDedupStore — no bootstrap call is required
 *      in environments that do not need a persistent store.
 *
 * HOW TO ADD A REDIS STORE (future):
 *
 *   // alertDedupStoreRedis.ts
 *   import type { DedupStore } from './alertDedupStore';
 *   export class RedisDedupStore implements DedupStore {
 *     // Wrap ioredis SETNX + EXPIRE. Pre-hydrate before dispatch loop.
 *   }
 *
 *   // At bootstrap (e.g. instrumentation.ts):
 *   import { setDedupStore } from '@/lib/alertDedupStore';
 *   import { RedisDedupStore } from '@/lib/alertDedupStoreRedis';
 *   setDedupStore(new RedisDedupStore(redisClient));
 *
 * SCOPE:
 *   Internal — consumed only by alertDedup.ts.
 *   Must NOT be imported by hooks, UI, or pages.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STORE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal storage contract for alert deduplication state.
 *
 * Implementations must be:
 *   - Synchronous (see design note above).
 *   - Safe to call concurrently from the dispatch loop (no shared mutable
 *     state between calls beyond the backing store itself).
 *   - Idempotent on set(): calling set(key, ttl) twice with the same key
 *     should be safe (overwrite or no-op are both acceptable).
 */
export interface DedupStore {
  /**
   * Returns true if the key is present AND has not expired.
   *
   * Implementations MUST:
   *   - Return false for keys that have never been set.
   *   - Return false for keys whose TTL has elapsed.
   *   - Return true for live keys (set within their TTL window).
   *
   * @param key - The dedup key (from _buildDedupKey in alertDedup.ts).
   * @returns   true → key is live (duplicate); false → key is absent/expired.
   */
  has(key: string): boolean;

  /**
   * Record that a key has been dispatched, with an associated TTL.
   *
   * Implementations MUST:
   *   - Store the key so that has(key) returns true for the next `ttlMs` ms.
   *   - Overwrite an existing entry if the key is already set (safe re-dispatch).
   *
   * The TTL is provided by the caller (alertDedup.ts) so that the store does
   * not need to know about severity-based cooldowns. The store is a pure
   * key/value layer — expiry policy lives in alertDedup.ts.
   *
   * @param key   - The dedup key to record.
   * @param ttlMs - Lifetime in milliseconds. The store should expire the key
   *                after this duration. In-memory: tracked via timestamp.
   *                Redis: use SETEX or SET ... PX ttlMs.
   */
  set(key: string, ttlMs: number): void;

  /**
   * Remove all entries from the store.
   *
   * Used by:
   *   - flushDedupCache() — test resets and manual operator re-notify.
   *
   * Implementations MUST clear the entire store, not just expired entries.
   */
  clear(): void;

  /**
   * Returns the number of live (non-expired) entries in the store.
   *
   * Used by dedupCacheSize() for diagnostics and tests.
   * In-memory: prune expired entries, then return Map size.
   * Redis: use DBSIZE or a keyspace scan — approximate is acceptable.
   */
  size(): number;
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY DEFAULT IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Backing entry stored per dedup key.
 * @internal
 */
interface CacheEntry {
  /** Unix timestamp (ms) when this entry was written. */
  setAt: number;
  /** Lifetime in ms — entry expires at setAt + ttlMs. */
  ttlMs: number;
}

/**
 * Default DedupStore — behaviourally identical to the original Map in alertDedup.ts.
 *
 * Expiry is passive: entries are checked (and evicted) on access (has/size),
 * not on a timer. This keeps the implementation zero-dependency and avoids
 * background timers that would need cleanup on hot-module reload.
 *
 * Memory is bounded naturally: only fired alerts produce entries, and entries
 * become stale after their TTL. Long-running sessions see at most one entry
 * per alert rule per cooldown period.
 */
export class InMemoryDedupStore implements DedupStore {
  private readonly _cache = new Map<string, CacheEntry>();

  has(key: string): boolean {
    const entry = this._cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.setAt >= entry.ttlMs) {
      // Passive eviction: entry has expired — remove and report absent.
      this._cache.delete(key);
      return false;
    }

    return true;
  }

  set(key: string, ttlMs: number): void {
    this._cache.set(key, { setAt: Date.now(), ttlMs });
  }

  clear(): void {
    this._cache.clear();
  }

  size(): number {
    // Prune expired entries before reporting size so the count is accurate.
    const now = Date.now();
    for (const [key, entry] of this._cache) {
      if (now - entry.setAt >= entry.ttlMs) {
        this._cache.delete(key);
      }
    }
    return this._cache.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE STORE — module-level singleton with injection point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The active DedupStore instance used by alertDedup.ts.
 *
 * Default: InMemoryDedupStore — no bootstrap call required.
 * Override: call setDedupStore() once at application startup to inject
 *           a persistent store (Redis, etc.).
 */
let _activeStore: DedupStore = new InMemoryDedupStore();

/**
 * Inject a custom DedupStore implementation.
 *
 * CALL PATTERN:
 *   Call once at application bootstrap — before any alert dispatch can occur.
 *   Never call inside a render path, hook, or component.
 *
 *   // instrumentation.ts or server startup:
 *   import { setDedupStore } from '@/lib/alertDedupStore';
 *   setDedupStore(new RedisDedupStore(redisClient));
 *
 * @param store - The DedupStore implementation to activate.
 */
export function setDedupStore(store: DedupStore): void {
  _activeStore = store;
}

/**
 * Returns the currently active DedupStore.
 *
 * Consumed by alertDedup.ts — call this inside isDuplicate() and
 * flushDedupCache() instead of operating on a private Map.
 *
 * @internal — not for direct use outside alertDedup.ts.
 */
export function getDedupStore(): DedupStore {
  return _activeStore;
}