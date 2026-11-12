import { z } from "zod";

/**
 * Input schema for validating an onchain transaction against safety rules and spend limits.
 */
export const ValidateTransactionSchema = z
  .object({
    to: z.string().describe("The recipient or target smart contract Ethereum address"),
    value: z
      .string()
      .nullable()
      .optional()
      .transform(val => val ?? "0")
      .describe("The native asset value to send (in Wei or decimal ETH string, e.g. '0.01')"),
    data: z
      .string()
      .nullable()
      .optional()
      .transform(val => val ?? "0x")
      .describe("The hex-encoded calldata for the transaction"),
    userPrompt: z
      .string()
      .optional()
      .describe("The original user prompt or instruction that prompted this transaction"),
    reasoningTrace: z
      .string()
      .optional()
      .describe("The agent's internal reasoning or plan for initiating this action"),
  })
  .describe("Parameters for pre-flight validation of an EVM transaction before signing");

/**
 * Input schema for verifying an HTTP 402 Payment Required challenge.
 */
export const VerifyX402ChallengeSchema = z
  .object({
    merchant: z.string().describe("The recipient merchant address demanding payment"),
    amountUsdc: z
      .string()
      .describe("The amount of USDC requested by the 402 challenge (e.g. '0.50')"),
    resourceUri: z.string().describe("The target resource URL or API endpoint being paid for"),
    nonce: z.string().describe("The unique anti-replay challenge nonce"),
    deadline: z.number().describe("The unix timestamp in seconds when the challenge expires"),
    tokenAddress: z.string().optional().describe("The token requested (defaults to Base USDC)"),
  })
  .describe("Parameters for validating an x402 payment challenge");

/**
 * Input schema for scanning a prompt or reasoning text for safety hazards.
 */
export const ScanPromptSafetySchema = z
  .object({
    prompt: z
      .string()
      .describe("The text prompt or agent instruction to scan for jailbreaks or drain attempts"),
  })
  .describe("Parameters for scanning a prompt for injection vectors and wallet drain commands");

/**
 * Input schema for retrieving active guardrail policies.
 */
export const GetGuardPolicySchema = z
  .object({})
  .describe("Retrieve current active spending ceilings, allowlists, and guardrail settings");
