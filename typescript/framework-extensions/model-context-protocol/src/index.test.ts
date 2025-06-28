import { AgentKitMCPServer } from "./index";

// Mock AgentKit
jest.mock("@coinbase/agentkit", () => ({
  AgentKit: {
    from: jest.fn().mockResolvedValue({
      // Mock AgentKit instance
    })
  }
}));

describe("AgentKitMCPServer", () => {
  let server: AgentKitMCPServer;

  beforeEach(() => {
    server = new AgentKitMCPServer();
  });

  it("should create an instance", () => {
    expect(server).toBeInstanceOf(AgentKitMCPServer);
  });

  it("should return tools", async () => {
    const tools = await server.getTools();
    expect(tools).toBeInstanceOf(Array);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty("name");
    expect(tools[0]).toHaveProperty("description");
  });

  it("should handle tool calls", async () => {
    const result = await server.handleToolCall("test_tool", { arg: "value" });
    expect(result).toHaveProperty("content");
    expect(result.content[0]).toHaveProperty("type", "text");
  });
});
