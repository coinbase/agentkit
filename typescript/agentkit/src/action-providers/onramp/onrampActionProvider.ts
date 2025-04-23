/**
 * Onramp Action Provider
 *
 * This file contains the implementation of the OnrampActionProvider,
 * which provides actions for onramp operations.
 *
 * @module onramp
 */

import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { GetOnrampBuyUrlActionSchema } from "./schemas";
import { getOnrampBuyUrl, convertNetworkIdToOnrampNetworkId } from "./utils";

type OnrampActionProviderProps = {
  projectId: string;
};

/**
 * OnrampActionProvider provides actions for onramp operations.
 *
 * @description
 * This provider is designed to work with EvmWalletProvider for blockchain interactions.
 * It supports all evm networks.
 */
export class OnrampActionProvider extends ActionProvider<EvmWalletProvider> {
  private projectId: string;
  /**
   * Constructor for the OnrampActionProvider.
   *
   * @param props - The props for the OnrampActionProvider
   * @param props.projectId - The project ID for the OnrampActionProvider
   */
  constructor(props: OnrampActionProviderProps) {
    super("onramp", []);
    this.projectId = props.projectId;
  }

  /**
   * This action provides a link to buy more cryptocurrency (ETH, USDC, or BTC) using fiat currency (regular money like USD).
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param _ - The arguments for the action (not used)
   * @returns A promise that resolves to a string describing the action result
   */
  @CreateAction({
    name: "get_onramp_buy_url",
    description: `
      Get a URL to purchase more cryptocurrency when funds are low. This action provides a link to buy more 
      cryptocurrency, defaulting to ETH, using fiat currency (regular money like USD). 
      
      Use this when:
      - You detect that the wallet has insufficient funds for a transaction
      - You need to guide the user to purchase more cryptocurrency
      - The user asks how to buy more crypto
      
      The URL will direct to a secure Coinbase-powered purchase interface.
    `,
    schema: GetOnrampBuyUrlActionSchema,
  })
  async getOnrampBuyUrl(
    walletProvider: EvmWalletProvider,
    _: z.infer<typeof GetOnrampBuyUrlActionSchema> = {},
  ): Promise<string> {
    const networkId = walletProvider.getNetwork().networkId;
    if (!networkId) {
      throw new Error("Network ID is not set");
    }
    const network = convertNetworkIdToOnrampNetworkId(networkId);
    if (!network) {
      throw new Error(
        "Network ID is not supported. Make sure you are using a supported mainnet network.",
      );
    }

    return getOnrampBuyUrl({
      projectId: this.projectId,
      addresses: {
        [walletProvider.getAddress()]: [network],
      },
      defaultNetwork: network,
    });
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    return Boolean(
      network.networkId &&
        convertNetworkIdToOnrampNetworkId(network.networkId) !== null &&
        network.protocolFamily === "evm",
    );
  }
}

/**
 * Factory function to create a new OnrampActionProvider instance.
 *
 * @param props - The props for the OnrampActionProvider
 * @returns A new OnrampActionProvider instance
 */
export const onrampActionProvider = (props: OnrampActionProviderProps) =>
  new OnrampActionProvider(props);
