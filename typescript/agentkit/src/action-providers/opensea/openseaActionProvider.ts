import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { ListNftSchema, GetNftsByAccountSchema } from "./schemas";
import { OpenSeaSDK } from "opensea-js";
import { Network, NETWORK_ID_TO_CHAIN_ID } from "../../network";
import { Wallet, ethers } from "ethers";
import { EvmWalletProvider } from "../../wallet-providers";
import { chainIdToOpenseaChain, supportedChains } from "./utils";
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
export class OpenseaActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiKey: string;
  private walletWithProvider: Wallet;
  private openseaSDK: OpenSeaSDK;
  private openseaBaseUrl: string;

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

    const chainId = NETWORK_ID_TO_CHAIN_ID[config.networkId || "base-sepolia"];
    const provider = ethers.getDefaultProvider(parseInt(chainId));
    const walletWithProvider = new Wallet(config.privateKey!, provider);
    this.walletWithProvider = walletWithProvider;

    const openseaSDK = new OpenSeaSDK(walletWithProvider, {
      chain: chainIdToOpenseaChain(chainId),
      apiKey: this.apiKey,
    });
    this.openseaSDK = openseaSDK;
    this.openseaBaseUrl = this.openseaSDK.api.apiBaseUrl.replace("-api", "").replace("api", "");
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
This tool will list an NFT for sale on the OpenSea marketplace. 
EVM networks are supported on mainnet and testnets.

It takes the following inputs:
- contractAddress: The NFT contract address to list
- tokenId: The ID of the NFT to list
- price: The price in ETH for which the NFT will be listed
- expirationDays: (Optional) Number of days the listing should be active for (default: 90)

Important notes:
- The wallet must own the NFT
- Price is in ETH (e.g., 1.5 for 1.5 ETH). This is the amount the seller will receive if the NFT is sold. It is not required to have this amount in the wallet.
- Listing the NFT requires approval for OpenSea to manage the entire NFT collection:  
  - If the collection is not already approved, an onchain transaction is required, which will incur gas fees.  
  - If already approved, listing is gasless and does not require any onchain transaction. 
  - EVM networks are supported on mainnet and testnets, for example: base-mainnet and base-sepolia.
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
        paymentTokenAddress: "0x0000000000000000000000000000000000000000", // ETH
        expirationTime,
        accountAddress: this.walletWithProvider.address,
      });

      const listingLink = `${this.openseaBaseUrl}/assets/${this.openseaSDK.chain}/${args.contractAddress}/${args.tokenId}`;
      return `Successfully listed NFT ${args.contractAddress} token ${args.tokenId} for ${args.price} ETH, expiring in ${args.expirationDays} days. Listing on OpenSea: ${listingLink}.`;
    } catch (error) {
      return `Error listing NFT ${args.contractAddress} token ${args.tokenId} for ${args.price} ETH using account ${this.walletWithProvider.address}: ${error}`;
    }
  }

  /**
   * Fetch NFTs of a specific wallet address.
   *
   * @param args - The input arguments for the action.
   * @returns A JSON string containing the NFTs or error message
   */
  @CreateAction({
    name: "get_nfts_by_account",
    description: `
This tool will fetch NFTs owned by a specific wallet address on OpenSea.

It takes the following inputs:
- accountAddress: (Optional) The wallet address to fetch NFTs for. If not provided, uses the connected wallet address.

The tool will return a JSON string containing the NFTs owned by the specified address.
    `,
    schema: GetNftsByAccountSchema,
  })
  async getNftsByAccount(args: z.infer<typeof GetNftsByAccountSchema>): Promise<string> {
    try {
      const address = args.accountAddress || this.walletWithProvider.address;
      const { nfts } = await this.openseaSDK.api.getNFTsByAccount(address);
      return JSON.stringify(nfts);
    } catch (error) {
      const address = args.accountAddress || this.walletWithProvider.address;
      return `Error fetching NFTs for account ${address}: ${error}`;
    }
  }

  /**
   * Checks if the Opensea action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Opensea action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.chainId !== undefined && supportedChains[network.chainId] !== undefined;
}

export const openseaActionProvider = (config?: OpenseaActionProviderConfig) =>
  new OpenseaActionProvider(config);
