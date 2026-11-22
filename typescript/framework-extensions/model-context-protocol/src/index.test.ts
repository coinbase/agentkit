import { z } from "zod";
import { getMcpTools } from "./index";
import { AgentKit } from "@coinbase/agentkit";

// Mock AgentKit before importing - this prevents loading ES-only dependencies
jest.mock("@coinbase/agentkit", () => ({
  AgentKit: {
    from: jest.fn(),
  },
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
    expect(tool.inputSchema).toStrictEqual(z.toJSONSchema(mockAction.schema));

    const result = await toolHandler("testAction", { test: "data" });
    expect(result).toStrictEqual({ content: [{ text: '"Invoked with data"', type: "text" }] });
  });

  it("should build the input schema for actions using transforms or custom types", async () => {
    const transformAction = {
      ...mockAction,
      name: "transformAction",
      schema: z.object({
        slippageBps: z
          .number()
          .nullable()
          .transform(val => val ?? 100),
        address: z.custom<`0x${string}`>(val => typeof val === "string"),
      }),
    };
    (AgentKit.from as jest.Mock).mockImplementationOnce(() => ({
      getActions: jest.fn(() => [transformAction]),
    }));

    const { tools } = await getMcpTools(await AgentKit.from({}));

    expect(tools[0].inputSchema).toStrictEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        slippageBps: { anyOf: [{ type: "number" }, { type: "null" }] },
        address: {},
      },
      required: ["slippageBps", "address"],
      additionalProperties: false,
    });
  });
});
