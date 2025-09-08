import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { CreateCoinSchema } from "./schemas";
import { CreateAction } from "../actionDecorator";
import { Hex, encodeFunctionData } from "viem";
import { Network } from "../../network";
import { generateZoraTokenUri } from "./utils";

const SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"];

/**
 * ZoraActionProvider provides actions for interacting with the Zora protocol.
 */
export class ZoraActionProvider extends ActionProvider<EvmWalletProvider> {
  #pinataJwt: string;

  /**
   * Constructor for the ZoraActionProvider.
   */
  constructor() {
    super("zora", []);

    // Set Pinata JWT
    const pinataJwt = process.env.PINATA_JWT;
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
- category: The category of the coin (optional, defaults to 'social')
- currency: The currency for deployment, can be 'ZORA' or 'ETH'. Determines which token will be used for the trading pair (optional, defaults to 'ZORA').
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
      const { createCoinCall, DeployCurrency, getCoinCreateFromLogs } = await import(
        "@zoralabs/coins-sdk"
      );

      // Create coin call
      const call = {
        name: args.name,
        symbol: args.symbol,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        uri: uri as any,
        payoutRecipient: (args.payoutRecipient as Hex) || walletProvider.getAddress(),
        platformReferrer:
          (args.platformReferrer as Hex) || "0x0000000000000000000000000000000000000000",
        currency: args.currency === "ZORA" ? DeployCurrency.ZORA : DeployCurrency.ETH,
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
          ...(walletProvider.getNetwork().networkId === "base-mainnet" &&
            deployment?.coin && {
              zoraURL: `https://zora.co/coin/base:${deployment.coin}`,
            }),
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
 * @returns A new ZoraActionProvider instance
 */
export const zoraActionProvider = () => new ZoraActionProvider();
