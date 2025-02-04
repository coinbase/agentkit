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
 * OpenseaActionProvider is an action provider for OpenSea marketplace interactions.
 */
export class OpenseaActionProvider extends ActionProvider {
  private readonly apiKey: string;
  private openseaSDK: OpenSeaSDK;
  private walletWithProvider: Wallet;
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

    const rpcUrl =
      config.networkId === "base-sepolia"
        ? "https://sepolia.base.org"
        : config.networkId === "base-mainnet"
          ? "https://main.base.org"
          : null;

    if (!rpcUrl) {
      throw new Error("Unsupported network. Only base-sepolia and base-mainnet are supported.");
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const walletWithProvider = new Wallet(config.privateKey!, provider);
    this.walletWithProvider = walletWithProvider;

    const openseaSDK = new OpenSeaSDK(walletWithProvider, {
      chain: config.networkId === "base-mainnet" ? Chain.Mainnet : Chain.BaseSepolia,
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
This tool will list an NFT for sale on OpenSea marketplace. Currently only base-sepolia and base-mainnet are supported.

It takes the following inputs:
- contractAddress: The NFT contract address to list
- tokenId: The ID of the NFT to list
- price: The price in ETH to list the NFT for
- expirationDays: (Optional) Number of days the listing should be active for (default: 90)

Important notes:
- Ensure you have approved OpenSea to manage this NFT before listing
- The wallet must own the NFT to list it
- Price is in ETH (e.g. 1.5 for 1.5 ETH)
`,
    schema: ListNftSchema,
  })
  async listNft(args: z.infer<typeof ListNftSchema>): Promise<string> {
    try {
      const expirationTime = Math.round(Date.now() / 1000 + args.expirationDays * 24 * 60 * 60);
      const listing = await this.openseaSDK.createListing({
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

      const listingStr = JSON.stringify(
        listing,
        (key, value) => (typeof value === "bigint" ? value.toString() : value),
        2,
      );
      console.log("Listing details:", listingStr);

      return `Successfully listed NFT ${args.contractAddress} token ${args.tokenId} for ${args.price} ETH, expiring in ${args.expirationDays} days`;
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
