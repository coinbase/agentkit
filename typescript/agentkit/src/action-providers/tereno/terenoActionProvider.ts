import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { createTerenoClient } from "tereno-client";
import type { ClientEvmSigner } from "@x402/evm";
import {
  TerenoCheckContractSchema,
  TerenoGetTokenMetadataSchema,
  TerenoGetChainSnapshotSchema,
  TerenoGetPredictionEvidenceSchema,
  TerenoQuoteContractGuardSchema,
  TerenoListCapabilitiesSchema,
  TerenoListBountiesSchema,
  TerenoPublishContractFingerprintSchema,
} from "./schemas";

export interface TerenoActionProviderConfig {
  /**
   * Base URL of the Tereno endpoint (defaults to 'https://www.tereno.xyz').
   */
  baseUrl?: string;
  /**
   * Maximum price in USDC the agent is willing to pay per capability call (default: $0.05).
   */
  maxPriceUsd?: number;
  /**
   * Optional custom RPC URL for chain state verification.
   */
  rpcUrl?: string;
  /**
   * Optional Base Builder Code attributed to calls made by this agent.
   */
  builderCode?: string;
}

/**
 * TerenoActionProvider gives AI agents on Base sub-second, pre-action verification,
 * contract risk auditing, token metadata, and prediction evidence over x402 micropayments.
 */
export class TerenoActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly config: Required<Pick<TerenoActionProviderConfig, "baseUrl" | "maxPriceUsd">> &
    Omit<TerenoActionProviderConfig, "baseUrl" | "maxPriceUsd">;

  /**
   * Constructor for the TerenoActionProvider.
   *
   * @param config - Configuration options for the Tereno provider.
   */
  constructor(config: TerenoActionProviderConfig = {}) {
    super("tereno", []);
    this.config = {
      baseUrl: config.baseUrl ?? "https://www.tereno.xyz",
      maxPriceUsd: config.maxPriceUsd ?? 0.05,
      rpcUrl: config.rpcUrl,
      builderCode: config.builderCode,
    };
  }

  /**
   * Check contract safety and execution risk before interacting with it on Base.
   *
   * @param walletProvider - The wallet provider executing the action.
   * @param args - The input arguments with the target contract address.
   * @returns JSON string containing verdict (allow/review/block), risk reason codes, and validity.
   */
  @CreateAction({
    name: "check_contract",
    description: `Check a Base smart contract before calling or sending funds to it.
    Returns a deterministic verdict ('allow', 'review', or 'block'), reason codes (e.g. proxy changes, pause state),
    and evidence validity. Settles via x402 in USDC ($0.01 on cache hit / $0.03 fresh).`,
    schema: TerenoCheckContractSchema,
  })
  async checkContract(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TerenoCheckContractSchema>,
  ): Promise<string> {
    try {
      const client = this.getClient(walletProvider);
      const result = await client.invokeCapability({
        capabilityId: "contract.guard",
        address: args.address,
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to verify contract with Tereno",
      });
    }
  }

  /**
   * Inspect block-fresh ERC-20 token metadata on Base.
   *
   * @param walletProvider - The wallet provider executing the action.
   * @param args - The target token address.
   * @returns JSON string with token name, symbol, decimals, and block-fresh totalSupply.
   */
  @CreateAction({
    name: "get_token_metadata",
    description: `Retrieve verified Base ERC-20 token metadata: name, symbol, decimals, and block-fresh totalSupply.
    Settles via x402 in USDC ($0.01 on cache hit / $0.03 fresh).`,
    schema: TerenoGetTokenMetadataSchema,
  })
  async getTokenMetadata(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TerenoGetTokenMetadataSchema>,
  ): Promise<string> {
    try {
      const client = this.getClient(walletProvider);
      const result = await client.invokeCapability({
        capabilityId: "token.metadata",
        address: args.address,
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to fetch token metadata from Tereno",
      });
    }
  }

  /**
   * Read current Base chain state, block number, timestamp, and suggested gas prices.
   *
   * @param walletProvider - The wallet provider executing the action.
   * @returns JSON string containing latest block, timestamp, base fee, and gas recommendations.
   */
  @CreateAction({
    name: "get_chain_snapshot",
    description: `Get the latest state of the Base network in a single call: latest block number, timestamp, base fee,
    and suggested gas prices with zero parameters. Settles via x402 in USDC ($0.01 hit / $0.02 fresh).`,
    schema: TerenoGetChainSnapshotSchema,
  })
  async getChainSnapshot(walletProvider: EvmWalletProvider): Promise<string> {
    try {
      const client = this.getClient(walletProvider);
      const result = await client.invokeCapability({
        capabilityId: "chain.snapshot",
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to fetch chain snapshot from Tereno",
      });
    }
  }

  /**
   * Audit machine-readable evidence for a prediction market proposition.
   *
   * @param walletProvider - The wallet provider executing the action.
   * @param args - The proposition question and optional market identifier.
   * @returns JSON string containing sourced evidence supporting or contradicting the proposition.
   */
  @CreateAction({
    name: "get_prediction_evidence",
    description: `Retrieve sourced, machine-readable evidence for prediction market propositions (e.g., Polymarket, Kalshi).
    Evaluates evidence sources, confidence, and timestamp bounds. Settles via x402 in USDC ($0.01 hit / $0.05 fresh).`,
    schema: TerenoGetPredictionEvidenceSchema,
  })
  async getPredictionEvidence(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TerenoGetPredictionEvidenceSchema>,
  ): Promise<string> {
    try {
      const client = this.getClient(walletProvider);
      const result = await client.invokeCapability({
        capabilityId: "prediction.evidence",
        ...args,
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch prediction evidence from Tereno",
      });
    }
  }

  /**
   * Get a free cost quote for contract verification before spending USDC.
   *
   * @param walletProvider - The wallet provider executing the action.
   * @param args - Target contract address.
   * @returns JSON string showing price, cache status, and potential seeder reuse dividends.
   */
  @CreateAction({
    name: "quote_contract_guard",
    description: `Free: Get a price quote and reuse status for checking a contract on Base before committing to payment.
    Shows whether the answer is cached ($0.01) or fresh ($0.03), and the seeder dividend rate.`,
    schema: TerenoQuoteContractGuardSchema,
  })
  async quoteContractGuard(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TerenoQuoteContractGuardSchema>,
  ): Promise<string> {
    try {
      const client = this.getClient(walletProvider);
      const result = await client.quoteCapability({
        capabilityId: "contract.guard",
        address: args.address,
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch quote from Tereno",
      });
    }
  }

  /**
   * List active Tereno capabilities, prices, TTLs, and economic rules.
   *
   * @param walletProvider - The wallet provider executing the action.
   * @returns JSON string of the Tereno capability catalog.
   */
  @CreateAction({
    name: "list_capabilities",
    description: `Free: List all active Tereno verification capabilities on Base, their prices, validity windows (TTLs),
    and cooperative seeder dividend policies.`,
    schema: TerenoListCapabilitiesSchema,
  })
  async listCapabilities(walletProvider: EvmWalletProvider): Promise<string> {
    try {
      const client = this.getClient(walletProvider);
      const result = await client.catalog();
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch Tereno catalog",
      });
    }
  }

  /**
   * List open unseeded demand bounties that can be seeded to earn reuse dividends.
   *
   * @param walletProvider - The wallet provider executing the action.
   * @param args - Optional limit of bounties.
   * @returns JSON string of open unseeded requests.
   */
  @CreateAction({
    name: "list_bounties",
    description: `Free: Query open unseeded demand bounties. Agents can compute and seed answers for free to claim
    seeder slots and earn 20% reuse dividends in USDC credits whenever other agents query that artifact.`,
    schema: TerenoListBountiesSchema,
  })
  async listBounties(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TerenoListBountiesSchema>,
  ): Promise<string> {
    try {
      const client = this.getClient(walletProvider);
      const result = await client.bounties(args.limit);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to fetch open bounties from Tereno",
      });
    }
  }

  /**
   * Publish a precomputed bytecode fingerprint to earn seeder dividends.
   *
   * @param walletProvider - The wallet provider executing the action.
   * @param args - Fingerprint parameters.
   * @returns JSON string confirming publication and claimed seeder status.
   */
  @CreateAction({
    name: "publish_contract_fingerprint",
    description: `Free: Publish a locally verified contract bytecode fingerprint to claim its seeder slot.
    Earns 20% reuse dividends in credits whenever any other agent queries this contract via Tereno.`,
    schema: TerenoPublishContractFingerprintSchema,
  })
  async publishContractFingerprint(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TerenoPublishContractFingerprintSchema>,
  ): Promise<string> {
    try {
      const client = this.getClient(walletProvider);
      const result = await client.publishContractFingerprint(args);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish contract fingerprint to Tereno",
      });
    }
  }

  /**
   * Validates if the Action Provider supports the current network.
   * Supports Base mainnet (chainId 8453) and Base Sepolia (chainId 84532).
   *
   * @param network - The network to evaluate.
   * @returns True if supported, false otherwise.
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily === "evm" &&
      (network.chainId === "8453" ||
        network.chainId === "84532" ||
        network.networkId === "base" ||
        network.networkId === "base-mainnet" ||
        network.networkId === "base-sepolia")
    );
  }

  /**
   * Helper to instantiate a configured Tereno client using the AgentKit EVM wallet.
   *
   * @param walletProvider - The EVM wallet provider executing the action.
   * @returns A configured TerenoClient instance.
   */
  private getClient(walletProvider: EvmWalletProvider) {
    const address = walletProvider.getAddress();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error("Tereno actions require a valid EVM wallet address.");
    }

    const network = walletProvider.getNetwork();
    const networkId =
      network.chainId === "84532" || network.networkId === "base-sepolia"
        ? "eip155:84532"
        : "eip155:8453";

    const signer: ClientEvmSigner = {
      address: address as `0x${string}`,
      signTypedData: message => walletProvider.signTypedData(message),
    };

    return createTerenoClient({
      baseUrl: this.config.baseUrl,
      signer,
      network: networkId,
      rpcUrl: this.config.rpcUrl,
      maxPriceUsd: this.config.maxPriceUsd,
      builderCode: this.config.builderCode,
    });
  }
}

/**
 * Factory function for TerenoActionProvider.
 *
 * @param config - Optional configuration object.
 * @returns An instance of TerenoActionProvider.
 */
export const terenoActionProvider = (config?: TerenoActionProviderConfig) =>
  new TerenoActionProvider(config);
