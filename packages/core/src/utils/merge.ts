/**
 * Deep merge utility for JSON/JSONB objects
 *
 * Provides safe deep merging for nested objects with configurable array handling.
 * Designed for merging partial configuration updates into existing config objects.
 *
 * @example
 * ```ts
 * const existing = { build: { branch: "main", command: "npm build" }, runtime: { port: 3000 } };
 * const update = { build: { framework: "nextjs" } };
 * const merged = deepMerge(existing, update);
 * // Result: { build: { branch: "main", command: "npm build", framework: "nextjs" }, runtime: { port: 3000 } }
 * ```
 */

export interface DeepMergeOptions {
  /**
   * How to handle arrays when both target and source have arrays at the same path
   * - 'replace': Source array replaces target array (default, recommended for configs)
   * - 'merge': Arrays are concatenated (use with caution)
   */
  arrayMerge?: "replace" | "merge";
}

/**
 * Deep merges source into target
 *
 * Merge behavior:
 * - Primitive values (string, number, boolean, null): Replaced by source
 * - Objects: Recursively merged, preserving all properties
 * - Arrays: Replaced by default (or merged if arrayMerge: 'merge' is set)
 * - Undefined values in source: Skipped (don't overwrite target)
 *
 * @param target - The base object to merge into
 * @param source - Partial object with values to merge into target
 * @param options - Configuration options for merge behavior
 * @returns A new object with merged values (target is not mutated)
 */
export function deepMerge<T>(
  target: T,
  source: Partial<T>,
  options?: DeepMergeOptions
): T {
  const arrayMerge = options?.arrayMerge ?? "replace";

  // If source is null/undefined, return target as-is
  if (source === null || source === undefined) {
    return target;
  }

  // If source is a primitive or array (not a plain object), return it directly
  if (typeof source !== "object" || Array.isArray(source)) {
    return source as T;
  }

  // If target is null/undefined or not an object, return source
  if (target === null || typeof target !== "object" || Array.isArray(target)) {
    return source as T;
  }

  // Both are plain objects - merge them
  const result = { ...target } as Record<string, unknown>;

  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }

    const sourceValue = (source as Record<string, unknown>)[key];
    const targetValue = (target as Record<string, unknown>)[key];

    // Skip undefined values in source (don't delete from target)
    if (sourceValue === undefined) {
      continue;
    }

    // Both source and target are objects - recurse
    if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Partial<Record<string, unknown>>,
        options
      );
      continue;
    }

    // Handle arrays based on arrayMerge option
    if (Array.isArray(sourceValue)) {
      if (arrayMerge === "merge" && Array.isArray(targetValue)) {
        result[key] = [...targetValue, ...sourceValue];
      } else {
        // Replace mode (default) or target is not an array
        result[key] = sourceValue;
      }
      continue;
    }

    // Primitives or incompatible types - replace with source
    result[key] = sourceValue;
  }

  return result as T;
}
