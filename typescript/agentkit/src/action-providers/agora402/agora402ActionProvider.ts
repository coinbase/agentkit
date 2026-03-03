import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  encodeFunctionData,
  keccak256,
  toBytes,
  parseUnits,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import {
  CreateEscrowSchema,
  ReleaseEscrowSchema,
  DisputeEscrowSchema,
  EscrowStatusSchema,
  TrustScoreSchema,
  ProtectedCallSchema,
} from "./schemas";
import {
  ESCROW_ABI,
  REPUTATION_ABI,
  ERC20_ABI,
  ESCROW_ADDRESSES,
  REPUTATION_ADDRESSES,
  USDC_ADDRESSES,
  USDC_DECIMALS,
  STATE_NAMES,
} from "./constants";

/**
 * Optional configuration to override default contract addresses.
 */
export interface Agora402Config {
  escrowAddress?: Address;
  reputationAddress?: Address;
  usdcAddress?: Address;
}

/**
 * Agora402ActionProvider adds USDC escrow protection, trust scores, and dispute
 * resolution to any AgentKit agent. It complements the x402 action provider by
 * adding buyer protection — funds are locked until delivery is verified.
 *
 * Deployed on Base mainnet and Base Sepolia.
 * Protocol: 2% fee on release/resolve, 0% on refund.
 * More info: https://github.com/michu5696/agentBank
 */
export class Agora402ActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly escrowAddr?: Address;
  private readonly reputationAddr?: Address;
  private readonly usdcAddr?: Address;

  /**
   * Creates a new Agora402ActionProvider instance.
   *
   * @param config - Optional configuration to override default contract addresses
   */
  constructor(config?: Agora402Config) {
    super("agora402", []);
    this.escrowAddr = config?.escrowAddress;
    this.reputationAddr = config?.reputationAddress;
    this.usdcAddr = config?.usdcAddress;
  }

  /**
   * Creates a USDC escrow to protect a transaction with a seller.
   *
   * @param walletProvider - The wallet provider for signing transactions
   * @param args - Escrow parameters: seller, amount, timelock, service URL
   * @returns JSON with escrow ID, transaction hash, and status
   */
  @CreateAction({
    name: "agora402_create_escrow",
    description: `Create a USDC escrow to protect an agent-to-agent transaction on Base.
Funds are locked until delivery is confirmed (release) or flagged (dispute).
A 2% protocol fee is deducted on release. If the escrow expires, the buyer gets a full refund.

Amount is in whole USDC units (e.g., 0.50 for $0.50 USDC). Do not convert to smallest units.
Minimum: $0.10, Maximum: $100.`,
    schema: CreateEscrowSchema,
  })
  async createEscrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateEscrowSchema>,
  ): Promise<string> {
    try {
      const chainId = this.getChainId(walletProvider.getNetwork());
      const escrowAddr = this.getEscrowAddress(chainId);
      const amount = this.parseUsdc(args.amount_usdc);
      const timelockDuration = BigInt(args.timelock_minutes * 60);
      const serviceHash = keccak256(toBytes(args.service_url));

      const approveTxHash = await this.ensureAllowance(walletProvider, chainId, amount);

      const data = encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "createAndFund",
        args: [args.seller as Address, amount, timelockDuration, serviceHash],
      });

      const txHash = await walletProvider.sendTransaction({ to: escrowAddr, data });
      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      const escrowCreatedLog = receipt.logs?.find(
        (log: { address: string; topics: string[] }) =>
          log.address.toLowerCase() === escrowAddr.toLowerCase() &&
          log.topics[0] ===
            keccak256(toBytes("EscrowCreated(uint256,address,address,uint256,uint256,bytes32)")),
      );

      const escrowId = escrowCreatedLog?.topics[1] ? BigInt(escrowCreatedLog.topics[1]) : 0n;

      return JSON.stringify({
        success: true,
        escrowId: escrowId.toString(),
        amount: this.formatUsdc(amount),
        seller: args.seller,
        serviceUrl: args.service_url,
        expiresInMinutes: args.timelock_minutes,
        approveTxHash: approveTxHash ?? "already approved",
        txHash,
        message: `Escrow #${escrowId} created. ${this.formatUsdc(amount)} locked. Call agora402_release_escrow when delivery is confirmed, or agora402_dispute_escrow if there is a problem.`,
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: "Failed to create escrow",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Releases escrowed USDC to the seller after confirming delivery.
   *
   * @param walletProvider - The wallet provider for signing transactions
   * @param args - The escrow ID to release
   * @returns JSON with release confirmation and transaction hash
   */
  @CreateAction({
    name: "agora402_release_escrow",
    description:
      "Confirm delivery and release escrowed USDC to the seller. Only call this after verifying the service was delivered correctly. A 2% protocol fee is deducted from the release amount.",
    schema: ReleaseEscrowSchema,
  })
  async releaseEscrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ReleaseEscrowSchema>,
  ): Promise<string> {
    try {
      const chainId = this.getChainId(walletProvider.getNetwork());
      const escrowAddr = this.getEscrowAddress(chainId);
      const escrowId = BigInt(args.escrow_id);

      const data = encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "release",
        args: [escrowId],
      });

      const txHash = await walletProvider.sendTransaction({ to: escrowAddr, data });
      await walletProvider.waitForTransactionReceipt(txHash);

      return JSON.stringify({
        success: true,
        escrowId: args.escrow_id,
        action: "released",
        txHash,
        message: `Escrow #${args.escrow_id} released. Funds sent to seller (minus 2% protocol fee).`,
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: "Failed to release escrow",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Disputes an escrow and locks funds for arbiter review.
   *
   * @param walletProvider - The wallet provider for signing transactions
   * @param args - The escrow ID and reason for dispute
   * @returns JSON with dispute confirmation and transaction hash
   */
  @CreateAction({
    name: "agora402_dispute_escrow",
    description:
      "Flag a problem with delivery and lock the escrowed funds for arbiter review. Use this when the service was not delivered, returned errors, or the quality was unacceptable.",
    schema: DisputeEscrowSchema,
  })
  async disputeEscrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DisputeEscrowSchema>,
  ): Promise<string> {
    try {
      const chainId = this.getChainId(walletProvider.getNetwork());
      const escrowAddr = this.getEscrowAddress(chainId);
      const escrowId = BigInt(args.escrow_id);

      const data = encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "dispute",
        args: [escrowId],
      });

      const txHash = await walletProvider.sendTransaction({ to: escrowAddr, data });
      await walletProvider.waitForTransactionReceipt(txHash);

      return JSON.stringify({
        success: true,
        escrowId: args.escrow_id,
        action: "disputed",
        reason: args.reason,
        txHash,
        message: `Escrow #${args.escrow_id} disputed. Funds locked for arbiter review. Reason: ${args.reason}`,
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: "Failed to dispute escrow",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Checks the current state of an escrow.
   *
   * @param walletProvider - The wallet provider for reading contract state
   * @param args - The escrow ID to check
   * @returns JSON with escrow details including state, buyer, seller, amount, and timestamps
   */
  @CreateAction({
    name: "agora402_check_escrow",
    description:
      "Check the current state of an escrow: Funded, Released, Disputed, Resolved, Expired, or Refunded.",
    schema: EscrowStatusSchema,
  })
  async checkEscrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof EscrowStatusSchema>,
  ): Promise<string> {
    try {
      const chainId = this.getChainId(walletProvider.getNetwork());
      const escrowAddr = this.getEscrowAddress(chainId);
      const escrowId = BigInt(args.escrow_id);

      const result = (await walletProvider.readContract({
        address: escrowAddr,
        abi: ESCROW_ABI,
        functionName: "getEscrow",
        args: [escrowId],
      })) as [Address, Address, bigint, bigint, bigint, number, Hex];

      const [buyer, seller, amount, createdAt, expiresAt, state] = result;

      return JSON.stringify({
        success: true,
        escrowId: args.escrow_id,
        state: STATE_NAMES[state] ?? "Unknown",
        buyer,
        seller,
        amount: this.formatUsdc(amount),
        createdAt: new Date(Number(createdAt) * 1000).toISOString(),
        expiresAt: new Date(Number(expiresAt) * 1000).toISOString(),
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: "Failed to check escrow",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Looks up the on-chain trust score of an agent address.
   *
   * @param walletProvider - The wallet provider for reading contract state
   * @param args - The address to look up
   * @returns JSON with trust score, escrow history, and recommendation
   */
  @CreateAction({
    name: "agora402_check_trust_score",
    description: `Look up the on-chain trust score of an agent address before transacting.
Score is 0-100 based on real escrow history (completed, disputed, refunded).
Check this before sending money to unknown agents. No escrow history returns score 50 with a low_trust recommendation.`,
    schema: TrustScoreSchema,
  })
  async checkTrustScore(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TrustScoreSchema>,
  ): Promise<string> {
    try {
      const chainId = this.getChainId(walletProvider.getNetwork());
      const repAddr = this.getReputationAddress(chainId);
      const agentAddr = args.address as Address;

      const [score, repData] = await Promise.all([
        walletProvider.readContract({
          address: repAddr,
          abi: REPUTATION_ABI,
          functionName: "getScore",
          args: [agentAddr],
        }) as Promise<bigint>,
        walletProvider.readContract({
          address: repAddr,
          abi: REPUTATION_ABI,
          functionName: "getReputation",
          args: [agentAddr],
        }) as Promise<[bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]>,
      ]);

      const [
        totalCompleted,
        totalDisputed,
        totalRefunded,
        totalAsProvider,
        totalAsClient,
        totalVolume,
      ] = repData;

      const totalEscrows = Number(totalCompleted) + Number(totalDisputed) + Number(totalRefunded);

      if (totalEscrows === 0) {
        return JSON.stringify({
          success: true,
          address: args.address,
          score: 50,
          totalEscrows: 0,
          recommendation: "low_trust",
          message: "No on-chain escrow history. New/unknown agent — use small escrow amounts.",
        });
      }

      const successRate = ((Number(totalCompleted) / totalEscrows) * 100).toFixed(1);
      const s = Number(score);
      const recommendation = s >= 80 ? "high_trust" : s >= 50 ? "moderate_trust" : "low_trust";

      return JSON.stringify({
        success: true,
        address: args.address,
        score: s,
        totalEscrows,
        successfulEscrows: Number(totalCompleted),
        disputedEscrows: Number(totalDisputed),
        refundedEscrows: Number(totalRefunded),
        asProvider: Number(totalAsProvider),
        asClient: Number(totalAsClient),
        totalVolume: this.formatUsdc(totalVolume),
        successRate: `${successRate}%`,
        recommendation,
      });
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: "Failed to check trust score",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Makes an API call with automatic escrow protection and response verification.
   *
   * @param walletProvider - The wallet provider for signing transactions
   * @param args - API call parameters, seller address, escrow amount, and verification schema
   * @returns JSON with API response, escrow outcome (released or disputed), and transaction hashes
   */
  @CreateAction({
    name: "agora402_protected_api_call",
    description: `Make an API call with automatic USDC escrow protection. This is the flagship Agora402 action.

Flow: Create escrow → Call API → Verify response against JSON Schema → Auto-release if valid, auto-dispute if not.

Use this instead of direct x402 payments when you want buyer protection. If the API returns bad data
or fails, funds are automatically disputed instead of lost.

Amount is in whole USDC units (e.g., 0.50 for $0.50). Do not convert to smallest units.`,
    schema: ProtectedCallSchema,
  })
  async protectedApiCall(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ProtectedCallSchema>,
  ): Promise<string> {
    try {
      const chainId = this.getChainId(walletProvider.getNetwork());
      const escrowAddr = this.getEscrowAddress(chainId);
      const amount = this.parseUsdc(args.amount_usdc);
      const timelockDuration = BigInt(args.timelock_minutes * 60);
      const serviceHash = keccak256(toBytes(args.url));

      // Step 1: Create escrow
      await this.ensureAllowance(walletProvider, chainId, amount);

      const createData = encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "createAndFund",
        args: [args.seller_address as Address, amount, timelockDuration, serviceHash],
      });

      const createTxHash = await walletProvider.sendTransaction({
        to: escrowAddr,
        data: createData,
      });
      const receipt = await walletProvider.waitForTransactionReceipt(createTxHash);

      const createdLog = receipt.logs?.find(
        (log: { address: string; topics: string[] }) =>
          log.address.toLowerCase() === escrowAddr.toLowerCase() &&
          log.topics[0] ===
            keccak256(toBytes("EscrowCreated(uint256,address,address,uint256,uint256,bytes32)")),
      );
      const escrowId = createdLog?.topics[1] ? BigInt(createdLog.topics[1]) : 0n;

      // Step 2: Make the API call
      let apiResponse: Response;
      let responseBody: string;
      try {
        apiResponse = await fetch(args.url, {
          method: args.method,
          headers: args.headers,
          body: args.method === "GET" || args.method === "DELETE" ? undefined : args.body,
        });
        responseBody = await apiResponse.text();
      } catch (fetchError) {
        // API unreachable — auto-dispute
        const disputeData = encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "dispute",
          args: [escrowId],
        });
        const disputeTxHash = await walletProvider.sendTransaction({
          to: escrowAddr,
          data: disputeData,
        });
        await walletProvider.waitForTransactionReceipt(disputeTxHash);

        return JSON.stringify({
          success: false,
          escrowId: escrowId.toString(),
          error: `API call failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          action: "auto_disputed",
          createTxHash,
          disputeTxHash,
        });
      }

      // Step 3: Validate response against JSON Schema
      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(responseBody);
      } catch {
        parsedResponse = responseBody;
      }

      let schema: Record<string, unknown>;
      try {
        schema = JSON.parse(args.verification_schema);
      } catch {
        schema = {};
      }

      const valid = validateSchema(parsedResponse, schema);

      // Step 4: Auto-release or auto-dispute
      if (valid) {
        const releaseData = encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "release",
          args: [escrowId],
        });
        const releaseTxHash = await walletProvider.sendTransaction({
          to: escrowAddr,
          data: releaseData,
        });
        await walletProvider.waitForTransactionReceipt(releaseTxHash);

        return JSON.stringify({
          success: true,
          escrowId: escrowId.toString(),
          amount: this.formatUsdc(amount),
          seller: args.seller_address,
          url: args.url,
          httpStatus: apiResponse.status,
          action: "auto_released",
          createTxHash,
          releaseTxHash,
          response: parsedResponse,
          message: `Payment of ${this.formatUsdc(amount)} released to ${args.seller_address}. Response verified against schema.`,
        });
      } else {
        const disputeData = encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "dispute",
          args: [escrowId],
        });
        const disputeTxHash = await walletProvider.sendTransaction({
          to: escrowAddr,
          data: disputeData,
        });
        await walletProvider.waitForTransactionReceipt(disputeTxHash);

        return JSON.stringify({
          success: false,
          escrowId: escrowId.toString(),
          amount: this.formatUsdc(amount),
          seller: args.seller_address,
          url: args.url,
          httpStatus: apiResponse.status,
          action: "auto_disputed",
          createTxHash,
          disputeTxHash,
          response: parsedResponse,
          message: `Escrow #${escrowId} auto-disputed. Response failed schema verification.`,
        });
      }
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: "Protected API call failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Checks if the action provider supports the given network.
   * Agora402 is deployed on Base mainnet (8453) and Base Sepolia (84532).
   *
   * @param network - The network to check support for
   * @returns True if the network is Base mainnet or Base Sepolia
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && (network.chainId === "8453" || network.chainId === "84532");

  /**
   * Resolves the escrow contract address for a given chain.
   *
   * @param chainId - The chain ID to resolve
   * @returns The escrow contract address
   */
  private getEscrowAddress(chainId: number): Address {
    if (this.escrowAddr) return this.escrowAddr;
    const addr = ESCROW_ADDRESSES[chainId];
    if (!addr) throw new Error(`No Agora402 escrow contract on chain ${chainId}`);
    return addr;
  }

  /**
   * Resolves the reputation contract address for a given chain.
   *
   * @param chainId - The chain ID to resolve
   * @returns The reputation contract address
   */
  private getReputationAddress(chainId: number): Address {
    if (this.reputationAddr) return this.reputationAddr;
    const addr = REPUTATION_ADDRESSES[chainId];
    if (!addr) throw new Error(`No Agora402 reputation contract on chain ${chainId}`);
    return addr;
  }

  /**
   * Resolves the USDC token address for a given chain.
   *
   * @param chainId - The chain ID to resolve
   * @returns The USDC token address
   */
  private getUsdcAddress(chainId: number): Address {
    if (this.usdcAddr) return this.usdcAddr;
    const addr = USDC_ADDRESSES[chainId];
    if (!addr) throw new Error(`No USDC address for chain ${chainId}`);
    return addr;
  }

  /**
   * Extracts the numeric chain ID from a Network object.
   *
   * @param network - The network to extract chain ID from
   * @returns The numeric chain ID (defaults to Base Sepolia 84532)
   */
  private getChainId(network: Network): number {
    return Number(network.chainId ?? "84532");
  }

  /**
   * Converts a USDC amount in whole units to its smallest unit (6 decimals).
   *
   * @param amount - The USDC amount in whole units (e.g., 1.50)
   * @returns The amount in smallest units as a bigint
   */
  private parseUsdc(amount: number): bigint {
    return parseUnits(amount.toString(), USDC_DECIMALS);
  }

  /**
   * Formats a USDC amount from smallest units to a human-readable string.
   *
   * @param amount - The USDC amount in smallest units
   * @returns A formatted string like "$1.50 USDC"
   */
  private formatUsdc(amount: bigint): string {
    return `$${formatUnits(amount, USDC_DECIMALS)} USDC`;
  }

  /**
   * Ensures the escrow contract has sufficient USDC allowance.
   * Sends an approve transaction if the current allowance is too low.
   *
   * @param walletProvider - The wallet provider for sending transactions
   * @param chainId - The chain ID to operate on
   * @param amount - The required USDC allowance in smallest units
   * @returns The approve transaction hash, or null if already approved
   */
  private async ensureAllowance(
    walletProvider: EvmWalletProvider,
    chainId: number,
    amount: bigint,
  ): Promise<string | null> {
    const usdcAddr = this.getUsdcAddress(chainId);
    const escrowAddr = this.getEscrowAddress(chainId);
    const owner = walletProvider.getAddress() as Address;

    const allowance = (await walletProvider.readContract({
      address: usdcAddr,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [owner, escrowAddr],
    })) as bigint;

    if (allowance < amount) {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [escrowAddr, amount],
      });
      const txHash = await walletProvider.sendTransaction({ to: usdcAddr, data });
      await walletProvider.waitForTransactionReceipt(txHash);
      return txHash;
    }

    return null;
  }
}

/**
 * Minimal JSON Schema validation — checks type and required fields.
 * Used to verify API responses before releasing escrow payments.
 *
 * @param data - The data to validate
 * @param schema - The JSON Schema to validate against
 * @returns True if the data matches the schema
 */
function validateSchema(data: unknown, schema: Record<string, unknown>): boolean {
  if (!schema || Object.keys(schema).length === 0) return true;
  if (schema.type === "object" && typeof data === "object" && data !== null) {
    const required = (schema.required as string[]) ?? [];
    const obj = data as Record<string, unknown>;
    return required.every(key => key in obj);
  }
  if (schema.type === "array") return Array.isArray(data);
  if (schema.type === "string") return typeof data === "string";
  if (schema.type === "number") return typeof data === "number";
  return true;
}

/**
 * Factory function to create an Agora402ActionProvider instance.
 *
 * @param config - Optional configuration to override default contract addresses
 * @returns A new Agora402ActionProvider instance
 */
export const agora402ActionProvider = (config?: Agora402Config) =>
  new Agora402ActionProvider(config);
