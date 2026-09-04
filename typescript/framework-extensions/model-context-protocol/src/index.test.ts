import { z } from "zod";
import { getMcpTools } from "./index";
import { AgentKit } from "@coinbase/agentkit";

/**
 * Standalone ref resolver for test assertions. Mirrors the real utility
 * but avoids loading the full `@coinbase/agentkit` module (ESM-only deps).
 *
 * @param schema - JSON Schema object to resolve
 * @param maxDepth - Maximum ref expansion depth
 * @returns Resolved schema
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveJsonSchemaRefs(schema: Record<string, any>, maxDepth = 5): Record<string, any> {
  const definitions = schema.$defs || schema.definitions || {};
  /**
   * Recursively resolves $ref pointers in a schema node.
   *
   * @param node - Current schema node
   * @param depth - Current expansion depth
   * @returns Resolved node
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolve(node: any, depth: number): any {
    if (node == null || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(item => resolve(item, depth));
    if (typeof node.$ref === "string") {
      const match = node.$ref.match(/^#\/(?:\$defs|definitions)\/(.+)$/);
      if (!match) return node;
      if (depth >= maxDepth) return {};
      const def = definitions[match[1]];
      return def ? resolve(def, depth + 1) : node;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$defs" || key === "definitions") continue;
      result[key] = resolve(value, depth);
    }
    return result;
  }
  return resolve(schema, 0);
}

// Mock AgentKit before importing - this prevents loading ES-only dependencies
jest.mock("@coinbase/agentkit", () => ({
  AgentKit: {
    from: jest.fn(),
  },
  resolveJsonSchemaRefs,
}));

// Define mock action after imports
const mockAction = {
  name: "testAction",
  description: "A test action",
  schema: z.object({ test: z.string() }),
  invoke: jest.fn(async (arg: { test: string }) => `Invoked with ${arg.test}`),
};

// Configure the mock
(AgentKit.from as jest.Mock).mockImplementation(() => ({
  getActions: jest.fn(() => [mockAction]),
}));

describe("getMcpTools", () => {
  it("should return an array of tools and a tool handler with correct properties", async () => {
    const mockAgentKit = await AgentKit.from({});
    const { tools, toolHandler } = await getMcpTools(mockAgentKit);

    expect(tools).toHaveLength(1);
    const tool = tools[0];

    expect(tool.name).toBe(mockAction.name);
    expect(tool.description).toBe(mockAction.description);
    expect(tool.inputSchema).toStrictEqual(
      resolveJsonSchemaRefs(z.toJSONSchema(mockAction.schema) as Record<string, unknown>),
    );

    const result = await toolHandler("testAction", { test: "data" });
    expect(result).toStrictEqual({ content: [{ text: '"Invoked with data"', type: "text" }] });
  });

  it("should resolve $ref pointers in schemas with shared sub-types", async () => {
    // Simulate a schema that produces $ref when converted to JSON Schema
    const subSchema = z.object({ value: z.string() });
    const actionWithRefs = {
      name: "refAction",
      description: "Action with shared schema refs",
      schema: z.object({
        single: subSchema,
        list: z.array(subSchema),
      }),
      invoke: jest.fn(async () => "ok"),
    };

    (AgentKit.from as jest.Mock).mockImplementationOnce(() => ({
      getActions: jest.fn(() => [actionWithRefs]),
    }));

    const mockAgentKit = await AgentKit.from({});
    const { tools } = await getMcpTools(mockAgentKit);

    const inputSchema = tools[0].inputSchema as Record<string, unknown>;
    // After resolution, there should be no $ref or $defs in the output
    const schemaStr = JSON.stringify(inputSchema);
    expect(schemaStr).not.toContain("$ref");
    expect(schemaStr).not.toContain("$defs");
    expect(schemaStr).not.toContain('"definitions"');
  });
});
