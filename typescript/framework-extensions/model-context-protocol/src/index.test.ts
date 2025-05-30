import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getMcpTools } from "./index";
import { AgentKit, Action } from "@coinbase/agentkit";

// Mocking the Action class
const mockAction: Action = {
  name: "testAction",
  description: "A test action",
  schema: z.object({ test: z.string() }),
  invoke: jest.fn(async arg => `Invoked with ${arg.test}`),
};

// Creating a mock for AgentKit
jest.mock("@coinbase/agentkit", () => {
  const originalModule = jest.requireActual("@coinbase/agentkit");
  return {
    ...originalModule,
    AgentKit: {
      from: jest.fn().mockImplementation(() => ({
        getActions: jest.fn(() => [mockAction]),
      })),
    },
  };
});

describe("getMcpTools", () => {
  it("should return an array of tools and a tool handler with correct properties", async () => {
    const mockAgentKit = await AgentKit.from({});
    const { tools, toolHandler } = await getMcpTools(mockAgentKit);

    expect(tools).toHaveLength(1);
    const tool = tools[0];

    expect(tool.name).toBe(mockAction.name);
    expect(tool.description).toBe(mockAction.description);
    expect(tool.inputSchema).toStrictEqual(zodToJsonSchema(mockAction.schema));

    const result = await toolHandler("testAction", { test: "data" });
    expect(result).toStrictEqual({ content: [{ text: '"Invoked with data"', type: "text" }] });
  });

  it("should throw error when tool not found", async () => {
    const mockAgentKit = await AgentKit.from({});
    const { toolHandler } = await getMcpTools(mockAgentKit);

    await expect(toolHandler("nonExistentTool", {})).rejects.toThrow(
      "Tool nonExistentTool not found",
    );
  });

  it("should handle schema validation errors", async () => {
    const mockAgentKit = await AgentKit.from({});
    const { toolHandler } = await getMcpTools(mockAgentKit);

    await expect(toolHandler("testAction", { invalid: "data" })).rejects.toThrow(
      "Failed to execute tool testAction",
    );
  });

  it("should handle action invoke errors", async () => {
    const errorAction: Action = {
      name: "errorAction",
      description: "An action that throws error",
      schema: z.object({ test: z.string() }),
      invoke: jest.fn(async () => {
        throw new Error("Invoke failed");
      }),
    };

    // Update mock to include error action
    jest.mocked(AgentKit.from).mockImplementationOnce(
      () =>
        Promise.resolve({
          getActions: jest.fn(() => [mockAction, errorAction]),
        }) as unknown as AgentKit,
    );

    const mockAgentKit = await AgentKit.from({});
    const { toolHandler } = await getMcpTools(mockAgentKit);

    await expect(toolHandler("errorAction", { test: "data" })).rejects.toThrow(
      "Failed to execute tool errorAction: Invoke failed",
    );
  });
});
