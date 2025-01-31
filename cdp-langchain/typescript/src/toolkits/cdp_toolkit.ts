import { StructuredToolInterface, BaseToolkit as Toolkit } from "@langchain/core/tools";
import { CDP_ACTIONS, CdpAgentkit } from "@coinbase/cdp-agentkit-core";
import { CdpTool } from "../tools/cdp_tool";

/**
 * Coinbase Developer Platform (CDP) Toolkit.
 *
 * Security Note: This toolkit contains tools that can read and modify
 * the state of a service; e.g., by creating, deleting, or updating,
 * reading underlying data.
 *
 * For example, this toolkit can be used to create wallets, transactions,
 * and smart contract invocations on CDP supported blockchains.
 *
 * Setup:
 * You will need to set the following environment variables:
 * ```bash
 * export CDP_API_KEY_NAME="cdp-api-key-name"
 * export CDP_API_KEY_PRIVATE_KEY="cdp-api-key-private-key"
 * export NETWORK_ID="network-id"
 * ```
 *
 * Example usage:
 * ```typescript
 * const agentkit = await CdpAgentkit.configureWithWallet();
 * const toolkit = new CdpToolkit(agentkit);
 * const tools = toolkit.getTools();
 *
 * // Available tools include:
 * // - get_wallet_details
 * // - get_balance
 * // - get_balance_nft
 * // - request_faucet_funds
 * // - transfer
 * // - transfer_nft
 * // - trade
 * // - deploy_token
 * // - deploy_contract
 * // - mint_nft
 * // - deploy_nft
 * // - register_basename
 * // - wow_create_token
 * // - wow_buy_token
 * // - wow_sell_token
 * // - wrap_eth
 * // - get_price_inference
 * // - get_all_topics
 * ```
 */
export class CdpToolkit extends Toolkit {
  tools: StructuredToolInterface[];

  /**
   * Creates a new CDP Toolkit instance
   *
   * @param agentkit - CDP agentkit instance
   */
  constructor(agentkit: CdpAgentkit) {
    super();
    const actions = CDP_ACTIONS;
    const tools = actions.map(action => new CdpTool(action, agentkit));
    this.tools = tools;
  }
}
