import { resolveJsonSchemaRefs } from "./resolveJsonSchemaRefs";

describe("resolveJsonSchemaRefs", () => {
  it("returns schema unchanged when no $ref present", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
    };
    expect(resolveJsonSchemaRefs(schema)).toEqual(schema);
  });

  it("inlines a simple $ref", () => {
    const schema = {
      $ref: "#/$defs/Address",
      $defs: {
        Address: {
          type: "object",
          properties: {
            street: { type: "string" },
          },
        },
      },
    };
    const result = resolveJsonSchemaRefs(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        street: { type: "string" },
      },
    });
  });

  it("inlines recursive $ref up to maxDepth", () => {
    // Simulates zodToJsonSchema output for a recursive type like:
    // z.object({ value: z.string(), children: z.lazy(() => schema).array() })
    const schema = {
      $ref: "#/$defs/TreeNode",
      $defs: {
        TreeNode: {
          type: "object",
          properties: {
            value: { type: "string" },
            children: {
              type: "array",
              items: { $ref: "#/$defs/TreeNode" },
            },
          },
        },
      },
    };

    const result = resolveJsonSchemaRefs(schema, 2);

    // Depth 0: TreeNode inlined
    expect(result.type).toBe("object");
    expect(result.properties.value).toEqual({ type: "string" });

    // Depth 1: children[].items -> TreeNode inlined again
    expect(result.properties.children.type).toBe("array");
    expect(result.properties.children.items.type).toBe("object");
    expect(result.properties.children.items.properties.value).toEqual({ type: "string" });

    // Depth 2: hit maxDepth, replaced with empty schema
    expect(result.properties.children.items.properties.children.type).toBe("array");
    expect(result.properties.children.items.properties.children.items).toEqual({});
  });

  it("handles definitions key (not just $defs)", () => {
    const schema = {
      $ref: "#/definitions/Item",
      definitions: {
        Item: {
          type: "object",
          properties: { id: { type: "number" } },
        },
      },
    };
    const result = resolveJsonSchemaRefs(schema);
    expect(result).toEqual({
      type: "object",
      properties: { id: { type: "number" } },
    });
  });

  it("strips $defs from output", () => {
    const schema = {
      type: "object",
      properties: {
        child: { $ref: "#/$defs/Child" },
      },
      $defs: {
        Child: { type: "object", properties: { name: { type: "string" } } },
      },
    };
    const result = resolveJsonSchemaRefs(schema);
    expect(result.$defs).toBeUndefined();
    expect(result.definitions).toBeUndefined();
    expect(result.properties.child).toEqual({
      type: "object",
      properties: { name: { type: "string" } },
    });
  });

  it("handles null and primitive values", () => {
    expect(resolveJsonSchemaRefs({ type: "string" })).toEqual({ type: "string" });
  });

  it("handles union types with $ref", () => {
    const schema = {
      type: "object",
      properties: {
        value: {
          anyOf: [{ type: "string" }, { $ref: "#/$defs/Nested" }],
        },
      },
      $defs: {
        Nested: { type: "object", properties: { x: { type: "number" } } },
      },
    };
    const result = resolveJsonSchemaRefs(schema);
    expect(result.properties.value.anyOf).toEqual([
      { type: "string" },
      { type: "object", properties: { x: { type: "number" } } },
    ]);
  });
});
