import { z } from "zod";
import { FarcasterAction, FarcasterActionSchemaAny } from "./actions/cdp/social/farcaster";

/**
 * Schema for the options required to initialize the FarcasterAgentkit.
 */
export const FarcasterAgentkitOptions = z
  .object({
    apiKey: z
      .string()
      .min(1, "The Neynar API key for Farcaster is required")
      .describe("The Neynar API key for Farcaster"),
    managedSigner: z
      .string()
      .min(1, "The Neynar Managed Signer UUID for Farcaster is required")
      .describe("The Neynar Managed Signer UUID for Farcaster"),
  })
  .strip()
  .describe("Options for initializing FarcasterAgentkit");

/**
 * Schema for the environment variables required for FarcasterAgentkit.
 */
const EnvSchema = z.object({
  NEYNAR_API_KEY: z
    .string()
    .min(1, "NEYNAR_API_KEY is required")
    .describe("The Neynar API key for Farcaster"),
  NEYNAR_MANAGED_SIGNER: z
    .string()
    .min(1, "NEYNAR_MANAGED_SIGNER is required")
    .describe("The Neynar Managed Signer UUID for Farcaster"),
});

/**
 * Farcaster Agentkit
 */
export class FarcasterAgentkit {
  private config: z.infer<typeof FarcasterAgentkitOptions>;

  /**
   * Initializes a new instance of FarcasterAgentkit with the provided options.
   * If no options are provided, it attempts to load the required environment variables.
   *
   * @param options - Optional. The configuration options for the FarcasterAgentkit.
   * @throws An error if the provided options are invalid or if the environment variables cannot be loaded.
   */
  public constructor(options?: z.infer<typeof FarcasterAgentkitOptions>) {
    try {
      const env = EnvSchema.parse(process.env);

      options = {
        apiKey: options?.apiKey || env.NEYNAR_API_KEY!,
        managedSigner: options?.managedSigner || env.NEYNAR_MANAGED_SIGNER!,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => console.log(`Error: ${err.path[0]} is required`));
      }
      throw new Error("Farcaster config could not be loaded.");
    }

    if (!this.validateOptions(options)) {
      throw new Error("Farcaster Agentkit options could not be validated.");
    }

    this.config = options;
  }

  /**
   * Validates the provided options for the FarcasterAgentkit.
   *
   * @param options - The options to validate.
   * @returns True if the options are valid, otherwise false.
   */
  validateOptions(options: z.infer<typeof FarcasterAgentkitOptions>): boolean {
    try {
      FarcasterAgentkitOptions.parse(options);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => console.log("Error:", err.message));
      }

      return false;
    }

    return true;
  }

  /**
   * Executes a Farcaster action.
   *
   * @param action - The Farcaster action to execute.
   * @param args - The arguments for the action.
   * @returns The result of the execution.
   */
  async run<TActionSchema extends FarcasterActionSchemaAny>(
    action: FarcasterAction<TActionSchema>,
    args: TActionSchema,
  ): Promise<string> {
    return await action.func(args);
  }
}
