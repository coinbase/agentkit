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

  // Create launchpad

  /**
   * Creates a new launchpad.
   *
   * @param args - Input parameters conforming to the CreateLaunchpadSchema.
   * @returns A success message or error string.
   */
  @CreateAction({
    name: "createLaunchpad",
    description: `
    
    `,
    schema: CreateLaunchpadParams,
  })
  public async createLaunchpad(args: CreateLaunchpadParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.createLaunchpad(args as SolanaCreateLaunchpadParams)
        : await this.evmClient?.nft.createLaunchpad(args as EvmCreateLaunchpadParams);

      const failures = response?.filter(
        r => r.status === "failed" || r.status === undefined || r.error,
      );
      if (failures?.length) {
        return `Failed to create launchpad: ${failures.map(f => f.error).join(", ")}`;
      }

      const transactionResponse = response
        ?.map(r => r as TransactionResponse)
        .filter(r => r !== undefined);

      return `Successfully created launchpad.\nTransactions: [${transactionResponse?.map(r => r.txId).join(", ")}]`;
    } catch (error) {
      return `Error creating launchpad: ${error}`;
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
    Publishes a launchpad (only for Solana)
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
        return `Failed to publish launchpad`;
      }

      return `Successfully published launchpad.`;
    } catch (error) {
      return `Error publishing launchpad: ${error}`;
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
    
    `,
    schema: UpdateLaunchpadParams,
  })
  public async updateLaunchpad(args: UpdateLaunchpadParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.updateLaunchpad(args as SolanaUpdateLaunchpadParams)
        : await this.evmClient?.nft.updateLaunchpad(args as EvmUpdateLaunchpadParams);

      const failures = response?.filter(
        r => r.status === "failed" || r.status === undefined || r.error,
      );
      if (failures?.length) {
        return `Failed to update launchpad: ${failures.map(f => f.error).join(", ")}`;
      }

      const transactionResponse = response
        ?.map(r => r as TransactionResponse)
        .filter(r => r !== undefined);

      return `Successfully updated launchpad.\nTransactions: [${transactionResponse?.map(r => r.txId).join(", ")}]`;
    } catch (error) {
      return `Error updating launchpad: ${error}`;
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
    
    `,
    schema: ListParams,
  })
  public async listNft(args: ListParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.list(args as SolanaListParams)
        : await this.evmClient?.nft.list(args as EvmListParams);

      const failures = response?.filter(
        r => r.status === "failed" || r.status === undefined || r.error,
      );
      if (failures?.length) {
        return `Failed to list NFT: ${failures.map(f => f.error).join(", ")}`;
      }

      const transactionResponse = response
        ?.map(r => r as TransactionResponse)
        .filter(r => r !== undefined);

      return `Successfully listed NFT.\nTransactions: [${transactionResponse?.map(r => r.txId).join(", ")}]`;
    } catch (error) {
      return `Error listing NFT: ${error}`;
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
    
    `,
    schema: CancelListingParams,
  })
  public async cancelListing(args: CancelListingParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.cancelListing(args as SolanaCancelListingParams)
        : await this.evmClient?.nft.cancelListing(args as EvmCancelListingParams);

      const failures = response?.filter(
        r => r.status === "failed" || r.status === undefined || r.error,
      );
      if (failures?.length) {
        return `Failed to cancel listing: ${failures.map(f => f.error).join(", ")}`;
      }

      const transactionResponse = response
        ?.map(r => r as TransactionResponse)
        .filter(r => r !== undefined);

      return `Successfully canceled listing.\nTransactions: [${transactionResponse?.map(r => r.txId).join(", ")}]`;
    } catch (error) {
      return `Error canceling listing: ${error}`;
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
    
    `,
    schema: MakeItemOfferParams,
  })
  public async makeItemOffer(args: MakeItemOfferParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.makeItemOffer(args as SolanaMakeItemOfferParams)
        : await this.evmClient?.nft.makeItemOffer(args as EvmMakeItemOfferParams);

      const failures = response?.filter(
        r => r.status === "failed" || r.status === undefined || r.error,
      );
      if (failures?.length) {
        return `Failed to make item offer: ${failures.map(f => f.error).join(", ")}`;
      }

      const transactionResponse = response
        ?.map(r => r as TransactionResponse)
        .filter(r => r !== undefined);

      return `Successfully made item offer.\nTransactions: [${transactionResponse?.map(r => r.txId).join(", ")}]`;
    } catch (error) {
      return `Error making item offer: ${error}`;
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
    
    `,
    schema: TakeItemOfferParams,
  })
  public async takeItemOffer(args: TakeItemOfferParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.takeItemOffer(args as SolanaTakeItemOfferParams)
        : await this.evmClient?.nft.takeItemOffer(args as EvmTakeItemOfferParams);

      const failures = response?.filter(
        r => r.status === "failed" || r.status === undefined || r.error,
      );
      if (failures?.length) {
        return `Failed to take item offer: ${failures.map(f => f.error).join(", ")}`;
      }

      const transactionResponse = response
        ?.map(r => r as TransactionResponse)
        .filter(r => r !== undefined);

      return `Successfully took item offer.\nTransactions: [${transactionResponse?.map(r => r.txId).join(", ")}]`;
    } catch (error) {
      return `Error taking item offer: ${error}`;
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
    
    `,
    schema: CancelItemOfferParams,
  })
  public async cancelItemOffer(args: CancelItemOfferParams): Promise<string> {
    try {
      const response = this.solClient
        ? await this.solClient?.nft.cancelItemOffer(args as SolanaCancelItemOfferParams)
        : await this.evmClient?.nft.cancelItemOffer(args as EvmCancelItemOfferParams);

      const failures = response?.filter(
        r => r.status === "failed" || r.status === undefined || r.error,
      );
      if (failures?.length) {
        return `Failed to cancel item offer: ${failures.map(f => f.error).join(", ")}`;
      }

      const transactionResponse = response
        ?.map(r => r as TransactionResponse)
        .filter(r => r !== undefined);

      return `Successfully canceled item offer.\nTransactions: [${transactionResponse?.map(r => r.txId).join(", ")}]`;
    } catch (error) {
      return `Error canceling item offer: ${error}`;
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

      const failures = response?.filter(
        r => r.status === "failed" || r.status === undefined || r.error,
      );
      if (failures?.length) {
        return `Failed to buy NFT: ${failures.map(f => f.error).join(", ")}`;
      }

      const transactionResponse = response
        ?.map(r => r as TransactionResponse)
        .filter(r => r !== undefined);

      return `Successfully bought NFT.\nTransactions: [${transactionResponse?.map(r => r.txId).join(", ")}]`;
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
