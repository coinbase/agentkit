import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  Blockchain,
  MagicEdenClient,
  MagicEdenSDK,
  BuyParams,
  SolanaNftService,
  EvmNftService,
  EvmBuyParams,
  SolanaBuyParams,
  TransactionResponse,
} from "@magiceden/magiceden-sdk";
import { getMagicEdenChainFromNetworkId, isSupportedNetwork } from "./utils";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Configuration options for the MagicEdenActionProvider.
 */
export interface MagicEdenActionProviderConfig {
  /**
   * The Magic Eden API key.
   */
  apiKey?: string;

  /**
   * The network ID to use for the MagicEdenActionProvider.
   */
  networkId?: string;

  /**
   * The private key to use for the MagicEdenActionProvider.
   */
  privateKey?: string;

  /**
   * The RPC URL to use for the MagicEdenActionProvider (if Solana network).
   */
  rpcUrl?: string;
}

/**
 * MagicEdenActionProvider provides functionality to interact with Magic Eden's marketplace.
 */
export class MagicEdenActionProvider extends ActionProvider {
  private readonly solClient?: MagicEdenClient<SolanaNftService>;
  private readonly evmClient?: MagicEdenClient<EvmNftService>;

  /**
   * Constructor for the MagicEdenActionProvider class.
   */
  constructor(config: MagicEdenActionProviderConfig) {
    super("magicEden", []);

    const apiKey = config.apiKey || process.env.MAGICEDEN_API_KEY;
    if (!apiKey) {
      throw new Error("MAGICEDEN_API_KEY is not configured.");
    }

    const chain = getMagicEdenChainFromNetworkId(config.networkId || "base-mainnet");
    switch (chain) {
      case Blockchain.SOLANA:
        this.solClient = MagicEdenSDK.v1.createSolanaKeypairClient(
          apiKey,
          Keypair.fromSecretKey(bs58.decode(config.privateKey!)),
          {
            rpcUrl: config.rpcUrl,
          },
        );
        break;
      case Blockchain.BITCOIN:
        throw new Error("Bitcoin is not a supported chain for MagicEdenActionProvider");
      // If not Bitcoin or Solana, default to viem EVM client
      default:
        this.evmClient = MagicEdenSDK.v1.createViemEvmClient(
          apiKey,
          config.privateKey! as `0x${string}`,
          chain,
        );
        break;
    }
  }

  /**
   * Buys one or more NFTs from the Magic Eden marketplace.
   *
   * @param args - Input parameters conforming to the BuySchema.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "buy",
    description: `
    
    `,
    schema: BuyParams,
  })
  public async buy(args: BuyParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.buy(args as SolanaBuyParams)
        : await this.evmClient?.nft.buy(args as EvmBuyParams);
      
      const failures = response?.filter((r) => r.status === "failed" || r.error);
      if (failures?.length) {
        return `Failed to buy NFT: ${failures.map((f) => f.error).join(", ")}`;
      }

      const transactionResponse = response?.map((r) => r as TransactionResponse).filter((r) => r !== undefined);
      
      return `Successfully bought NFT.\nTransactions: [${transactionResponse?.map((r) => r.txId).join(", ")}]`;
    } catch (error) {
      return `Error buying NFT: ${error}`;
    }
  }

  /**
   * Determines if the provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if supported, false otherwise.
   */
  public supportsNetwork = (network: Network): boolean => isSupportedNetwork(network);
}

export const magicEdenActionProvider = (config: MagicEdenActionProviderConfig) =>
  new MagicEdenActionProvider(config);
