import { z } from "zod";

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const HEX_REGEX = /^0x[0-9a-fA-F]*$/;

/**
 * Input schema for the simulate_and_guard_transaction action.
 */
export const SimulateAndGuardInputSchema = z
  .object({
    targetContract: z
      .string()
      .regex(ADDRESS_REGEX, "targetContract must be a 0x-prefixed 20-byte address")
      .describe("The contract on Base that the transaction will call"),
    calldata: z
      .string()
      .regex(HEX_REGEX, "calldata must be 0x-prefixed hex")
      .nullable()
      .transform(val => val ?? "0x")
      .describe("The exact 0x-prefixed calldata the agent is about to send (defaults to 0x)"),
    fromAddress: z
      .string()
      .regex(ADDRESS_REGEX, "fromAddress must be a 0x-prefixed 20-byte address")
      .nullable()
      .describe("The sender to simulate from (defaults to the service's choice when null)"),
    valueWei: z
      .string()
      .regex(/^(0x[0-9a-fA-F]+|[0-9]+)$/, "valueWei must be a decimal or 0x-prefixed hex integer")
      .nullable()
      .transform(val => val ?? "0")
      .describe("The ETH value sent with the transaction, in wei (defaults to 0)"),
    tokenAddress: z
      .string()
      .regex(ADDRESS_REGEX, "tokenAddress must be a 0x-prefixed 20-byte address")
      .nullable()
      .describe("An ERC-20 token to inspect for honeypot restrictions and transfer taxes"),
  })
  .strict();
