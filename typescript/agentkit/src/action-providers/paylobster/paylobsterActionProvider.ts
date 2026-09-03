import { z } from "zod";
import { encodeFunctionData, Hex, parseUnits, formatUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  RegisterIdentitySchema,
  CreateEscrowSchema,
  ReleaseEscrowSchema,
  CheckReputationSchema,
  GetCreditScoreSchema,
  GetAgentProfileSchema,
} from "./schemas";
import {
  PAYLOBSTER_CONTRACTS,
  IDENTITY_ABI,
  REPUTATION_ABI,
  CREDIT_ABI,
  ESCROW_ABI,
  USDC_ABI,
} from "./constants";

/**
 * PayLobsterActionProvider enables AI agents to interact with PayLobster's
 * agent-to-agent payment infrastructure on Base L2.
 *
 * PayLobster provides:
 * - On-chain agent identity registration
 * - USDC escrow payments for trustless transactions
 * - Reputation tracking for agents
 * - Credit scoring and limits
 * - Agent profile discovery
 *
 * All contracts are deployed on Base Mainnet (Chain ID: 8453).
 */
export class PayLobsterActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructs a new PayLobsterActionProvider.
   */
  constructor() {
    super("paylobster", []);
  }

  /**
   * Register an AI agent identity in the PayLobster system.
   *
   * Creates an on-chain identity NFT that represents the agent and enables
   * participation in the PayLobster ecosystem (escrows, reputation, credit).
   *
   * @param walletProvider - The wallet provider to use for the transaction.
   * @param args - The registration parameters (name, agentURI, capabilities).
   * @returns A stringified JSON response with transaction details.
   */
  @CreateAction({
    name: "register_identity",
    description: `Register an AI agent identity in the PayLobster system on Base.

This creates an on-chain identity NFT that represents the agent and enables
it to participate in the PayLobster ecosystem (escrows, reputation, credit).

Inputs:
- name: Agent name (e.g., "AI Trading Assistant")
- agentURI: URI pointing to agent metadata (IPFS hash or URL)
- capabilities: Comma-separated capabilities (e.g., "trading,analysis,escrow")

Example: Register an agent named "TradeBot" with trading capabilities.
`,
    schema: RegisterIdentitySchema,
  })
  async registerIdentity(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RegisterIdentitySchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: IDENTITY_ABI,
        functionName: "register",
        args: [args.agentURI, args.name, args.capabilities],
      });

      const hash = await walletProvider.sendTransaction({
        to: PAYLOBSTER_CONTRACTS.IDENTITY,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return JSON.stringify({
        success: true,
        transactionHash: hash,
        contract: PAYLOBSTER_CONTRACTS.IDENTITY,
        agentName: args.name,
        message: `Identity registered for ${args.name}`,
        explorerUrl: `https://basescan.org/tx/${hash}`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to register identity: ${error}`,
      });
    }
  }

  /**
   * Create a USDC escrow payment on Base.
   *
   * Locks USDC in a smart contract escrow that can be released to the recipient
   * once conditions are met. Perfect for agent-to-agent payments and service agreements.
   *
   * Note: Requires USDC balance and performs two transactions:
   * 1. Approve USDC spending
   * 2. Create the escrow
   *
   * @param walletProvider - The wallet provider to use for the transactions.
   * @param args - The escrow parameters (recipient, amount, description).
   * @returns A stringified JSON response with escrow details.
   */
  @CreateAction({
    name: "create_escrow",
    description: `Create an escrow payment on Base using USDC.

This locks USDC in a smart contract escrow that can be released to the recipient
once conditions are met. Perfect for agent-to-agent payments, service agreements,
and trustless transactions.

Inputs:
- recipient: Recipient address (0x...)
- amount: Amount of USDC (e.g., "100" for $100 USDC)
- description: Purpose of the escrow (e.g., "Payment for AI analysis")

Note: This requires USDC balance and will perform two transactions:
1. Approve USDC spending
2. Create the escrow

Example: Create a $100 escrow for an AI service provider.
`,
    schema: CreateEscrowSchema,
  })
  async createEscrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateEscrowSchema>,
  ): Promise<string> {
    try {
      // Parse amount (USDC has 6 decimals on Base)
      const amountWei = parseUnits(args.amount, 6);

      // Step 1: Approve USDC spending
      const approveData = encodeFunctionData({
        abi: USDC_ABI,
        functionName: "approve",
        args: [PAYLOBSTER_CONTRACTS.ESCROW_V3, amountWei],
      });

      const approveHash = await walletProvider.sendTransaction({
        to: PAYLOBSTER_CONTRACTS.USDC,
        data: approveData,
      });

      await walletProvider.waitForTransactionReceipt(approveHash);

      // Step 2: Create escrow
      const escrowData = encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "createEscrow",
        args: [args.recipient as Hex, amountWei, PAYLOBSTER_CONTRACTS.USDC, args.description],
      });

      const escrowHash = await walletProvider.sendTransaction({
        to: PAYLOBSTER_CONTRACTS.ESCROW_V3,
        data: escrowData,
      });

      await walletProvider.waitForTransactionReceipt(escrowHash);

      return JSON.stringify({
        success: true,
        approveTxHash: approveHash,
        escrowTxHash: escrowHash,
        amount: args.amount,
        recipient: args.recipient,
        description: args.description,
        explorerUrl: `https://basescan.org/tx/${escrowHash}`,
        message: `Escrow created for ${args.amount} USDC to ${args.recipient}`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to create escrow: ${error}`,
      });
    }
  }

  /**
   * Release funds from an escrow to the recipient.
   *
   * Transfers the escrowed USDC to the recipient. Only the original sender
   * can release the funds. Use this after the escrow conditions are met.
   *
   * @param walletProvider - The wallet provider to use for the transaction.
   * @param args - The release parameters (escrowId).
   * @returns A stringified JSON response with release details.
   */
  @CreateAction({
    name: "release_escrow",
    description: `Release funds from an escrow to the recipient.

Transfers the escrowed USDC to the recipient. Only the original sender
can release the funds. Use this after the escrow conditions are met.

Inputs:
- escrowId: The escrow ID to release (from createEscrow response)

Example: Release escrow #42 after service completion.
`,
    schema: ReleaseEscrowSchema,
  })
  async releaseEscrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ReleaseEscrowSchema>,
  ): Promise<string> {
    try {
      const data = encodeFunctionData({
        abi: ESCROW_ABI,
        functionName: "releaseEscrow",
        args: [BigInt(args.escrowId)],
      });

      const hash = await walletProvider.sendTransaction({
        to: PAYLOBSTER_CONTRACTS.ESCROW_V3,
        data,
      });

      await walletProvider.waitForTransactionReceipt(hash);

      return JSON.stringify({
        success: true,
        transactionHash: hash,
        escrowId: args.escrowId,
        explorerUrl: `https://basescan.org/tx/${hash}`,
        message: `Escrow ${args.escrowId} released successfully`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to release escrow: ${error}`,
      });
    }
  }

  /**
   * Check the reputation score of an agent or address.
   *
   * Queries the PayLobster reputation contract to get the reputation score
   * and trust vector for any address. Higher scores indicate more trusted agents.
   *
   * @param walletProvider - The wallet provider to use for the query.
   * @param args - The query parameters (address).
   * @returns A stringified JSON response with reputation details.
   */
  @CreateAction({
    name: "check_reputation",
    description: `Check the reputation score of an agent or address.

Queries the PayLobster reputation contract to get the reputation score
and trust vector for any address. Higher scores indicate more trusted agents.

Inputs:
- address: Address to check (0x...)

Example: Check reputation before creating an escrow with an unknown agent.
`,
    schema: CheckReputationSchema,
  })
  async checkReputation(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CheckReputationSchema>,
  ): Promise<string> {
    try {
      const result = (await walletProvider.readContract({
        address: PAYLOBSTER_CONTRACTS.REPUTATION,
        abi: REPUTATION_ABI,
        functionName: "getReputation",
        args: [args.address as Hex],
      })) as [bigint, bigint];

      const [score, trustVector] = result;

      return JSON.stringify({
        success: true,
        address: args.address,
        score: score.toString(),
        trustVector: trustVector.toString(),
        message: `Reputation score for ${args.address}: ${score}`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to check reputation: ${error}`,
      });
    }
  }

  /**
   * Get the credit score and status for an address.
   *
   * Returns credit score (0-1000 scale), credit limit, available credit,
   * and credit currently in use.
   *
   * @param walletProvider - The wallet provider to use for the query.
   * @param args - The query parameters (address).
   * @returns A stringified JSON response with credit details.
   */
  @CreateAction({
    name: "get_credit_score",
    description: `Get the credit score and status for an address.

Returns:
- Credit score (0-1000 scale)
- Credit limit (maximum USDC that can be borrowed)
- Available credit (remaining credit)
- Credit in use (currently borrowed amount)

Inputs:
- address: Address to check (0x...)

Example: Check your own credit status before requesting a loan.
`,
    schema: GetCreditScoreSchema,
  })
  async getCreditScore(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetCreditScoreSchema>,
  ): Promise<string> {
    try {
      // Get credit score
      const score = (await walletProvider.readContract({
        address: PAYLOBSTER_CONTRACTS.CREDIT,
        abi: CREDIT_ABI,
        functionName: "getCreditScore",
        args: [args.address as Hex],
      })) as bigint;

      // Get credit status
      const status = (await walletProvider.readContract({
        address: PAYLOBSTER_CONTRACTS.CREDIT,
        abi: CREDIT_ABI,
        functionName: "getCreditStatus",
        args: [args.address as Hex],
      })) as [bigint, bigint, bigint];

      const [limit, available, inUse] = status;

      return JSON.stringify({
        success: true,
        address: args.address,
        creditScore: score.toString(),
        creditLimit: formatUnits(limit, 6) + " USDC",
        availableCredit: formatUnits(available, 6) + " USDC",
        creditInUse: formatUnits(inUse, 6) + " USDC",
        message: `Credit score for ${args.address}: ${score}`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to get credit score: ${error}`,
      });
    }
  }

  /**
   * Get the profile of a registered PayLobster agent.
   *
   * Retrieves the agent's on-chain identity information including name,
   * agent ID (NFT token ID), and registration status.
   *
   * @param walletProvider - The wallet provider to use for the query.
   * @param args - The query parameters (address).
   * @returns A stringified JSON response with agent profile details.
   */
  @CreateAction({
    name: "get_agent_profile",
    description: `Get the profile of a registered PayLobster agent.

Retrieves the agent's on-chain identity information including name,
agent ID (NFT token ID), and registration status.

Inputs:
- address: Agent address to look up (0x...)

Example: Look up an agent's profile before initiating a transaction.
`,
    schema: GetAgentProfileSchema,
  })
  async getAgentProfile(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentProfileSchema>,
  ): Promise<string> {
    try {
      const result = (await walletProvider.readContract({
        address: PAYLOBSTER_CONTRACTS.IDENTITY,
        abi: IDENTITY_ABI,
        functionName: "getAgentInfo",
        args: [args.address as Hex],
      })) as [string, bigint, boolean];

      const [name, tokenId, registered] = result;

      if (!registered) {
        return JSON.stringify({
          success: true,
          registered: false,
          address: args.address,
          message: `No agent registered at ${args.address}`,
        });
      }

      return JSON.stringify({
        success: true,
        registered: true,
        address: args.address,
        name,
        agentId: tokenId.toString(),
        message: `Agent "${name}" (ID: ${tokenId})`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Failed to get agent profile: ${error}`,
      });
    }
  }

  /**
   * Checks if the PayLobster action provider supports the given network.
   *
   * PayLobster only operates on Base Mainnet (Chain ID: 8453).
   *
   * @param network - The network to check.
   * @returns True if the network is Base Mainnet, false otherwise.
   */
  supportsNetwork = (network: Network) => {
    return network.protocolFamily === "evm" && network.chainId === "8453";
  };
}

/**
 * Factory function to create a PayLobster action provider.
 *
 * @returns PayLobster action provider instance
 *
 * @example
 * ```typescript
 * import { paylobsterActionProvider } from '@coinbase/agentkit';
 * import { CdpWalletProvider } from '@coinbase/agentkit';
 *
 * const wallet = new CdpWalletProvider();
 * const paylobster = paylobsterActionProvider();
 * ```
 */
export const paylobsterActionProvider = () => new PayLobsterActionProvider();
