import { version } from "../../../package.json";
import { Coinbase, ExternalAddress } from "@coinbase/coinbase-sdk";
import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CdpProviderConfig, EvmWalletProvider } from "../../wallet-providers";
import { AddressReputationSchema, RequestFaucetFundsSchema } from "./schemas";

/**
 * CdpApiActionProvider is an action provider for CDP API.
 *
 * This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
 */
export class CdpApiActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the CdpApiActionProvider class.
   *
   * @param config - The configuration options for the CdpApiActionProvider.
   */
  constructor(config: CdpProviderConfig = {}) {
    super("cdp_api", []);

    if (config.apiKeyName && config.apiKeyPrivateKey) {
      Coinbase.configure({
        apiKeyName: config.apiKeyName,
        privateKey: config.apiKeyPrivateKey,
        source: "agentkit",
        sourceVersion: version,
      });
    } else {
      Coinbase.configureFromJson();
    }
  }

  /**
   * Check the reputation of an address.
   *
   * @param args - The input arguments for the action
   * @returns A string containing reputation data or error message
   */
  @CreateAction({
    name: "address_reputation",
    description: `
This tool checks the reputation of an address on a given network. It takes:

- network: The network to check the address on (e.g. "base-mainnet")
- address: The Ethereum address to check
`,
    schema: AddressReputationSchema,
  })
  async addressReputation(args: z.infer<typeof AddressReputationSchema>): Promise<string> {
    try {
      const address = new ExternalAddress(args.network, args.address);
      const reputation = await address.reputation();
      return reputation.toString();
    } catch (error) {
      return `Error checking address reputation: ${error}`;
    }
  }

  /**
   * Requests test tokens from the faucet for the default address in the wallet.
   *
   * @param walletProvider - The wallet provider to request funds from.
   * @param args - The input arguments for the action.
   * @returns A confirmation message with transaction details.
   */
  @CreateAction({
    name: "request_faucet_funds",
    description: `This tool will request test tokens from the faucet for the default address in the wallet. It takes the wallet and asset ID as input.
If no asset ID is provided the faucet defaults to ETH. Faucet is only allowed on 'base-sepolia' and can only provide asset ID 'eth' or 'usdc'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.`,
    schema: RequestFaucetFundsSchema,
  })
  async faucet(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RequestFaucetFundsSchema>,
  ): Promise<string> {
    try {
      const address = new ExternalAddress(
        walletProvider.getNetwork().networkId!,
        walletProvider.getAddress(),
      );

      const faucetTx = await address.faucet(args.assetId || undefined);

      const result = await faucetTx.wait();

      return `Received ${
        args.assetId || "ETH"
      } from the faucet. Transaction: ${result.getTransactionLink()}`;
    } catch (error) {
      return `Error requesting faucet funds: ${error}`;
    }
  }

  /**
   * Checks if the Cdp action provider supports the given network.
   *
   * @param _ - The network to check.
   * @returns True if the Cdp action provider supports the network, false otherwise.
   */
  supportsNetwork = (_: Network) => true;
}

export const cdpApiActionProvider = (config: CdpProviderConfig = {}) =>
  new CdpApiActionProvider(config);
