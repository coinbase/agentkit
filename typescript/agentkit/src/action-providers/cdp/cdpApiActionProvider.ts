import { version } from "../../../package.json";
import { Coinbase, ExternalAddress } from "@coinbase/coinbase-sdk";
import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CdpProviderConfig, WalletProvider } from "../../wallet-providers";
import { AddressReputationSchema, RequestFaucetFundsSchema } from "./schemas";

/**
 * CdpApiActionProvider is an action provider for CDP API.
 *
 * This provider is used for any action that uses the CDP API, but does not require a CDP Wallet.
 */
export class CdpApiActionProvider extends ActionProvider<WalletProvider> {
  /**
   * Constructor for the CdpApiActionProvider class.
   *
   * @param config - The configuration options for the CdpApiActionProvider.
   */
  constructor(config: CdpProviderConfig = {}) {
    super("cdp_api", []);

    if (config.apiKeyId && config.apiKeySecret) {
      Coinbase.configure({
        apiKeyName: config.apiKeyId,
        privateKey: config.apiKeySecret?.replace(/\\n/g, "\n"),
        source: "agentkit",
        sourceVersion: version,
      });
    } else {
      Coinbase.configureFromJson({ source: "agentkit", sourceVersion: version });
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
    if (args.network.includes("solana")) {
      return "Address reputation is only supported on Ethereum networks.";
    }

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
Faucet is only allowed on 'base-sepolia' or 'solana-devnet'.
If fauceting on 'base-sepolia', user can only provide asset ID 'eth' or 'usdc', if no asset ID is provided, the faucet will default to 'eth'.
If fauceting on 'solana-devnet', user can only provide asset ID 'sol', if no asset ID is provided, the faucet will default to 'sol'.
You are not allowed to faucet with any other network or asset ID. If you are on another network, suggest that the user sends you some ETH
from another wallet and provide the user with your wallet details.`,
    schema: RequestFaucetFundsSchema,
  })
  async faucet(
    walletProvider: WalletProvider,
    args: z.infer<typeof RequestFaucetFundsSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();

    if (network.networkId !== "base-sepolia" && network.networkId !== "solana-devnet") {
      return `Faucet is only allowed on 'base-sepolia' or 'solana-devnet'.`;
    }

    try {
      const address = new ExternalAddress(
        walletProvider.getNetwork().networkId!,
        walletProvider.getAddress(),
      );

      const faucetTx = await address.faucet(args.assetId || undefined);

      const result = await faucetTx.wait({ timeoutSeconds: 60 });

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
   * NOTE: Network scoping is done at the action implementation level
   *
   * @param _ - The network to check.
   * @returns True if the Cdp action provider supports the network, false otherwise.
   */
  supportsNetwork = (_: Network) => true;
}

export const cdpApiActionProvider = (config: CdpProviderConfig = {}) =>
  new CdpApiActionProvider(config);
