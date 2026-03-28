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

  it("inlines a simple $ref from $defs", () => {
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
    expect(resolveJsonSchemaRefs(schema)).toEqual({
      type: "object",
      properties: {
        street: { type: "string" },
      },
    });
  });

  it("inlines a simple $ref from definitions", () => {
    const schema = {
      $ref: "#/definitions/Item",
      definitions: {
        Item: {
          type: "object",
          properties: { id: { type: "number" } },
        },
      },
    };
    expect(resolveJsonSchemaRefs(schema)).toEqual({
      type: "object",
      properties: { id: { type: "number" } },
    });
  });

  it("inlines recursive $ref up to maxDepth", () => {
    // Simulates zodToJsonSchema output for:
    //   z.object({ value: z.string(), children: z.lazy(() => schema).array() })
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
    expect(result.properties.children.items.type).toBe("object");
    expect(result.properties.children.items.properties.value).toEqual({ type: "string" });

    // Depth 2: hit maxDepth, replaced with permissive empty schema
    expect(result.properties.children.items.properties.children.items).toEqual({});
  });

  it("handles shared sub-schemas referenced multiple times in a union", () => {
    // Reproduces the exact scenario from issue #815: a sub-schema used twice
    // in a union causes zodToJsonSchema to emit $ref for both occurrences
    const schema = {
      type: "object",
      properties: {
        value: {
          anyOf: [
            { type: "string" },
            { $ref: "#/$defs/SubSchema" },
            { type: "array", items: { $ref: "#/$defs/SubSchema" } },
          ],
        },
      },
      $defs: {
        SubSchema: {
          type: "object",
          additionalProperties: {
            anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
          },
        },
      },
    };

    const result = resolveJsonSchemaRefs(schema);

    // Both $ref occurrences should be inlined
    expect(result.properties.value.anyOf[1]).toEqual({
      type: "object",
      additionalProperties: {
        anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
      },
    });
    expect(result.properties.value.anyOf[2].items).toEqual({
      type: "object",
      additionalProperties: {
        anyOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
      },
    });
  });

  it("strips $defs and definitions from output", () => {
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

  it("passes through primitive schemas unchanged", () => {
    expect(resolveJsonSchemaRefs({ type: "string" })).toEqual({ type: "string" });
    expect(resolveJsonSchemaRefs({ type: "number" })).toEqual({ type: "number" });
  });

  it("preserves unrecognized $ref paths", () => {
    const schema = { $ref: "https://example.com/schema.json" };
    expect(resolveJsonSchemaRefs(schema)).toEqual(schema);
  });

  it("handles null and undefined values in schema nodes", () => {
    const schema = {
      type: "object",
      properties: {
        a: null,
        b: { type: "string", default: null },
      },
    };
    expect(resolveJsonSchemaRefs(schema)).toEqual(schema);
  });

  it("uses default maxDepth of 5", () => {
    // Build a schema that chains 6 levels of $ref
    const schema = {
      $ref: "#/$defs/L0",
      $defs: {
        L0: { type: "object", properties: { next: { $ref: "#/$defs/L0" } } },
      },
    };

    const result = resolveJsonSchemaRefs(schema);

    // Walk 5 levels deep -- each should be resolved
    let node = result;
    for (let i = 0; i < 4; i++) {
      expect(node.type).toBe("object");
      node = node.properties.next;
    }
    // At depth 5, should be empty schema
    expect(node.properties.next).toEqual({});
  });
});
