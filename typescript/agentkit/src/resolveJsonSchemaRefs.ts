/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Resolves `$ref` pointers in a JSON Schema by inlining their definitions.
 *
 * `zodToJsonSchema()` and `z.toJSONSchema()` emit `$ref` pointers when a Zod
 * type is referenced more than once (shared sub-schemas) or is recursive
 * (`z.lazy`). Several LLM function-calling APIs -- notably OpenAI -- reject
 * schemas that contain `$ref` with errors like "object schema missing
 * properties".
 *
 * This utility post-processes JSON Schema output by inlining every `$ref` up
 * to a configurable depth, replacing deeper levels with a permissive empty
 * schema (`{}`), and stripping the `$defs`/`definitions` block from the result.
 *
 * @param schema - A JSON Schema object, typically from `zodToJsonSchema()` or
 *   `z.toJSONSchema()`
 * @param maxDepth - Maximum number of `$ref` expansions per path (default: 5)
 * @returns A new JSON Schema with all `$ref` pointers resolved
 *
 * @example
 * ```typescript
 * import { resolveJsonSchemaRefs } from "@coinbase/agentkit";
 * import { zodToJsonSchema } from "zod-to-json-schema";
 *
 * const jsonSchema = zodToJsonSchema(myRecursiveZodSchema);
 * const resolved = resolveJsonSchemaRefs(jsonSchema);
 * // `resolved` contains no $ref -- safe for OpenAI function calling
 * ```
 */
export function resolveJsonSchemaRefs(
  schema: Record<string, any>,
  maxDepth = 5,
): Record<string, any> {
  const definitions = schema.$defs || schema.definitions || {};

  /**
   * Recursively resolves `$ref` pointers in a JSON Schema node.
   *
   * @param node - The current schema node to process
   * @param depth - Number of `$ref` expansions on the current path
   * @returns The resolved schema node with `$ref` pointers inlined
   */
  function resolve(node: any, depth: number): any {
    if (node == null || typeof node !== "object") {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map(item => resolve(item, depth));
    }

    // Resolve $ref by looking up the definition and inlining it
    if (typeof node.$ref === "string") {
      const match = node.$ref.match(/^#\/(?:\$defs|definitions)\/(.+)$/);
      if (!match) {
        return node;
      }

      if (depth >= maxDepth) {
        return {};
      }

      const def = definitions[match[1]];
      if (!def) {
        return node;
      }

      return resolve(def, depth + 1);
    }

    // Recurse into object properties, skipping the definitions block
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$defs" || key === "definitions") {
        continue;
      }
      result[key] = resolve(value, depth);
    }
    return result;
  }

  return resolve(schema, 0);
}
