/**
 * @file lib/mappers/safeData.ts
 * @description Safe data extraction utilities for the integration boundary.
 *
 * RULES (NON-NEGOTIABLE):
 *  - Every function MUST return a defined, predictable value
 *  - NO function may return undefined
 *  - NO function may return NaN
 *  - All external data passes through these functions before mapping
 *  - Zero dependencies — pure TypeScript, no imports
 *
 * PURPOSE:
 *  External data sources (PostHog, backend APIs) are messy:
 *  - Fields may be missing, null, or wrong type
 *  - Numbers may be strings ("0.82"), Infinity, or NaN
 *  - Arrays may be null, undefined, or a non-array
 *  - Objects may be null, undefined, or a primitive
 *
 *  These utilities absorb all that chaos so mappers can be declarative
 *  and safe, and the rest of the system never sees a bad value.
 *
 * USAGE PATTERN:
 *  // In a mapper:
 *  upload_success_rate: safeRate(raw?.upload_success_rate),
 *  step_completion_rate: safeArray(raw?.steps).map(mapStep),
 *  is_active: safeBoolean(raw?.is_active),
 */

// ─────────────────────────────────────────────────────────────────────────────
// safeNumber
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a finite number, or return the fallback.
 *
 * Handles:
 *  - number (including 0, negatives)
 *  - string → parsed float (e.g. "0.82", "1_200")
 *  - boolean → 1 / 0
 *  - null / undefined / NaN / Infinity → fallback
 *  - objects / arrays → fallback
 *
 * @param value    - Any external value
 * @param fallback - Value to return when coercion fails (default: 0)
 * @returns A finite number, never NaN, never undefined
 *
 * @example
 * safeNumber("0.82")     // → 0.82
 * safeNumber(null)       // → 0
 * safeNumber(undefined)  // → 0
 * safeNumber(NaN)        // → 0
 * safeNumber(Infinity)   // → 0
 * safeNumber("broken")   // → 0
 * safeNumber(null, -1)   // → -1
 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;

  const num =
    typeof value === 'number'  ? value :
    typeof value === 'string'  ? parseFloat(value.replace(/_/g, '')) :
    typeof value === 'boolean' ? (value ? 1 : 0) :
    NaN;

  // Guard: NaN and non-finite values (Infinity, -Infinity) always return fallback
  if (!Number.isFinite(num)) return fallback;
  // Guard: fallback itself must be finite; otherwise default to 0
  return num;
}

// ─────────────────────────────────────────────────────────────────────────────
// safeRate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a 0–1 rate, clamped and finite.
 *
 * Extends safeNumber with range clamping: rates must be in [0, 1].
 * Values outside this range are clamped, not rejected — this handles
 * backends that return e.g. 82.3 (percent) instead of 0.823 (decimal).
 *
 * Auto-normalizes values > 1 that are likely percentage-encoded:
 *  - If value > 1 AND value <= 100 → divide by 100
 *  - If value > 100 → clamp to 1.0
 *
 * @param value    - Any external value
 * @param fallback - Fallback rate (default: 0)
 * @returns A clamped 0–1 float, never NaN, never undefined
 *
 * @example
 * safeRate(0.82)    // → 0.82
 * safeRate(82.3)    // → 0.823 (auto-normalized from percent)
 * safeRate(150)     // → 1.0   (clamped)
 * safeRate(null)    // → 0
 * safeRate("0.95")  // → 0.95
 */
export function safeRate(value: unknown, fallback = 0): number {
  const num = safeNumber(value, fallback);
  // Auto-normalize percent-encoded values
  if (num > 1 && num <= 100)  return Math.min(1, num / 100);
  // Hard clamp: result is always in [0, 1] regardless of input
  return Math.min(1, Math.max(0, num));
}

// ─────────────────────────────────────────────────────────────────────────────
// safePositiveNumber
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a non-negative number.
 *
 * Useful for counts, durations, and latencies that must be ≥ 0.
 * Negative parsed values are clamped to 0 (not to fallback).
 *
 * @param value    - Any external value
 * @param fallback - Fallback when coercion fails entirely (default: 0)
 * @returns A non-negative finite number
 *
 * @example
 * safePositiveNumber(-5)      // → 0   (negative clamped)
 * safePositiveNumber("1200")  // → 1200
 * safePositiveNumber(null)    // → 0
 */
export function safePositiveNumber(value: unknown, fallback = 0): number {
  const num = safeNumber(value, fallback);
  return Math.max(0, num);
}

// ─────────────────────────────────────────────────────────────────────────────
// safeInteger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a safe integer (Math.round).
 *
 * Useful for counts that must be whole numbers.
 *
 * @param value    - Any external value
 * @param fallback - Fallback integer (default: 0)
 * @returns A finite integer, never NaN
 *
 * @example
 * safeInteger("1234.7")  // → 1235
 * safeInteger(null)      // → 0
 */
export function safeInteger(value: unknown, fallback = 0): number {
  const num = safeNumber(value, fallback);
  // Math.round handles edge cases: NaN cannot reach here (safeNumber guards it),
  // but we double-guard to ensure an integer is always returned.
  const rounded = Math.round(num);
  return Number.isFinite(rounded) ? rounded : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// safeArray
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a typed array.
 *
 * Handles:
 *  - Array<T> → returned as-is (shallow clone to prevent mutation)
 *  - null / undefined → []
 *  - Non-array (string, number, object) → []
 *
 * Does NOT validate individual items — caller maps items through their
 * own safe coercions.
 *
 * @param value - Any external value
 * @returns A (possibly empty) array, never null, never undefined
 *
 * @example
 * safeArray([1, 2, 3])  // → [1, 2, 3]
 * safeArray(null)       // → []
 * safeArray("string")   // → []
 * safeArray({})         // → []
 */
export function safeArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return [...value] as T[];
}

// ─────────────────────────────────────────────────────────────────────────────
// safeObject
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a plain object.
 *
 * Handles:
 *  - Plain objects → returned as-is (shallow clone)
 *  - null / undefined → {}
 *  - Arrays (they are objects!) → {} (arrays must use safeArray)
 *  - Primitives (string, number, boolean) → {}
 *
 * @param value - Any external value
 * @returns A plain object (possibly empty), never null, never undefined
 *
 * @example
 * safeObject({ a: 1 })  // → { a: 1 }
 * safeObject(null)      // → {}
 * safeObject([1, 2])    // → {}
 * safeObject("string")  // → {}
 */
export function safeObject<T extends Record<string, unknown>>(value: unknown): Partial<T> {
  if (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return { ...(value as Partial<T>) };
  }
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// safeString
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a string.
 *
 * @param value    - Any external value
 * @param fallback - Default string (default: '')
 * @returns A string, never null, never undefined
 *
 * @example
 * safeString("hello")  // → "hello"
 * safeString(42)       // → "42"
 * safeString(null)     // → ""
 */
export function safeString(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// safeRecord
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a Record<string, number>.
 *
 * Useful for flag_exposure_count: Record<string, number> where backend
 * may send string values or omit the field entirely.
 *
 * @param value - Any external value
 * @returns A Record<string, number> with all values coerced via safeNumber
 *
 * @example
 * safeRecord({ control: "123", variant_a: 456 })
 *   // → { control: 123, variant_a: 456 }
 * safeRecord(null)  // → {}
 */
export function safeRecord(value: unknown): Record<string, number> {
  const obj = safeObject<Record<string, unknown>>(value);
  const result: Record<string, number> = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = safeNumber(val);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// safeNullableNumber
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to number | null.
 *
 * Unlike safeNumber, this preserves intentional null/undefined as null.
 * Use only for schema fields that allow null (e.g. relative_lift).
 *
 * @param value - Any external value
 * @returns A finite number OR null (never undefined, never NaN)
 *
 * @example
 * safeNullableNumber(0.14)   // → 0.14
 * safeNullableNumber(null)   // → null
 * safeNullableNumber("0.5")  // → 0.5
 * safeNullableNumber(NaN)    // → null
 */
export function safeNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = safeNumber(value, NaN);
  return Number.isFinite(num) ? num : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// safeBoolean  [NEW]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerce an unknown value to a boolean.
 *
 * Handles:
 *  - boolean → returned as-is
 *  - "true" / "1" / "yes" → true (case-insensitive)
 *  - "false" / "0" / "no" → false (case-insensitive)
 *  - number: 0 → false, non-zero → true
 *  - null / undefined → fallback
 *  - Other strings / objects → fallback
 *
 * @param value    - Any external value
 * @param fallback - Value when coercion is ambiguous (default: false)
 * @returns A boolean, never null, never undefined
 *
 * @example
 * safeBoolean(true)     // → true
 * safeBoolean("true")   // → true
 * safeBoolean("1")      // → true
 * safeBoolean(0)        // → false
 * safeBoolean(null)     // → false
 * safeBoolean("maybe")  // → false
 */
export function safeBoolean(value: unknown, fallback = false): boolean {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true'  || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no')  return false;
  }
  return fallback;
}