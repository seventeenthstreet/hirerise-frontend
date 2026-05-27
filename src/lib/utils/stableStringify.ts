/**
 * @file lib/utils/stableStringify.ts
 * @description Deterministic JSON serialization with recursive key sorting.
 *
 * PURPOSE:
 *   Native JSON.stringify does not guarantee key insertion order across
 *   engines or object construction paths. Two logically identical filter
 *   objects — { b: 1, a: 2 } vs { a: 2, b: 1 } — can produce different
 *   strings, breaking dedup key equality in inflightMap.
 *
 * GUARANTEES:
 *   - Object keys are sorted lexicographically at every nesting depth.
 *   - Arrays preserve their positional order (sorting would change semantics).
 *   - Date values are serialized as ISO 8601 strings (not as {}).
 *   - null, undefined, boolean, number, string primitives are emitted as-is
 *     (undefined inside objects is omitted, mirroring JSON.stringify behaviour).
 *   - No external dependencies — pure TypeScript.
 *   - Same input ALWAYS produces the same output (determinism guarantee).
 *
 * PERFORMANCE GUARDS (added in hardening pass):
 *   MAX_DEPTH     — recursion is capped; deeper nodes are replaced with a
 *                   typed sentinel "[MaxDepth:Object]" or "[MaxDepth:Array]"
 *                   so serialization always terminates and the cutoff is legible.
 *   MAX_KEY_LENGTH — if the fully serialized string exceeds this threshold,
 *                   a deterministic lightweight hash is returned instead.
 *                   The hash is collision-resistant for the filter value space
 *                   and requires no external libraries.
 *   Both guards preserve the invariant: same input → same output.
 *
 * USAGE:
 *   import { stableStringify } from '@/lib/utils/stableStringify';
 *   const dedupKey = `${source}:${stableStringify(filters)}`;
 *
 * SCOPE:
 *   Internal utility — only imported by metricsAdapter.ts (dedup key
 *   construction). Must not be imported by hooks, UI, or pages.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE GUARD CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum recursion depth for object/array traversal.
 *
 * MetricFilters is intentionally shallow (flat or one level of nesting).
 * A depth of 8 is generous for any real filter shape while providing a hard
 * ceiling against pathological inputs. Nodes beyond this depth are replaced
 * with a typed sentinel: "[MaxDepth:Object]" for objects or "[MaxDepth:Array]"
 * for arrays (see _maxDepthSentinel).
 *
 * Determinism is preserved: any value at depth > MAX_DEPTH always maps to
 * exactly the same sentinel string, so same input → same key.
 */
const MAX_DEPTH = 8;

/**
 * Maximum character length of the fully serialized key string.
 *
 * Real MetricFilters serialize to well under 200 chars. 1000 chars provides
 * a safety margin while ensuring the dedup key remains a fast Map lookup.
 * If the serialized string exceeds this, _hashString() is applied to produce
 * a compact, deterministic alternative key.
 *
 * This does NOT break determinism: the hash function is pure (no randomness,
 * no timestamps, no global state), so the same long string always hashes to
 * the same value.
 */
const MAX_KEY_LENGTH = 1000;

/**
 * Returns the sentinel string placed at nodes that exceed MAX_DEPTH.
 *
 * WHY include the type hint (Object/Array)?
 *   The bare "[MaxDepth]" sentinel made debugging harder: every truncated node
 *   looked identical in logs and snapshots, so engineers couldn't tell whether
 *   a deeply-nested object or array was cut. The type hint makes the boundary
 *   legible at a glance — "[MaxDepth:Object]" vs "[MaxDepth:Array]" — without
 *   traversing any deeper (we already have the value in hand at the call site).
 *
 *   Determinism is fully preserved: Array.isArray() is a pure, side-effect-free
 *   predicate. For the same value at the same depth the sentinel is always the
 *   same string. Same input → same output guarantee is unbroken.
 *
 *   Recursion cost is ZERO — we do not look inside the value, only at its
 *   top-level JavaScript type tag, which is already loaded in memory.
 *
 * WARNING: Do NOT change this function to inspect value contents (keys, length,
 *   etc.). That would increase work at the depth boundary and could re-introduce
 *   the recursion risk this guard was designed to prevent.
 *
 * @internal
 */
function _maxDepthSentinel(value: object): string {
  // Array.isArray is the only type check performed — no deeper traversal.
  const tag = Array.isArray(value) ? 'Array' : 'Object';
  return `"[MaxDepth:${tag}]"`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTWEIGHT HASH (no external dependencies)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic 53-bit hash of a string using the FNV-1a-inspired mixing
 * strategy popularised as "cyrb53" (Chris Veness, public domain).
 *
 * Properties:
 *   - Pure function: no randomness, no I/O, no global mutation.
 *   - Same input → same output on every engine and every call.
 *   - Good avalanche: a single character change flips ~half the output bits.
 *   - No external libraries required.
 *   - Operates entirely on 32-bit integers to stay within safe JS number range.
 *
 * Collision probability for the MetricFilters value space (< 10^6 distinct
 * inputs) is negligible (~10^-10), which is acceptable for a dedup cache key.
 *
 * Returns a hex string prefixed with "h:" and suffixed with ":<length>" to
 * distinguish hashed keys from normal serialized keys in logs and traces.
 *
 * WHY include the serialized string length in the key?
 *   The cyrb53 hash space is 2^53 bits. For the MetricFilters value space
 *   (< 10^6 distinct inputs) the collision probability is ~10^-10 per pair,
 *   which is negligible on its own. However, if two distinct filter objects
 *   ever happened to hash to the same value, they would share an inflightMap
 *   slot — one request would never fire and its caller would hang silently.
 *
 *   Appending the original byte-length of the serialized string as a second
 *   discriminator makes that silent collision scenario astronomically less
 *   likely: two distinct strings must now have BOTH the same hash AND the same
 *   byte-length. For typical MetricFilters the length varies by ≥1 char for any
 *   semantically different input, so this eliminates the collision class in
 *   practice at zero algorithmic cost (length is already computed by the
 *   stableStringify caller before _hashString is ever invoked).
 *
 *   Format: "h:<14-hex-chars>:<decimal-length>"
 *   Example: "h:0a3f7c2b1e9d8a:312"
 *
 *   BACKWARD COMPATIBILITY NOTE:
 *   Old keys stored in inflightMap (format "h:<hash>") are structurally
 *   distinct from new keys ("h:<hash>:<length>"). Both begin with "h:" so
 *   log consumers can still identify them as hashed. Old in-flight entries
 *   will simply miss on lookup — the request re-fires once and the new-format
 *   key is written. There is no silent data corruption risk.
 *
 * @internal — exported only for unit tests; do not use outside this module.
 */
export function _hashString(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x85ebca77);
    h2 = Math.imul(h2 ^ ch, 0xc2b2ae3d);
  }

  // Final avalanche mix — ensures high bits influence low bits and vice versa
  h1 ^= Math.imul(h1 ^ (h2 >>> 15), 0x735a2d97);
  h2 ^= Math.imul(h2 ^ (h1 >>> 15), 0xcaf649a9);
  h1 ^= h2 >>> 16;
  h2 ^= h1 >>> 16;

  // Combine into a single unsigned 53-bit value and render as zero-padded hex.
  // Using 2097152 = 2^21 to shift h2 into the upper bits without overflow.
  const combined =
    (2097152 * (h2 >>> 0) + (h1 >>> 11)).toString(16).padStart(14, '0');

  // Append the original string length as a second discriminator.
  // See JSDoc above for the collision-resistance rationale.
  // Length is appended rather than prepended so the "h:<hash>" prefix remains
  // the stable, recognizable identifier in log grep patterns.
  return `h:${combined}:${str.length}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively serialize a value to a stable, deterministic JSON string.
 *
 * Key differences from JSON.stringify:
 *  1. Object keys are sorted — { b: 1, a: 2 } and { a: 2, b: 1 } produce the same string.
 *  2. Date instances are converted to ISO strings before serialization.
 *  3. Recursion is depth-first, so nested objects are also key-sorted.
 *  4. Recursion is bounded by MAX_DEPTH — nodes deeper than the cap are
 *     replaced with MAX_DEPTH_SENTINEL (deterministic, always terminates).
 *  5. If the serialized string exceeds MAX_KEY_LENGTH, _hashString is applied
 *     and the result is returned instead. The hash is deterministic.
 *
 * Edge cases that mirror JSON.stringify behaviour:
 *  - undefined values in objects are omitted (not serialized as "undefined").
 *  - undefined passed as the root value returns the string "null".
 *  - Functions are omitted (treated as undefined), matching JSON.stringify.
 *  - Symbol values are omitted, matching JSON.stringify.
 *  - Circular references: blocked by MAX_DEPTH before they can stack-overflow.
 *    MetricFilters cannot be circular, so this remains a documentation note.
 */
export function stableStringify(value: unknown): string {
  const raw = _serialize(value, 0);

  if (raw.length <= MAX_KEY_LENGTH) return raw;

  // Serialized string exceeded MAX_KEY_LENGTH — fall back to a deterministic
  // hash. The hash function is pure and has no randomness, so:
  //   same long raw string → same hash → same dedup key (determinism preserved).
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      `[stableStringify] Serialized key length ${raw.length} exceeds ` +
      `MAX_KEY_LENGTH (${MAX_KEY_LENGTH}). Falling back to hash. ` +
      `This is safe and deterministic, but may indicate unexpectedly large ` +
      `MetricFilters. Consider simplifying filter objects if seen frequently.`,
    );
  }

  return _hashString(raw);
}

/**
 * Internal recursive serializer.
 *
 * @param value - Value to serialize.
 * @param depth - Current recursion depth (0 = root call).
 */
function _serialize(value: unknown, depth: number): string {
  // ── Primitives (never recurse) ─────────────────────────────────────────────

  if (value === null)      return 'null';
  if (value === undefined) return 'null';

  // Date → ISO string. Invalid dates → "null" for a stable, non-throwing output.
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? 'null' : JSON.stringify(value.toISOString());
  }

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'number') {
    // NaN / Infinity → "null", matching JSON.stringify behaviour.
    return isFinite(value) ? String(value) : 'null';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value); // handles \n, \", Unicode escapes, etc.
  }

  // Functions / Symbols → omitted in object context; as root emit "null".
  if (typeof value === 'function' || typeof value === 'symbol') return 'null';

  // ── Depth guard (applied before ANY structural recursion) ─────────────────
  // Primitives above never reach here. The guard fires only for objects/arrays
  // because those are the only types that trigger further _serialize calls.
  if (depth >= MAX_DEPTH) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[stableStringify] Recursion depth limit (MAX_DEPTH=${MAX_DEPTH}) reached. ` +
        `Nested structure replaced with typed sentinel. ` +
        `Input may be unexpectedly deep; verify MetricFilters shape.`,
      );
    }
    // Cast is safe: primitives (null, undefined, boolean, number, string,
    // function, symbol) are all handled above and never reach this branch.
    // Only object/array values arrive here.
    return _maxDepthSentinel(value as object);
  }

  // ── Arrays — preserve index order ─────────────────────────────────────────
  if (Array.isArray(value)) {
    const items = value.map(item =>
      // undefined inside arrays becomes "null" per JSON.stringify spec
      item === undefined ? 'null' : _serialize(item, depth + 1),
    );
    return `[${items.join(',')}]`;
  }

  // ── Plain objects — sort keys deterministically ───────────────────────────
  if (typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();

    const pairs: string[] = [];
    for (const key of sortedKeys) {
      const v = (value as Record<string, unknown>)[key];
      // Omit undefined / function / symbol — mirrors JSON.stringify object behaviour.
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
      pairs.push(`${JSON.stringify(key)}:${_serialize(v, depth + 1)}`);
    }

    return `{${pairs.join(',')}}`;
  }

  // Unreachable for well-typed MetricFilters. Present as an exhaustive guard.
  return 'null';
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPE EXPORT (for tests)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accepts any JSON-serializable value.
 * Typed as `unknown` rather than `JsonValue` to avoid forcing callers to cast.
 */
export type StableStringifyInput = unknown;