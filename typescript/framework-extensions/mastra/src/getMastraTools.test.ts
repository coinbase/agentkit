import { z } from "zod";
import { getMastraTools } from "./getMastraTools";
import { AgentKit } from "@coinbase/agentkit";

// Mock AgentKit before importing - this prevents loading ES-only dependencies
jest.mock("@coinbase/agentkit", () => ({
  AgentKit: {
    from: jest.fn(),
  },
}));

// Mock @mastra/core/tools
jest.mock("@mastra/core/tools", () => ({
  createTool: jest.fn((config: Record<string, unknown>) => ({
    id: config.id,
    description: config.description,
    inputSchema: config.inputSchema,
    execute: config.execute,
  })),
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

describe("getMastraTools", () => {
  it("should return a record of tools with correct properties", async () => {
    const mockAgentKit = await AgentKit.from({});
    const tools = getMastraTools(mockAgentKit);

    expect(tools).toHaveProperty("testAction");
    const tool = tools.testAction;

    expect(tool.id).toBe(mockAction.name);
    expect(tool.description).toBe(mockAction.description);
    expect(tool.inputSchema).toBe(mockAction.schema);

    // Test execution
    const result = await tool.execute!({ test: "data" });
    expect(result).toBe("Invoked with data");
  });

  it("should handle multiple actions", async () => {
    const secondAction = {
      name: "secondAction",
      description: "A second test action",
      schema: z.object({ value: z.number() }),
      invoke: jest.fn(async (arg: { value: number }) => `Value is ${arg.value}`),
    };

    (AgentKit.from as jest.Mock).mockImplementation(() => ({
      getActions: jest.fn(() => [mockAction, secondAction]),
    }));

    const mockAgentKit = await AgentKit.from({});
    const tools = getMastraTools(mockAgentKit);

    expect(Object.keys(tools)).toHaveLength(2);
    expect(tools).toHaveProperty("testAction");
    expect(tools).toHaveProperty("secondAction");

    const result = await tools.secondAction.execute!({ value: 42 });
    expect(result).toBe("Value is 42");
  });

  it("should return an empty record when no actions are available", async () => {
    (AgentKit.from as jest.Mock).mockImplementation(() => ({
      getActions: jest.fn(() => []),
    }));

    const mockAgentKit = await AgentKit.from({});
    const tools = getMastraTools(mockAgentKit);

    expect(Object.keys(tools)).toHaveLength(0);
  });
});
