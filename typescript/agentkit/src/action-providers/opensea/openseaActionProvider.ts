import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { ListNftSchema } from "./schemas";
import { OpenSeaSDK, Chain } from "opensea-js";
import { Network } from "../../network";
import { Wallet, JsonRpcProvider } from "ethers";

/**
 * Configuration options for the OpenseaActionProvider.
 */
export interface OpenseaActionProviderConfig {
  /**
   * OpenSea API Key.
   */
  apiKey?: string;

  /**
   * The network ID to use for the OpenseaActionProvider.
   */
  networkId?: string;

  /**
   * The private key to use for the OpenseaActionProvider.
   */
  privateKey?: string;
}

/**
 * NetworkConfig is the configuration for network-specific settings.
 */
interface NetworkConfig {
  rpcUrl: string;
  openseaUrl: string;
  chain: Chain;
}

/**
 * OpenseaActionProvider is an action provider for OpenSea marketplace interactions.
 */
export class OpenseaActionProvider extends ActionProvider {
  private readonly apiKey: string;
  private openseaSDK: OpenSeaSDK;
  private walletWithProvider: Wallet;
  private readonly networkConfig: NetworkConfig;

  /**
   * Constructor for the OpenseaActionProvider class.
   *
   * @param config - The configuration options for the OpenseaActionProvider.
   */
  constructor(config: OpenseaActionProviderConfig = {}) {
    super("opensea", []);

    const apiKey = config.apiKey || process.env.OPENSEA_API_KEY;
    if (!apiKey) {
      throw new Error("OPENSEA_API_KEY is not configured.");
    }
    this.apiKey = apiKey;

    this.networkConfig =
      config.networkId === "base-sepolia"
        ? {
            rpcUrl: "https://sepolia.base.org",
            openseaUrl: "https://testnets.opensea.io/assets/base_sepolia",
            chain: Chain.BaseSepolia,
          }
        : {
            rpcUrl: "https://main.base.org",
            openseaUrl: "https://opensea.io/assets/base",
            chain: Chain.Mainnet,
          };

    if (config.networkId !== "base-sepolia" && config.networkId !== "base-mainnet") {
      throw new Error("Unsupported network. Only base-sepolia and base-mainnet are supported.");
    }

    // Initialize ethers signer required for OpenSea SDK
    const provider = new JsonRpcProvider(this.networkConfig.rpcUrl);
    const walletWithProvider = new Wallet(config.privateKey!, provider);
    this.walletWithProvider = walletWithProvider;

    const openseaSDK = new OpenSeaSDK(walletWithProvider, {
      chain: this.networkConfig.chain,
      apiKey: this.apiKey,
    });
    this.openseaSDK = openseaSDK;
  }

  /**
   * Lists an NFT for sale on OpenSea.
   *
   * @param args - The input arguments for the action.
   * @returns A message containing the listing details.
   */
  @CreateAction({
    name: "list_nft",
    description: `
This tool will list an NFT for sale on OpenSea. 
Currently only base-sepolia and base-mainnet are supported.

It takes the following inputs:
- contractAddress: The NFT contract address to list
- tokenId: The ID of the NFT to list
- price: The price in ETH for which the NFT will be listed
- expirationDays: (Optional) Number of days the listing should be active for (default: 90)

Important notes:
- The wallet must own the NFT to list it
- Price is in ETH (e.g. 1.5 for 1.5 ETH) - this is what you will receive if the NFT is sold, it is not required to have this amount in your wallet
- This is a gasless action - no ETH balance is required for listing the NFT
- This will approve the whole NFT collection to be managed by OpenSea
- Only supported on the following networks:
  - Base Sepolia (ie, 'base-sepolia')
  - Base Mainnet (ie, 'base', 'base-mainnet')
  `,
    schema: ListNftSchema,
  })
  async listNft(args: z.infer<typeof ListNftSchema>): Promise<string> {
    try {
      const expirationTime = Math.round(Date.now() / 1000 + args.expirationDays * 24 * 60 * 60);
      await this.openseaSDK.createListing({
        asset: {
          tokenId: args.tokenId,
          tokenAddress: args.contractAddress,
        },
        startAmount: args.price,
        quantity: 1,
        paymentTokenAddress: "0x0000000000000000000000000000000000000000",
        expirationTime: expirationTime,
        accountAddress: this.walletWithProvider.address,
      });

      const listingLink = `${this.networkConfig.openseaUrl}/${args.contractAddress}/${args.tokenId}`;

      return `Successfully listed NFT ${args.contractAddress} token ${args.tokenId} for ${args.price} ETH, expiring in ${args.expirationDays} days. Listing on OpenSea: ${listingLink}.`;
    } catch (error) {
      return `Error listing NFT ${args.contractAddress} token ${args.tokenId} for ${args.price} ETH using account ${this.walletWithProvider.address}: ${error}`;
    }
  }

  /**
   * Checks if the Opensea action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Opensea action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
}

export const openseaActionProvider = (config?: OpenseaActionProviderConfig) =>
  new OpenseaActionProvider(config);
