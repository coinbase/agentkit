import { FarcasterToolkit } from "../farcaster_toolkit";
import { FarcasterTool } from "../farcaster_tool";
import {
  FarcasterAction,
  FarcasterActionSchemaAny,
  FarcasterAgentkit,
} from "@coinbase/cdp-agentkit-core";
import { z } from "zod";

describe("FarcasterToolkit", () => {
  let mockAgentkit: jest.Mocked<FarcasterAgentkit>;
  let mockActions: jest.Mocked<FarcasterAction<FarcasterActionSchemaAny>>[];
  let farcasterToolkit: FarcasterToolkit;

  beforeEach(() => {
    mockAgentkit = {
      run: jest.fn((action, args) => action.func(mockAgentkit, args)),
    } as unknown as jest.Mocked<FarcasterAgentkit>;

    mockActions = [
      {
        name: "farcaster_account_details",
        description: "Retrieve Farcaster account details",
        argsSchema: z.object({}),
        func: jest.fn().mockResolvedValue("Successfully retrieved Farcaster account details"),
      },
      {
        name: "farcaster_post_cast",
        description: "Post a new cast",
        argsSchema: z.object({ castText: z.string() }),
        func: jest.fn().mockResolvedValue("Cast posted successfully"),
      },
    ];

    farcasterToolkit = new FarcasterToolkit(mockAgentkit);
    farcasterToolkit.tools = mockActions.map(action => new FarcasterTool(action, mockAgentkit));
  });

  it("should initialize with correct tools", () => {
    expect(farcasterToolkit.tools).toHaveLength(mockActions.length);
    expect(farcasterToolkit.tools[0].name).toBe("farcaster_account_details");
    expect(farcasterToolkit.tools[1].name).toBe("farcaster_post_cast");
  });

  it("should execute action from toolkit", async () => {
    const tool = farcasterToolkit.tools[1];
    const args = { castText: "Hello world" };
    const response = await tool.call(args);

    expect(mockActions[1].func).toHaveBeenCalledWith(mockAgentkit, args);
    expect(response).toBe("Cast posted successfully");
  });

  it("should handle action execution failure", async () => {
    const error = new Error("Failed to post cast");
    mockActions[1].func.mockRejectedValue(error);

    const tool = farcasterToolkit.tools[1];
    const args = { castText: "Hello world" };
    const response = await tool.call(args);

    expect(response).toContain(`Error executing farcaster_post_cast: ${error.message}`);
  });

  it("should return all available tools", () => {
    const tools = farcasterToolkit.getTools();

    expect(tools).toHaveLength(mockActions.length);
    expect(tools[0].name).toBe("farcaster_account_details");
    expect(tools[1].name).toBe("farcaster_post_cast");
  });
});
