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
  SolanaCreateLaunchpadParams,
  CreateLaunchpadParams,
  ListParams,
  CancelListingParams,
  MakeItemOfferParams,
  TakeItemOfferParams,
  CancelItemOfferParams,
  EvmCancelItemOfferParams,
  SolanaCancelItemOfferParams,
  SolanaTakeItemOfferParams,
  EvmTakeItemOfferParams,
  SolanaMakeItemOfferParams,
  EvmMakeItemOfferParams,
  SolanaCancelListingParams,
  EvmCancelListingParams,
  SolanaListParams,
  EvmListParams,
  SolanaUpdateLaunchpadParams,
  EvmUpdateLaunchpadParams,
  UpdateLaunchpadParams,
  EvmCreateLaunchpadParams,
  PublishLaunchpadParams,
  SolanaPublishLaunchpadParams,
  SOL_MAX_NAME_LENGTH,
  MIN_ROYALTY_BPS,
  MAX_ROYALTY_BPS,
  MAX_SYMBOL_LENGTH,
  MAX_NAME_LENGTH,
  OperationResponse,
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
   * Creates a new launchpad.
   *
   * @param args - Input parameters conforming to the CreateLaunchpadSchema.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "createLaunchpad",
    description: `
    This tool will create a new NFT launchpad on Magic Eden. Both Solana and EVM chains are supported.
    
    It takes the following inputs:
    - chain: The blockchain to deploy on, one of ["solana", "ethereum", "base", "polygon", "sei", "arbitrum", "apechain", "berachain", "monad_testnet", "bsc", "abstract"]
    - protocol: The NFT standard to use (Solana: "METAPLEX_CORE", EVM: "ERC721" or "ERC1155")
    - creator: The wallet address that will be the creator of the collection
    - name: The name of the collection (max ${MAX_NAME_LENGTH} characters, ${SOL_MAX_NAME_LENGTH} for Solana)
    - symbol: The symbol for the collection (max ${MAX_SYMBOL_LENGTH} characters)
    - imageUrl: (Optional) URL pointing to the collection's image
    - description: (Optional) Description of the collection
    - royaltyBps: Royalty basis points (between ${MIN_ROYALTY_BPS} and ${MAX_ROYALTY_BPS})
    - royaltyRecipients: Array of {address, share} (shares must sum to 100%) (maximum of 4 royalty recipients for Solana)
    - payoutRecipient: Wallet address to receive mint proceeds
    - nftMetadataUrl: (Optional) URL to metadata JSON files
    - tokenImageUrl: (Optional) URL for token image in open editions
    - mintStages: Configuration for the minting phases, containing:
      • stages: (Optional) Array of mint stages, minimum 1 stage. Each stage has:
        - kind: Type of mint stage ("public" or "allowlist")
        - price: Object with {currency: string, raw: string} for mint price
        - startTime: Start time in ISO format (YYYY-MM-DDTHH:MM:SS.MSZ)
        - endTime: End time in ISO format (YYYY-MM-DDTHH:MM:SS.MSZ)
        - walletLimit: (Optional) Max mints per wallet (0-10000)
        - maxSupply: (Optional) Max supply for this stage (1-uint256)
        - allowlist: (Optional, for allowlist kind) Array of allowed wallet addresses (2-2500 addresses)
      • tokenId: (Optional) Token ID for ERC1155 collections
      • walletLimit: (Optional) Default wallet limit if no stages defined (0-10000)
      • maxSupply: (Optional) Total items available for minting (1-uint256)

    Solana-specific parameters:
    - isOpenEdition: Whether the collection is an open edition
    - social: (Optional) Social media links (Discord, Twitter, etc.)
    
    Important notes:
    - Creating a launchpad requires approval transactions and will incur gas fees
    - For Solana, a separate 'publishLaunchpad' action is required after creation
    - Royalty recipients' shares must sum to exactly 100%
    - All URLs should be publicly accessible
    - For non-open editions, metadata JSON files should follow the 0.json, 1.json naming pattern
    - Mint stages must not overlap in time
    - For Solana, if no stages are defined but walletLimit is set, it becomes the default public mint stage limit
    `,
    schema: CreateLaunchpadParams,
  })
  public async createLaunchpad(args: CreateLaunchpadParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.createLaunchpad(args as SolanaCreateLaunchpadParams)
        : await this.evmClient?.nft.createLaunchpad(args as EvmCreateLaunchpadParams);

      return this.handleTransactionResponse(response, "createLaunchpad");
    } catch (error) {
      return `Error executing MagicEden 'createLaunchpad' action: ${error}`;
    }
  }

  /**
   * Publishes a launchpad (only for Solana)
   *
   * @param args - Input parameters conforming to the PublishLaunchpadParams.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "publishLaunchpad",
    description: `
    This tool will publish a previously created launchpad, making it visible to the public on Magic Eden. Currently, this action is only required and supported for Solana launchpads.
    
    It takes the following inputs:
    - chain: The blockchain to publish on (must be "solana")
    - candyMachineId: The Solana address of the candy machine
    - symbol: The symbol of the collection/launchpad
    
    Important notes:
    - This action is only required for Solana launchpads
    - Must be called after successfully creating a launchpad
    - The candyMachineId is provided in the response of the createLaunchpad action
    - The symbol must match the one used in createLaunchpad
    - Publishing a launchpad requires an on-chain transaction and will incur gas fees
    - Once published, the launchpad cannot be unpublished
    - The launchpad must be published before minting can begin
    - EVM launchpads are automatically published during creation and do not need this step
    `,
    schema: PublishLaunchpadParams,
  })
  public async publishLaunchpad(args: PublishLaunchpadParams): Promise<string> {
    try {
      if (!this.solClient) {
        return `Solana client not initialized. Publish launchpad is only supported on Solana.`;
      }

      const response = await this.solClient?.nft.publishLaunchpad(
        args as SolanaPublishLaunchpadParams,
      );
      
      if (!response) {
        return `Failed to execute MagicEden 'publishLaunchpad' action`;
      }

      return `Successfully executed MagicEden 'publishLaunchpad' action.`;
    } catch (error) {
      return `Error executing MagicEden 'publishLaunchpad' action: ${error}`;
    }
  }

  /**
   * Updates an existing launchpad.
   *
   * @param args - Input parameters for updating the launchpad.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "updateLaunchpad",
    description: `
    This tool will update an existing NFT launchpad on Magic Eden. Both Solana and EVM chains are supported.
    
    All chains take the following inputs:
    - chain: The blockchain to update on, one of ["solana", "ethereum", "base", "polygon", "sei", "arbitrum", "apechain", "berachain", "monad_testnet", "bsc", "abstract"]
    - protocol: The NFT standard (e.g., "METAPLEX_CORE" for Solana, "ERC721" or "ERC1155" for EVM)
    - collectionId: The collection address/ID to update
    - owner: The owner wallet address
    - name: (Optional) Collection name (max ${MAX_NAME_LENGTH} chars, ${SOL_MAX_NAME_LENGTH} for Solana)
    - imageUrl: (Optional) URL pointing to collection image
    - description: (Optional) Collection description
    - royaltyBps: (Optional) Royalty basis points (${MIN_ROYALTY_BPS}-${MAX_ROYALTY_BPS})
    - royaltyRecipients: (Optional) Array of {address, share} (shares must sum to 100%)
    - payoutRecipient: (Optional) Wallet to receive mint proceeds
    - nftMetadataUrl: (Optional) URL to metadata JSON files
    - tokenImageUrl: (Optional) URL for token image (open editions)
    - mintStages: (Optional) Configuration for minting phases, containing:
      • stages: (Optional) Array of mint stages, minimum 1 stage. Each stage has:
        - kind: Type of mint stage ("public" or "allowlist")
        - price: Object with {currency: string, raw: string} for mint price
        - startTime: Start time in ISO format (YYYY-MM-DDTHH:MM:SS.MSZ)
        - endTime: End time in ISO format (YYYY-MM-DDTHH:MM:SS.MSZ)
        - walletLimit: (Optional) Max mints per wallet (0-10000)
        - maxSupply: (Optional) Max supply for this stage (1-uint256)
        - allowlist: (Optional, for allowlist kind) Array of allowed wallet addresses (2-2500 addresses)
      • tokenId: (Optional) Token ID for ERC1155 collections
      • walletLimit: (Optional) Default wallet limit if no stages defined (0-10000)
      • maxSupply: (Optional) Total items available for minting (1-uint256)
    
    EVM-specific parameters:
    - tokenId: (Optional) Token ID for ERC1155 collections, required if protocol is "ERC1155"
    - collectionId must be a valid EVM address
    - Uses contract:tokenId format for tokens

    Solana-specific parameters:
    - payer: Address paying for transaction fees
    - candyMachineId: The Candy Machine address
    - symbol: Current collection symbol
    - name: Current collection name (required on Solana)
    - royaltyRecipients: Array of {address, share} (shares must sum to 100%) (required on Solana) (maximum of 4 royalty recipients)
    - payoutRecipient: Wallet to receive mint proceeds (required on Solana)
    - newSymbol: (Optional) New symbol to update to
    - social: (Optional) Social media links (Discord, Twitter, etc.)
      • discordUrl: (Optional) Discord URL
      • twitterUsername: (Optional) Twitter username
      • telegramUrl: (Optional) Telegram URL
      • externalUrl: (Optional) External URL
    
    Important notes:
    - Updates require approval transactions and will incur gas fees
    - All URLs must be publicly accessible
    - For non-open editions, metadata JSONs should follow 0.json, 1.json pattern
    - Some parameters may be immutable depending on the chain and protocol
    - All addresses must be valid for the specified chain
    - Royalty recipient shares must sum to exactly 100%
    `,
    schema: UpdateLaunchpadParams,
  })
  public async updateLaunchpad(args: UpdateLaunchpadParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.updateLaunchpad(args as SolanaUpdateLaunchpadParams)
        : await this.evmClient?.nft.updateLaunchpad(args as EvmUpdateLaunchpadParams);

      return this.handleTransactionResponse(response, "updateLaunchpad");
    } catch (error) {
      return `Error executing MagicEden 'updateLaunchpad' action: ${error}`;
    }
  }

  /**
   * Lists an NFT for sale.
   *
   * @param args - Input parameters for listing the NFT.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "listNft",
    description: `
    This tool will list an NFT for sale on the Magic Eden marketplace. Both Solana and EVM chains are supported.
    
    EVM-specific parameters:
    - chain: The blockchain to list on, one of ["ethereum", "base", "polygon", "sei", "arbitrum", "apechain", "berachain", "monad_testnet", "bsc", "abstract"]
    - params: Array of listings, each containing:
      • token: Contract and token ID in format "contractAddress:tokenId"
      • price: Amount in wei
      • expiry: (Optional) Expiration Unix timestamp in seconds for when the listing should expire
    
    Solana-specific parameters:
    - token: The NFT's mint address
    - price: The listing price in lamports
    - expiry: (Optional) Expiration Unix timestamp in seconds for when the listing should expire
    - tokenAccount: (Optional) Required only for legacy NFTs
    - splPrice: (Optional) Details for SPL token pricing
    - sellerReferral: (Optional) Referral address
    - prioFeeMicroLamports: (Optional) Priority fee in micro lamports
    - maxPrioFeeLamports: (Optional) Maximum priority fee
    - exactPrioFeeLamports: (Optional) Exact priority fee
    - txFeePayer: (Optional) Address paying for transaction fees
    
    Important notes:
    - The wallet must own the NFT being listed
    - First-time listings require an approval transaction
      • This will incur a one-time gas fee
      • Subsequent listings will be gasless
    - Prices must be in the chain's smallest unit (wei/lamports)
    - For EVM chains, multiple NFTs can be listed in one transaction
    - For Solana, priority fees can be adjusted to speed up transactions
    - Legacy Solana NFTs require additional token account information
    `,
    schema: ListParams,
  })
  public async listNft(args: ListParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.list(args as SolanaListParams)
        : await this.evmClient?.nft.list(args as EvmListParams);

      return this.handleTransactionResponse(response, "listNft");
    } catch (error) {
      return `Error executing MagicEden 'listNft' action: ${error}`;
    }
  }

  /**
   * Cancels an existing NFT listing.
   *
   * @param args - Input parameters for canceling the listing.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "cancelListing",
    description: `
    This tool will cancel an existing NFT listing on the Magic Eden marketplace. Both Solana and EVM chains are supported.
    
    Required inputs differ by chain:
    
    EVM-specific parameters:
    - chain: The blockchain where the listing exists (e.g., "base", "ethereum")
    - orderIds: Array of order IDs to cancel
      • Each ID represents a specific listing to cancel
      • Multiple listings can be canceled in one transaction
    
    Solana-specific parameters:
    - token: The NFT's mint address
    - price: The listing price that was used (in lamports)
    - tokenAccount: (Optional) Required only for legacy NFTs
    - sellerReferral: (Optional) Referral address
    - expiry: (Optional) Original listing expiration Unix timestamp in seconds
    - prioFeeMicroLamports: (Optional) Priority fee in micro lamports
    - maxPrioFeeLamports: (Optional) Maximum priority fee
    - exactPrioFeeLamports: (Optional) Exact priority fee
    
    Important notes:
    - Only the wallet that created the listing can cancel it
    - Canceling a listing requires an on-chain transaction
      • This will incur gas fees
      • Gas fees are typically lower than listing fees
    - For Solana:
      • Legacy NFTs require the tokenAccount parameter
      • Priority fees can be adjusted to speed up transactions
      • The price must match the original listing exactly
    - For EVM:
      • Multiple listings can be canceled in one transaction
      • Order IDs can be found in the original listing response
    `,
    schema: CancelListingParams,
  })
  public async cancelListing(args: CancelListingParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.cancelListing(args as SolanaCancelListingParams)
        : await this.evmClient?.nft.cancelListing(args as EvmCancelListingParams);

      return this.handleTransactionResponse(response, "cancelListing");
    } catch (error) {
      return `Error executing MagicEden 'cancelListing' action: ${error}`;
    }
  }

  /**
   * Makes an offer on an NFT.
   *
   * @param args - Input parameters for making the offer.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "makeItemOffer",
    description: `
    This tool will make an offer on an NFT listed on the Magic Eden marketplace. Both Solana and EVM chains are supported.
    
    EVM-specific parameters:
    - chain: The blockchain to make the offer on, one of ["ethereum", "base", "polygon", "sei", "arbitrum", "apechain", "berachain", "monad_testnet", "bsc", "abstract"]
    - params: Array of offers, each containing:
      • token: Contract and token ID in format "contractAddress:tokenId"
      • price: The offer amount in wei (smallest unit)
      • expiry: (Optional) Offer expiration Unix timestamp in seconds
      • quantity: (Optional) Number of NFTs to bid on
      • automatedRoyalties: (Optional) Auto-set royalty amounts and recipients
      • royaltyBps: (Optional) Maximum royalty basis points to pay (1 BPS = 0.01%)
      • currency: (Optional) Token address for payment (defaults to wrapped native token)
    
    Solana-specific parameters:
    - token: The NFT's mint address
    - price: The offer amount in lamports
    - expiry: (Optional) Offer expiration Unix timestamp in seconds
    - buyerReferral: (Optional) Referral address
    - useBuyV2: (Optional) Whether to use buy v2 protocol
    - buyerCreatorRoyaltyPercent: (Optional) Buyer's share of creator royalties
    - prioFeeMicroLamports: (Optional) Priority fee in micro lamports
    - maxPrioFeeLamports: (Optional) Maximum priority fee
    - exactPrioFeeLamports: (Optional) Exact priority fee
    
    Important notes:
    - The wallet must have sufficient funds to cover the offer amount
    - Making an offer requires an approval transaction for the currency
      • First-time approval will incur a gas fee
      • Subsequent offers using the same currency will be gasless
    - For EVM:
      • Multiple offers can be made in one transaction
      • Custom currencies (tokens) can be used instead of native currency
      • Royalties can be configured or automated
    - For Solana:
      • Priority fees can be adjusted to speed up transactions
      • Creator royalties can be split between buyer and seller
    `,
    schema: MakeItemOfferParams,
  })
  public async makeItemOffer(args: MakeItemOfferParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.makeItemOffer(args as SolanaMakeItemOfferParams)
        : await this.evmClient?.nft.makeItemOffer(args as EvmMakeItemOfferParams);

      return this.handleTransactionResponse(response, "makeItemOffer");
    } catch (error) {
      return `Error executing MagicEden 'makeItemOffer' action: ${error}`;
    }
  }

  /**
   * Accepts an existing offer on an NFT.
   *
   * @param args - Input parameters for accepting the offer.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "takeItemOffer",
    description: `
    This tool will accept an existing offer on an NFT listed on the Magic Eden marketplace. Both Solana and EVM chains are supported.

    EVM-specific parameters:
    - chain: The blockchain where the offer exists, one of ["ethereum", "base", "polygon", "sei", "arbitrum", "apechain", "berachain", "monad_testnet", "bsc", "abstract"]
    - items: Array of offers to accept, each containing:
      • token: Contract and token ID in format "contractAddress:tokenId"
      • quantity: (Optional) Number of tokens to sell
      • orderId: (Optional) Specific order ID to accept
    
    Solana-specific parameters:
    - token: The NFT's mint address
    - buyer: The wallet address of the offer maker
    - price: The original offer price in lamports
    - newPrice: The price at which to accept the offer
    - buyerReferral: (Optional) Buyer's referral address
    - sellerReferral: (Optional) Seller's referral address
    - buyerExpiry: (Optional) Buyer's offer expiration Unix timestamp in seconds
    - sellerExpiry: (Optional) Seller's acceptance expiration Unix timestamp in seconds
    - prioFeeMicroLamports: (Optional) Priority fee in micro lamports
    - maxPrioFeeLamports: (Optional) Maximum priority fee
    - exactPrioFeeLamports: (Optional) Exact priority fee
    
    Important notes:
    - Only the NFT owner can accept offers
    - Accepting an offer requires an on-chain transaction
      • This will incur gas fees
      • First-time approvals may require additional gas
    - For EVM:
      • Multiple offers can be accepted in one transaction
      • Order IDs can be used to accept specific offers
      • Quantity can be specified for ERC1155 tokens
    - For Solana:
      • Priority fees can be adjusted to speed up transactions
      • Both original and new prices must be specified
      • Expiration times can be set for both parties
    `,
    schema: TakeItemOfferParams,
  })
  public async takeItemOffer(args: TakeItemOfferParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.takeItemOffer(args as SolanaTakeItemOfferParams)
        : await this.evmClient?.nft.takeItemOffer(args as EvmTakeItemOfferParams);

      return this.handleTransactionResponse(response, "takeItemOffer");
    } catch (error) {
      return `Error executing MagicEden 'takeItemOffer' action: ${error}`;
    }
  }

  /**
   * Cancels an existing offer on an NFT.
   *
   * @param args - Input parameters for canceling the offer.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "cancelItemOffer",
    description: `
    This tool will cancel an existing offer on an NFT on the Magic Eden marketplace. Both Solana and EVM chains are supported.
    
    Required inputs differ by chain:
    
    EVM-specific parameters:
    - chain: The blockchain where the offer exists, one of ["ethereum", "base", "polygon", "sei", "arbitrum", "apechain", "berachain", "monad_testnet", "bsc", "abstract"]
    - orderIds: Array of order IDs to cancel
      • Each ID represents a specific offer to cancel
      • Multiple offers can be canceled in one transaction
    
    Solana-specific parameters:
    - token: The NFT's mint address
    - price: The original offer price in lamports
    - expiry: (Optional) Original offer expiration Unix timestamp in seconds
    - buyerReferral: (Optional) Referral address
    - prioFeeMicroLamports: (Optional) Priority fee in micro lamports
    - maxPrioFeeLamports: (Optional) Maximum priority fee
    - exactPrioFeeLamports: (Optional) Exact priority fee
    
    Important notes:
    - Only the wallet that made the offer can cancel it
    - Canceling an offer requires an on-chain transaction
      • This will incur gas fees
      • Gas fees are typically lower than making offers
    - For Solana:
      • Priority fees can be adjusted to speed up transactions
      • The price must match the original offer exactly
      • Expiration time must match if it was set
    - For EVM:
      • Multiple offers can be canceled in one transaction
      • Order IDs can be found in the original offer response
    `,
    schema: CancelItemOfferParams,
  })
  public async cancelItemOffer(args: CancelItemOfferParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.cancelItemOffer(args as SolanaCancelItemOfferParams)
        : await this.evmClient?.nft.cancelItemOffer(args as EvmCancelItemOfferParams);

      return this.handleTransactionResponse(response, "cancelItemOffer");
    } catch (error) {
      return `Error executing MagicEden 'cancelItemOffer' action: ${error}`;
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
    This tool will buy one or more NFTs from the Magic Eden marketplace. Both Solana and EVM chains are supported.
    
    EVM-specific parameters:
    - chain: The blockchain to buy on, one of ["ethereum", "base", "polygon", "sei", "arbitrum", "apechain", "berachain", "monad_testnet", "bsc", "abstract"]
    - currency: (Optional) Token address to use for payment
    - currencyChainId: (Optional) Chain ID of the payment token
    - items: Array of NFTs to buy, each containing:
      • token: Contract and token ID in format "contractAddress:tokenId"
      • collection: (Optional) Collection address
      • quantity: (Optional) Number of NFTs to buy
      • orderId: (Optional) Specific listing to buy from
    
    Solana-specific parameters:
    - token: The NFT's mint address
    - seller: The wallet address of the NFT seller
    - price: The purchase price in lamports
    - buyerReferral: (Optional) Buyer's referral address
    - sellerReferral: (Optional) Seller's referral address
    - buyerExpiry: (Optional) Buyer's purchase expiration Unix timestamp in seconds
    - sellerExpiry: (Optional) Seller's listing expiration Unix timestamp in seconds
    - buyerCreatorRoyaltyPercent: (Optional) Buyer's share of creator royalties
    - splPrice: (Optional) Details for SPL token purchases
    
    Important notes:
    - The wallet must have sufficient funds to cover the purchase
    - Buying an NFT requires an on-chain transaction
      • This will incur gas fees
      • First-time token approvals may require additional gas
    - For EVM:
      • Multiple NFTs can be purchased in one transaction
      • Custom currencies can be used for payment
      • Order IDs can be used to buy specific listings
      • Quantity can be specified for ERC1155 tokens
    - For Solana:
      • Each purchase requires a separate transaction
      • Creator royalties can be split between buyer and seller
      • SPL tokens can be used for payment
    `,
    schema: BuyParams,
  })
  public async buy(args: BuyParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.buy(args as SolanaBuyParams)
        : await this.evmClient?.nft.buy(args as EvmBuyParams);

      return this.handleTransactionResponse(response, "buy");
    } catch (error) {
      return `Error executing MagicEden 'buy' action: ${error}`;
    }
  }

  /**
   * Determines if the provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if supported, false otherwise.
   */
  public supportsNetwork = (network: Network): boolean => isSupportedNetwork(network);

  private handleTransactionResponse(
    response: OperationResponse[] | undefined,
    action: string
  ): string {
    if (!response) {
      return `Failed to ${action}`;
    }

    const failures = response.filter(
      r => r.status === "failed" || r.status === undefined || r.error
    );
    if (failures.length) {
      return `Failed to execute MagicEden '${action}' action: ${failures.map(f => f.error).join(", ")}`;
    }

    const transactionResponse = response
      .filter(r => r !== undefined)
      .map(r => r as TransactionResponse);

    return `Successfully executed MagicEden '${action}' action.\nTransactions: [${transactionResponse.map(r => r.txId).join(", ")}]`;
  }
}

export const magicEdenActionProvider = (config: MagicEdenActionProviderConfig) =>
  new MagicEdenActionProvider(config);
