import { z } from "zod";
import { sendAnalyticsEvent } from "../analytics";
import { WalletProvider } from "../wallet-providers";
import { ActionProvider } from "./actionProvider";
import { CreateAction } from "./actionDecorator";

jest.mock("../analytics", () => ({
  sendAnalyticsEvent: jest.fn(),
}));

const TestActionSchema = z.object({
  value: z.string(),
});

const executeAction = jest.fn(async ({ value }: z.infer<typeof TestActionSchema>) => {
  return `executed: ${value}`;
});

/**
 * Action provider used to exercise the action decorator invocation path.
 */
class TestActionProvider extends ActionProvider {
  /**
   * Executes the test action.
   *
   * @param args - The action arguments.
   * @returns The action result.
   */
  @CreateAction({
    name: "execute",
    description: "Executes the test action.",
    schema: TestActionSchema,
  })
  async execute(args: z.infer<typeof TestActionSchema>): Promise<string> {
    return executeAction(args);
  }

  supportsNetwork = () => true;
}

describe("CreateAction", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("handles analytics failures without interrupting action invocation", async () => {
    const analyticsError = new Error("Analytics request failed");
    const unhandledRejections: unknown[] = [];
    const unhandledRejectionListener = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    (sendAnalyticsEvent as jest.Mock).mockRejectedValueOnce(analyticsError);
    process.on("unhandledRejection", unhandledRejectionListener);

    try {
      const actionProvider = new TestActionProvider("test", []);
      const [action] = actionProvider.getActions({} as WalletProvider);

      const result = await action.invoke({ value: "result" });
      await new Promise<void>(resolve => setImmediate(resolve));

      expect(executeAction).toHaveBeenCalledTimes(1);
      expect(executeAction).toHaveBeenCalledWith({ value: "result" });
      expect(result).toBe("executed: result");
      expect(sendAnalyticsEvent).toHaveBeenCalledWith({
        name: "agent_action_invocation",
        action: "invoke_action",
        component: "agent_action",
        action_name: "TestActionProvider_execute",
        class_name: "TestActionProvider",
        method_name: "execute",
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to track action invocation:",
        analyticsError,
      );
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.removeListener("unhandledRejection", unhandledRejectionListener);
    }
  });
});
