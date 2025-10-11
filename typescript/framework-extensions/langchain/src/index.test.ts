import { z } from "zod";
import { getLangChainTools } from "./index";
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

describe("getLangChainTools", () => {
  it("should return an array of tools with correct properties", async () => {
    const mockAgentKit = await AgentKit.from({});
    const tools = await getLangChainTools(mockAgentKit);

    expect(tools).toHaveLength(1);
    const tool = tools[0];

    expect(tool.name).toBe(mockAction.name);
    expect(tool.description).toBe(mockAction.description);
    expect(tool.schema).toBe(mockAction.schema);

    const result = await tool.invoke({ test: "data" });
    expect(result).toBe("Invoked with data");
  });
});
