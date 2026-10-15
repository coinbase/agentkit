/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Resolves $ref references in a JSON Schema by inlining definitions.
 *
 * LLM function-calling APIs (OpenAI, Anthropic) reject schemas that contain
 * $ref pointers. zodToJsonSchema() produces $ref for recursive Zod types
 * (z.lazy). This utility inlines those references up to a configurable depth,
 * replacing deeper levels with a permissive empty schema.
 *
 * @param schema - A JSON Schema object, typically from zodToJsonSchema()
 * @param maxDepth - Maximum recursion depth for inlining (default: 3)
 * @returns A new JSON Schema with all $ref pointers resolved
 */
export function resolveJsonSchemaRefs(
  schema: Record<string, any>,
  maxDepth = 3,
): Record<string, any> {
  const definitions = schema.$defs || schema.definitions || {};

  /**
   * Recursively resolves $ref pointers in a JSON Schema node.
   *
   * @param node - The current schema node
   * @param refDepth - How many $ref expansions have occurred on the current path
   * @returns The resolved schema node
   */
  function resolve(node: any, refDepth: number): any {
    if (node == null || typeof node !== "object") {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map(item => resolve(item, refDepth));
    }

    // Handle $ref
    if (typeof node.$ref === "string") {
      const refPath = node.$ref;
      // Extract definition name from "#/$defs/Name" or "#/definitions/Name"
      const match = refPath.match(/^#\/(?:\$defs|definitions)\/(.+)$/);
      if (!match) {
        return node;
      }

      const defName = match[1];

      // Stop inlining at max depth
      if (refDepth >= maxDepth) {
        return {};
      }

      const def = definitions[defName];
      if (!def) {
        return node;
      }

      return resolve(def, refDepth + 1);
    }

    // Recurse into object properties
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$defs" || key === "definitions") {
        continue;
      }
      result[key] = resolve(value, refDepth);
    }
    return result;
  }

  return resolve(schema, 0);
}
