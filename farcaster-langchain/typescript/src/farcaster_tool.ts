import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  FarcasterAction,
  FarcasterActionSchemaAny,
  FarcasterAgentkit,
} from "@coinbase/cdp-agentkit-core";

/**
 * This tool allows agents to interact with the Farcaster API and control an authenticated Farcaster account.
 *
 * To use this tool, you must first configure with proper options or
 * set the following environment variables:
 * - AGENT_FID
 * - NEYNAR_API_KEY
 * - NEYNAR_MANAGED_SIGNER
 */
export class FarcasterTool<TActionSchema extends FarcasterActionSchemaAny> extends StructuredTool {
  /**
   * Schema definition for the tool's input.
   */
  public schema: TActionSchema;

  /**
   * The name of the tool.
   */
  public name: string;

  /**
   * The description of the tool.
   */
  public description: string;

  /**
   * The Farcaster Agentkit instance.
   */
  private agentkit: FarcasterAgentkit;

  /**
   * The Farcaster Action.
   */
  private action: FarcasterAction<TActionSchema>;

  /**
   * Constructor for the Farcaster Tool class.
   *
   * @param action - The Farcaster action to execute.
   * @param agentkit - The Farcaster wrapper to use.
   */
  constructor(action: FarcasterAction<TActionSchema>, agentkit: FarcasterAgentkit) {
    super();

    this.action = action;
    this.agentkit = agentkit;
    this.name = action.name;
    this.description = action.description;
    this.schema = action.argsSchema;
  }

  /**
   * Executes the Farcaster action with the provided input.
   *
   * @param input - An object containing either instructions or schema-validated arguments.
   * @returns A promise that resolves to the result of the Farcaster action.
   */
  protected async _call(
    input: z.infer<typeof this.schema> & Record<string, unknown>,
  ): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let args: any;

      // If we have a schema, try to validate against it
      if (this.schema) {
        try {
          const validatedInput = this.schema.parse(input);
          args = validatedInput;
        } catch (validationError) {
          // If schema validation fails, fall back to instructions-only mode
          args = input;
        }
      }
      // No schema, use instructions mode
      else {
        args = input;
      }

      return await this.agentkit.run(this.action, args);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `Error executing ${this.name}: ${error.message}`;
      }
      return `Error executing ${this.name}: Unknown error occurred`;
    }
  }
}
