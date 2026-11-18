import { z } from "zod";

/**
 * OpenAI-shape chat message.
 */
const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

/**
 * Input schema for the `nexus_chat` action.
 *
 * Mirrors the OpenAI chat completions request shape. The optional `network`
 * field selects the settlement chain — must match a chain the configured
 * wallet can sign for. For an `SvmWalletProvider`-bound provider, valid
 * values are `solana:mainnet` and `solana:devnet`.
 */
export const NexusChatSchema = z
  .object({
    model: z
      .string()
      .describe(
        'OpenRouter-style model slug, e.g. "openai/gpt-4o-mini", "anthropic/claude-3-haiku".',
      ),
    messages: z.array(ChatMessageSchema).min(1).describe("OpenAI-shape chat messages array."),
    network: z
      .string()
      .optional()
      .describe(
        'Optional CAIP-2 settlement network override. Must match the wallet\'s chain — e.g. "solana:mainnet" or "solana:devnet". Omit to use the server default.',
      ),
  })
  .describe(
    "Pay-per-call signed inference against a VDM Nexus endpoint. " +
      "Returns the OpenAI chat completion plus a Signed Inference Receipt (SIR v2) " +
      "anchored to an on-chain USDC settlement transaction.",
  );

/**
 * Input schema for the `nexus_verify_receipt` action.
 *
 * Takes the original receipt + prompt + response and runs the five-check
 * SIR v2 verification: hash recompute (prompt + response), operator Ed25519
 * signature, on-chain settlement tx, payer identity.
 */
export const NexusVerifyReceiptSchema = z
  .object({
    receipt: z
      .unknown()
      .describe(
        "The Signed Inference Receipt (SIR v2) to verify, as returned by `nexus_chat` in the `receipt` field.",
      ),
    prompt: z
      .union([z.string(), z.array(ChatMessageSchema)])
      .describe(
        "The prompt the receipt covers. For x402 chat-completion receipts, pass the `messages` array you sent. For prepaid `/inference` receipts, pass the raw prompt string.",
      ),
    response: z
      .union([z.string(), z.unknown()])
      .describe(
        "The response the receipt covers. For x402 chat-completion receipts, pass the OpenAI response body. For prepaid receipts, pass the raw response string.",
      ),
    endpoint: z
      .string()
      .optional()
      .describe(
        "Optional Nexus base URL (e.g. https://nexus.vdmnexus.com). Used to fetch the operator public key when `operatorKey` is not supplied.",
      ),
    operatorKey: z
      .string()
      .optional()
      .describe(
        "Optional base58 Ed25519 operator public key. If omitted, fetched from the endpoint's `/api/v1/operator-key`.",
      ),
    rpc: z
      .string()
      .optional()
      .describe(
        "Optional RPC URL override for the on-chain payment check. Defaults are derived from `receipt.payment.network`.",
      ),
  })
  .describe(
    "Run the five-check SIR v2 verification: prompt_hash_ok, response_hash_ok, " +
      "nexus_signature_ok, payment_on_chain_ok, payer_matches. Returns the full " +
      "check breakdown so the agent can act on partial failures.",
  );

/**
 * Input schema for the `nexus_get_deposit_address` action.
 */
export const NexusGetDepositAddressSchema = z
  .object({
    network: z
      .string()
      .optional()
      .describe(
        'Optional CAIP-2 network override, e.g. "solana:mainnet". Omit to use the endpoint default.',
      ),
  })
  .describe(
    "Returns the USDC deposit address agents should send funds to in order to top up their prepaid credit balance on a Nexus deployment. " +
      "Per-call x402 settlement via `nexus_chat` does NOT require this — it settles inline.",
  );
