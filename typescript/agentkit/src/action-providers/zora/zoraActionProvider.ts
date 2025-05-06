import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { CreateCoinSchema } from "./schemas";
import { CreateAction } from "../actionDecorator";
import { Hex, parseUnits, encodeFunctionData } from "viem";
import { Network } from "../../network";
import { generateZoraTokenUri } from "./utils";

const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

export interface ZoraActionProviderConfig {
  /**
   * Pinata JWT for IPFS uploads
   */
  pinataJwt?: string;
}

/**
 * ZoraActionProvider provides actions for interacting with the Zora protocol.
 */
export class ZoraActionProvider extends ActionProvider<EvmWalletProvider> {
  #pinataJwt: string;

  /**
   * Constructor for the ZoraActionProvider.
   *
   * @param config - The configuration options for the ZoraActionProvider.
   */
  constructor(config: ZoraActionProviderConfig) {
    super("zora", []);

    // Set Pinata JWT
    const pinataJwt = config.pinataJwt || process.env.PINATA_JWT;
    if (!pinataJwt) {
      throw new Error("PINATA_JWT is not configured. Required for IPFS uploads.");
    }
    this.#pinataJwt = pinataJwt;
  }

  /**
   * Creates a new Zora coin.
   *
   * @param walletProvider - The wallet provider to use for the transaction.
   * @param args - The input arguments for the action.
   * @returns A message containing the coin creation details.
   */
  @CreateAction({
    name: "coinIt",
    description: `
This tool will create a new Zora coin.
It takes the following parameters:
- name: The name of the coin
- symbol: The symbol of the coin
- image: Local image file path or URI (ipfs:// or https://)
- description: The description of the coin
- payoutRecipient: The address that will receive creator earnings (optional, defaults to the wallet address)
- platformReferrer: The address that will receive platform referrer fees (optional, defaults to 0x0000000000000000000000000000000000000000)
- initialPurchase: The initial purchase amount in whole units of ETH, e.g. 1.5 for 1.5 ETH (optional, defaults to 0)
- category: The category of the coin (optional, defaults to 'social')
The action will return the transaction hash, coin address, and deployment details upon success.
`,
    schema: CreateCoinSchema,
  })
  async createCoin(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateCoinSchema>,
  ): Promise<string> {
    try {
      // Generate token URI from local file or URI
      const { uri, imageUri } = await generateZoraTokenUri({
        name: args.name,
        symbol: args.symbol,
        description: args.description,
        image: args.image,
        category: args.category,
        pinataConfig: { jwt: this.#pinataJwt },
      });

      // Dynamically import Zora SDK
      const { createCoinCall, getCoinCreateFromLogs } = await import("@zoralabs/coins-sdk");

      // Create coin call
      const call = {
        name: args.name,
        symbol: args.symbol,
        uri: uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/"), // TODO:: remove replace when ZORA ipfs gateway is fixed
        payoutRecipient: (args.payoutRecipient as Hex) || walletProvider.getAddress(),
        platformReferrer:
          (args.platformReferrer as Hex) || "0x0000000000000000000000000000000000000000",
        initialPurchaseWei: parseUnits(args.initialPurchase || "0", 18),
      };
      const createCoinRequest = await createCoinCall(call);
      const { abi, functionName, address, args: callArgs, value } = createCoinRequest;
      const data = encodeFunctionData({ abi, functionName, args: callArgs });
      const txRequest = { to: address as Hex, data, value };

      // Send transaction
      const hash = await walletProvider.sendTransaction(txRequest);
      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      const deployment = getCoinCreateFromLogs(receipt);

      if (receipt.status === "success") {
        return JSON.stringify({
          success: true,
          transactionHash: hash,
          coinAddress: deployment?.coin,
          imageUri,
          uri,
          deployment,
        });
      } else {
        throw new Error("Coin creation transaction reverted");
      }
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Checks if the Zora action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Zora action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && SUPPORTED_NETWORKS.includes(network.networkId!);
}

/**
 * Factory function to create a new ZoraActionProvider instance.
 *
 * @param config - Configuration options for the ZoraActionProvider
 * @returns A new ZoraActionProvider instance
 */
export const zoraActionProvider = (config: ZoraActionProviderConfig) =>
  new ZoraActionProvider(config);
