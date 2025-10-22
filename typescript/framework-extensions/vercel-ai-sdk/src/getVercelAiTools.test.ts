import { z } from "zod";
import { getVercelAITools } from "./getVercelAiTools";
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

describe("getVercelAITools", () => {
  it("should return a record of tools with correct properties", async () => {
    const mockAgentKit = await AgentKit.from({});
    const tools = await getVercelAITools(mockAgentKit);

    expect(tools).toHaveProperty("testAction");
    const tool = tools.testAction;

    expect((tool as { description?: string }).description).toBe(mockAction.description);
    expect(tool.parameters).toBe(mockAction.schema);

    // Test execution with required options
    const result = await tool.execute!(
      { test: "data" },
      {
        abortSignal: new AbortController().signal,
        toolCallId: "test-call",
        messages: [],
      },
    );
    expect(result).toBe("Invoked with data");
  });
});
