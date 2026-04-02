import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  RememberOutcomeSchema,
  RecallMemoriesSchema,
  ChargePaymentSchema,
  SettlePaymentSchema,
  RefundPaymentSchema,
  CheckBalanceSchema,
  AgentProfileSchema,
} from "./schemas";

// eslint-disable-next-line @typescript-eslint/no-require-imports
type MnemoPayLiteType = import("@mnemopay/sdk").MnemoPayLite;

/**
 * Configuration options for the MnemoPayActionProvider.
 */
export interface MnemoPayActionProviderConfig {
  /**
   * Unique identifier for the agent.
   */
  agentId?: string;

  /**
   * Memory decay rate (0.0 to 1.0). Controls how fast old memories fade.
   * Lower values = slower decay. Default: 0.05
   */
  decayRate?: number;
}

/**
 * MnemoPayActionProvider gives AI agents economic memory through the MnemoPay SDK.
 *
 * Agents can remember payment outcomes, learn from settlements and refunds,
 * and build reputation over time. This enables agents to make better economic
 * decisions based on past interactions.
 *
 * @augments ActionProvider
 */
export class MnemoPayActionProvider extends ActionProvider {
  private agent: MnemoPayLiteType | null = null;
  private config: MnemoPayActionProviderConfig;

  /**
   * Constructor for the MnemoPayActionProvider class.
   *
   * @param config - The configuration options for the MnemoPayActionProvider
   */
  constructor(config: MnemoPayActionProviderConfig = {}) {
    super("mnemopay", []);

    this.config = { ...config };
    this.config.agentId ||= process.env.MNEMOPAY_AGENT_ID || "default-agent";
    this.config.decayRate ??= Number(process.env.MNEMOPAY_DECAY_RATE) || 0.05;
  }

  /**
   * Store a memory about a payment outcome, provider interaction, or any economic event.
   * Memories are scored by importance and can be tagged for categorization.
   * Over time, memories decay unless reinforced by settlements.
   *
   * @param args - The memory content, importance, and optional tags
   * @returns A confirmation message with the stored memory details
   */
  @CreateAction({
    name: "remember_outcome",
    description: `
This tool stores a memory about a payment outcome, provider interaction, or any economic event.
Memories are scored by importance (0.0-1.0) and can be tagged for categorization.
Over time, memories naturally decay unless reinforced by successful payment settlements.

Use this to record:
- Quality of work from a provider ("Provider X delivered excellent design work")
- Payment outcomes ("Payment to Y was disputed due to late delivery")
- Economic patterns ("Service prices tend to be lower on weekends")

It takes the following inputs:
- content: The memory content to store (required)
- importance: Importance score from 0.0 to 1.0 (optional, default 0.5)
- tags: Array of categorization tags (optional)`,
    schema: RememberOutcomeSchema,
  })
  async rememberOutcome(args: z.infer<typeof RememberOutcomeSchema>): Promise<string> {
    try {
      const client = await this.getClient();
      await client.remember(args.content, {
        importance: args.importance ?? 0.5,
        tags: args.tags ?? [],
      });
      return [
        "Successfully stored memory:",
        `- Content: ${args.content}`,
        `- Importance: ${args.importance ?? 0.5}`,
        `- Tags: ${(args.tags ?? []).join(", ") || "none"}`,
      ].join("\n");
    } catch (error) {
      return `Error storing memory: ${error}`;
    }
  }

  /**
   * Recall memories by semantic query. Returns the most relevant memories
   * ranked by a combination of semantic similarity and importance score.
   *
   * @param args - The semantic query and optional result limit
   * @returns A formatted list of recalled memories with scores
   */
  @CreateAction({
    name: "recall_memories",
    description: `
This tool recalls memories by semantic query, returning the most relevant memories
ranked by a combination of semantic similarity and importance score.

Use this to:
- Find reliable providers ("good providers for design work")
- Check payment history ("past payments over $100")
- Review interaction patterns ("providers who delivered late")

It takes the following inputs:
- query: Semantic search query (required)
- limit: Maximum number of results to return (optional, default 5, max 50)`,
    schema: RecallMemoriesSchema,
  })
  async recallMemories(args: z.infer<typeof RecallMemoriesSchema>): Promise<string> {
    try {
      const client = await this.getClient();
      const memories = await client.recall(args.query, args.limit ?? 5);

      if (!memories || memories.length === 0) {
        return "No memories found matching the query.";
      }

      const formatted = memories.map(
        (m: { content: string; score: number; tags?: string[] }, i: number) =>
          [
            `${i + 1}. [Score: ${m.score.toFixed(3)}] ${m.content}`,
            m.tags && m.tags.length > 0 ? `   Tags: ${m.tags.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
      );

      return [`Recalled ${memories.length} memories for "${args.query}":`, ...formatted].join("\n");
    } catch (error) {
      return `Error recalling memories: ${error}`;
    }
  }

  /**
   * Charge a payment, creating an escrow. The payment is held until settled or refunded.
   * This is the starting point for any economic transaction.
   *
   * @param args - The amount and description for the payment
   * @returns The transaction ID and payment details
   */
  @CreateAction({
    name: "charge_payment",
    description: `
This tool charges a payment and creates an escrow. The payment is held until explicitly
settled (releasing funds and reinforcing positive memories) or refunded (returning funds
and docking reputation).

Use this when the agent needs to:
- Pay for a service or task
- Create an escrow for a new transaction
- Initiate a payment that will later be settled or refunded

It takes the following inputs:
- amount: The payment amount in agent currency units (required, must be positive)
- description: What the payment is for (required)

Returns a transaction ID that must be used with settle_payment or refund_payment.`,
    schema: ChargePaymentSchema,
  })
  async chargePayment(args: z.infer<typeof ChargePaymentSchema>): Promise<string> {
    try {
      const client = await this.getClient();
      const transactionId = await client.charge(args.amount, args.description);
      return [
        "Payment charged successfully:",
        `- Transaction ID: ${transactionId}`,
        `- Amount: ${args.amount}`,
        `- Description: ${args.description}`,
        "",
        "Use settle_payment or refund_payment with this transaction ID to complete the flow.",
      ].join("\n");
    } catch (error) {
      return `Error charging payment: ${error}`;
    }
  }

  /**
   * Settle a payment, releasing the escrow. This positively reinforces the memories
   * that led to the payment decision, increasing the agent's confidence in similar
   * future decisions.
   *
   * @param args - The transaction ID to settle
   * @returns Confirmation of settlement
   */
  @CreateAction({
    name: "settle_payment",
    description: `
This tool settles a previously charged payment, releasing the escrow funds.
Settlement positively reinforces (+0.05) the memories that led to this payment decision,
helping the agent learn which providers and decisions lead to good outcomes.

Use this when:
- Work was delivered satisfactorily
- A service was completed as expected
- The agent wants to reinforce positive economic patterns

It takes the following inputs:
- transactionId: The transaction ID from charge_payment (required)`,
    schema: SettlePaymentSchema,
  })
  async settlePayment(args: z.infer<typeof SettlePaymentSchema>): Promise<string> {
    try {
      const client = await this.getClient();
      await client.settle(args.transactionId);
      return [
        "Payment settled successfully:",
        `- Transaction ID: ${args.transactionId}`,
        "- Reputation: +0.05 (positive reinforcement applied)",
        "- Related memories have been strengthened.",
      ].join("\n");
    } catch (error) {
      return `Error settling payment: ${error}`;
    }
  }

  /**
   * Refund a payment, returning the escrowed funds. This negatively reinforces the
   * memories that led to the payment decision, helping the agent avoid similar
   * mistakes in the future.
   *
   * @param args - The transaction ID to refund
   * @returns Confirmation of refund
   */
  @CreateAction({
    name: "refund_payment",
    description: `
This tool refunds a previously charged payment, returning the escrowed funds.
Refunding negatively reinforces (-0.05) the memories that led to this payment decision,
helping the agent learn which providers and decisions lead to poor outcomes.

Use this when:
- Work was not delivered or was unsatisfactory
- A service failed to meet expectations
- The agent wants to penalize negative economic patterns

It takes the following inputs:
- transactionId: The transaction ID from charge_payment (required)`,
    schema: RefundPaymentSchema,
  })
  async refundPayment(args: z.infer<typeof RefundPaymentSchema>): Promise<string> {
    try {
      const client = await this.getClient();
      await client.refund(args.transactionId);
      return [
        "Payment refunded successfully:",
        `- Transaction ID: ${args.transactionId}`,
        "- Reputation: -0.05 (negative reinforcement applied)",
        "- Related memories have been weakened.",
      ].join("\n");
    } catch (error) {
      return `Error refunding payment: ${error}`;
    }
  }

  /**
   * Check the agent's current wallet balance and reputation score.
   *
   * @param _ - Empty parameter object (not used)
   * @returns The agent's balance and reputation details
   */
  @CreateAction({
    name: "check_balance",
    description: `
This tool returns the agent's current wallet balance and reputation score.

The reputation score reflects the agent's economic track record:
- Starts at 1.0
- Increases with successful settlements (+0.05 each)
- Decreases with refunds (-0.05 each)
- Higher reputation = more trustworthy economic decisions`,
    schema: CheckBalanceSchema,
  })
  async checkBalance(_: z.infer<typeof CheckBalanceSchema>): Promise<string> {
    try {
      const client = await this.getClient();
      const balance = client.balance();
      return [
        "Agent Balance:",
        `- Wallet: ${balance.wallet}`,
        `- Reputation: ${balance.reputation}`,
      ].join("\n");
    } catch (error) {
      return `Error checking balance: ${error}`;
    }
  }

  /**
   * Get the agent's full profile including memory statistics, balance, and reputation.
   *
   * @param _ - Empty parameter object (not used)
   * @returns The agent's complete profile
   */
  @CreateAction({
    name: "agent_profile",
    description: `
This tool returns the agent's full profile, including:
- Agent ID and configuration
- Wallet balance and reputation score
- Memory statistics (total memories, decay rate)
- Economic activity summary

Use this for a comprehensive overview of the agent's economic state.`,
    schema: AgentProfileSchema,
  })
  async agentProfile(_: z.infer<typeof AgentProfileSchema>): Promise<string> {
    try {
      const client = await this.getClient();
      const profile = client.profile();
      return [
        "Agent Profile:",
        `${JSON.stringify(profile, null, 2)}`,
      ].join("\n");
    } catch (error) {
      return `Error retrieving agent profile: ${error}`;
    }
  }

  /**
   * Checks if the MnemoPay action provider supports the given network.
   * MnemoPay operates at the application layer and is network-agnostic.
   *
   * @param _ - The network to check (not used)
   * @returns Always returns true as MnemoPay is network-independent
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Get the MnemoPay client, initializing it if needed.
   *
   * @returns The MnemoPayLite instance
   */
  private async getClient(): Promise<MnemoPayLiteType> {
    if (!this.agent) {
      const { MnemoPayLite } = await import("@mnemopay/sdk");
      this.agent = new MnemoPayLite(
        this.config.agentId!,
        this.config.decayRate!,
      );
    }
    return this.agent;
  }
}

/**
 * Factory function to create a new MnemoPayActionProvider instance.
 *
 * @param config - The configuration options for the MnemoPayActionProvider
 * @returns A new instance of MnemoPayActionProvider
 */
export const mnemoPayActionProvider = (config: MnemoPayActionProviderConfig = {}) =>
  new MnemoPayActionProvider(config);
