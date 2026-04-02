import { z } from "zod";

/**
 * Input schema for storing a memory about a payment outcome or interaction.
 */
export const RememberOutcomeSchema = z
  .object({
    content: z
      .string()
      .min(1, "Memory content is required.")
      .describe("The memory content to store (e.g. 'Provider X delivered high-quality work on time')"),
    importance: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Importance score from 0.0 to 1.0 (default: 0.5)"),
    tags: z
      .array(z.string())
      .optional()
      .describe("Optional tags to categorize the memory (e.g. ['provider', 'quality', 'fast'])"),
  })
  .describe("Input schema for storing a memory about a payment outcome or interaction");

/**
 * Input schema for recalling memories by semantic query.
 */
export const RecallMemoriesSchema = z
  .object({
    query: z
      .string()
      .min(1, "Query is required.")
      .describe("Semantic query to search memories (e.g. 'reliable providers for design work')"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of memories to return (default: 5)"),
  })
  .describe("Input schema for recalling memories by semantic query");

/**
 * Input schema for charging a payment (creating an escrow).
 */
export const ChargePaymentSchema = z
  .object({
    amount: z
      .number()
      .positive("Amount must be positive.")
      .describe("The amount to charge in the agent's currency units"),
    description: z
      .string()
      .min(1, "Payment description is required.")
      .describe("Description of what the payment is for (e.g. 'Payment for logo design task')"),
  })
  .describe("Input schema for charging a payment and creating an escrow");

/**
 * Input schema for settling a payment (releasing escrow, positive reinforcement).
 */
export const SettlePaymentSchema = z
  .object({
    transactionId: z
      .string()
      .min(1, "Transaction ID is required.")
      .describe("The transaction ID returned from charge_payment to settle"),
  })
  .describe("Input schema for settling a payment and reinforcing positive memories");

/**
 * Input schema for refunding a payment (negative reinforcement).
 */
export const RefundPaymentSchema = z
  .object({
    transactionId: z
      .string()
      .min(1, "Transaction ID is required.")
      .describe("The transaction ID returned from charge_payment to refund"),
  })
  .describe("Input schema for refunding a payment and docking reputation");

/**
 * Input schema for checking the agent's balance and reputation.
 */
export const CheckBalanceSchema = z
  .object({})
  .describe("Input schema for checking the agent's wallet balance and reputation score");

/**
 * Input schema for retrieving the agent's full profile.
 */
export const AgentProfileSchema = z
  .object({})
  .describe("Input schema for retrieving the agent's full profile including memory stats");
