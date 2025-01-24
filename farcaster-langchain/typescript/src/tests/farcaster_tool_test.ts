import {
  FarcasterAction,
  FarcasterActionSchemaAny,
  FarcasterAgentkit,
} from "@coinbase/cdp-agentkit-core";
import { FarcasterTool } from "../farcaster_tool";
import { z } from "zod";

const MOCK_DESCRIPTION = "Farcaster Test Action";
const MOCK_NAME = "test_action";

describe("FarcasterTool", () => {
  let mockAgentkit: jest.Mocked<FarcasterAgentkit>;
  let mockAction: jest.Mocked<FarcasterAction<FarcasterActionSchemaAny>>;
  let farcasterTool: FarcasterTool<FarcasterActionSchemaAny>;

  beforeEach(() => {
    mockAgentkit = {
      run: jest.fn((action, args) => action.func(mockAgentkit, args)),
    } as unknown as jest.Mocked<FarcasterAgentkit>;

    mockAction = {
      name: MOCK_NAME,
      description: MOCK_DESCRIPTION,
      argsSchema: z.object({ test_param: z.string() }),
      func: jest.fn().mockResolvedValue("success"),
    } as unknown as jest.Mocked<FarcasterAction<FarcasterActionSchemaAny>>;

    farcasterTool = new FarcasterTool(mockAction, mockAgentkit);
  });

  it("should initialize with correct properties", () => {
    expect(farcasterTool.name).toBe(MOCK_NAME);
    expect(farcasterTool.description).toBe(MOCK_DESCRIPTION);
    expect(farcasterTool.schema).toEqual(mockAction.argsSchema);
  });

  it("should execute action with valid args", async () => {
    const args = { test_param: "test" };
    const response = await farcasterTool.call(args);

    expect(mockAction.func).toHaveBeenCalledWith(mockAgentkit, args);
    expect(response).toBe("success");
  });

  it("should handle schema validation errors", async () => {
    const invalidargs = { invalid_param: "test" };
    await expect(farcasterTool.call(invalidargs)).rejects.toThrow();
    expect(mockAction.func).not.toHaveBeenCalled();
  });

  it("should return error message on action execution failure", async () => {
    mockAction.func.mockRejectedValue(new Error("Execution failed"));
    const args = { test_param: "test" };
    const response = await farcasterTool.call(args);
    expect(response).toContain("Error executing test_action: Execution failed");
  });
});
