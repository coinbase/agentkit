import { z } from "zod";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const AGENT_REF_REGEX = /^(\d{1,12}|8004-base-\d{1,12}|0x[a-fA-F0-9]{40})$/;
const HTTPS_URL_REGEX = /^https:\/\/[^\s]{1,500}$/i;

const AgentRef = z
  .string()
  .trim()
  .regex(
    AGENT_REF_REGEX,
    "Expected an ERC-8004 token id on Base (e.g. 57657), its slug (8004-base-57657) or the wallet address bound to it (0x...)",
  )
  .describe(
    'The agent: its ERC-8004 token id on Base (e.g. "57657"), its slug ("8004-base-57657"), or the wallet address bound to it (0x...)',
  );

/**
 * Input schema for checking an ERC-8004 agent on Base.
 */
export const CheckAgentSchema = z
  .object({
    agent: AgentRef,
  })
  .strip()
  .describe("Instructions for checking an ERC-8004 agent on Base before trusting or paying it");

/**
 * Input schema for fetching an agent's latest signed statement.
 */
export const GetAgentStatementSchema = z
  .object({
    agent: AgentRef,
  })
  .strip()
  .describe("Instructions for fetching an agent's latest signed statement");

/**
 * Input schema for checking a payment destination on Base.
 */
export const CheckPayeeSchema = z
  .object({
    payee: z
      .string()
      .trim()
      .refine(
        value => ADDRESS_REGEX.test(value) || HTTPS_URL_REGEX.test(value),
        "Expected a 0x address on Base or the https:// URL of an x402 resource",
      )
      .describe(
        "Where the payment would go: a 0x address on Base (for example the payTo of an x402 payment request), or the https:// URL of an x402 resource listed in the x402 Bazaar",
      ),
  })
  .strip()
  .describe("Instructions for checking a payment destination on Base before paying it");

/**
 * Input schema for the AI-agent economy overview (no inputs).
 */
export const GetAgentEconomyOverviewSchema = z
  .object({})
  .strip()
  .describe("Instructions for fetching the headline figures of AI-agent money on Base");
