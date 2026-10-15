import { z } from "zod";

/**
 * Transfer input schema.
 *
 * Note what is NOT here: `calldata`, `data`, `abi`, and `simulate`.
 *
 * - Raw calldata is never requested from the model. The model picks the
 *   recipient, amount and token; code builds the transaction. Same idea as an
 *   address book: models cannot be relied on to produce correct hex.
 * - `simulate` is not a parameter. This provider ALWAYS simulates first and
 *   refuses on `wouldRevert`. Making it optional would let the model turn it
 *   off, and would open the misspelling class KeeperHub tracks in issue #2004
 *   (a misspelled body key is accepted silently and the transaction is
 *   broadcast for real).
 */
export const TransferSchema = z
  .object({
    recipientAddress: z
      .string()
      .describe("Recipient address. 0x…, either all lowercase or a correct EIP-55 checksum."),
    amount: z.string().describe('Amount in whole units, not wei. Example: "1.5" for 1.5 USDC.'),
    tokenAddress: z
      .string()
      .optional()
      .describe("ERC-20 contract address. Omit to send the chain's native token."),
    taskId: z
      .string()
      .describe(
        "A stable identifier for this piece of WORK, not for this attempt. " +
          "Examples: an invoice number, a payroll period, a job id. It must be " +
          "the same when the same work is retried, and different for different " +
          "work. The idempotency key is derived from it.",
      ),
  })
  .strict()
  .describe("Send tokens through KeeperHub: simulate first, then execute idempotently.");

/**
 * Schema for asking about the outcome of an execution.
 *
 * This is the action AgentKit has no equivalent for. After an action fails,
 * AgentKit returns only error text; there is no identifier to ask about again.
 * `executionId` makes "what actually happened?" answerable at any time.
 */
export const GetExecutionStatusSchema = z
  .object({
    executionId: z.string().describe("The executionId returned by an earlier transfer action."),
  })
  .strict()
  .describe("Ask for the final outcome of an execution, with receipts re-read from chain.");
