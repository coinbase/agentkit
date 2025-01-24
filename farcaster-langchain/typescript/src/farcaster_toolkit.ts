import { StructuredToolInterface, BaseToolkit as Toolkit } from "@langchain/core/tools";
import { FARCASTER_ACTIONS, FarcasterAgentkit } from "@coinbase/cdp-agentkit-core";
import { FarcasterTool } from "./farcaster_tool";

/**
 * Farcaster Toolkit.
 *
 * Security Note: This toolkit contains tools that can read and modify
 * the state of a service; e.g., by creating, deleting, or updating,
 * reading underlying data.
 *
 * For example, this toolkit can be used to retrieve account details, post casts,
 * and anything else you can implement with the Farcaster API!
 *
 * Setup:
 * You will need to set the following environment variables:
 * ```bash
 * export OPENAI_API_KEY=<your-openai-api-key>
 * export AGENT_FID=<your-agents-fid>
 * export NEYNAR_API_KEY=<your-neynar-api-key>
 * export NEYNAR_MANAGED_SIGNER=<your-neynar-managed-signer>
 * ```
 *
 * Example usage:
 * ```typescript
 * // optional if not available via the ENV
 * const options = {
 *  agentFid: "<your-agents-fid>",
 *  neynarApiKey: "<your-neynar-api-key>",
 *  neynarManagedSigner: "<your-neynar-managed-signer>"
 * };
 *
 * const agentkit = await FarcasterAgentkit.configureWithOptions(options);
 * const toolkit = new FarcasterToolkit(agentkit);
 * const tools = toolkit.getTools();
 *
 * // Available tools include:
 * // - farcaster_account_details
 * // - farcaster_post_cast
 * ```
 */
export class FarcasterToolkit extends Toolkit {
  tools: StructuredToolInterface[];

  /**
   * Creates a new Farcaster Toolkit instance
   *
   * @param agentkit - Farcaster agentkit instance
   */
  constructor(agentkit: FarcasterAgentkit) {
    super();
    const actions = FARCASTER_ACTIONS;
    const tools = actions.map(action => new FarcasterTool(action, agentkit));
    this.tools = tools;
  }
}
