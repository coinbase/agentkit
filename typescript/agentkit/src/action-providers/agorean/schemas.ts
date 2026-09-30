import { z } from "zod";

/**
 * The three actions' inputs. The framework adapters (LangChain, Vercel AI) turn these into the
 * tool schemas a model sees, so every `describe` says what a field is, not what to do with it.
 * The same file works with zod 3 (AgentKit 0.10 on npm, and this package) and zod 4 (AgentKit's
 * main branch), which is why it is copied as is into the upstream proposal.
 */

const NETWORKS = ["eip155:8453", "eip155:84532"] as const;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export const SearchAgoreanSchema = z
  .object({
    query: z.string().min(1).max(500).describe("What is needed, in plain words."),
    max_price_usdc: z
      .number()
      .positive()
      .optional()
      .describe("Only listings priced at or under this, in USDC."),
    network: z
      .enum(NETWORKS)
      .optional()
      .describe(
        "Only listings paid on this chain: eip155:8453 is Base (real money), eip155:84532 is Base Sepolia (practice money). Left out, both.",
      ),
    limit: z.number().int().min(1).max(20).optional().describe("How many results, 1 to 20."),
  })
  .strip()
  .describe("A search of the Agorean marketplace");

export const CheckReviewsSchema = z
  .object({
    url: z
      .string()
      .url()
      .max(2000)
      .describe("The x402 endpoint's URL, as its 402 names it (`resource.url`)."),
    pay_to: z
      .string()
      .regex(ADDRESS, "a wallet address: 0x + 40 hex")
      .optional()
      .describe(
        "The wallet the endpoint's 402 asks to be paid (`payTo`). With it, the answer's pay_to_matches says whether the reviews are about that same wallet.",
      ),
    network: z
      .enum(NETWORKS)
      .optional()
      .describe("The chain of the payment in question; the numbers are then about that chain."),
  })
  .strip()
  .describe("The reviews of one x402 endpoint");

export const ReviewPaymentSchema = z
  .object({
    url: z.string().url().max(2000).describe("The x402 endpoint that was paid."),
    tx_hash: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "a transaction hash: 0x + 64 hex")
      .optional()
      .describe(
        "The settlement's transaction hash: `paymentProof.transaction` in the output of AgentKit's x402 actions. It comes from the seller's reply, so it goes with pay_to. Without it, Agorean finds this wallet's latest unreviewed payment to that endpoint on chain.",
      ),
    stars: z.number().int().min(1).max(5).describe("1 to 5, whole numbers."),
    note: z
      .string()
      .min(1)
      .max(500)
      .describe("What happened, in a sentence or two (at most 500 characters)."),
    pay_to: z
      .string()
      .regex(ADDRESS, "a wallet address: 0x + 40 hex")
      .optional()
      .describe(
        "The wallet this wallet signed the payment to: the `payTo` of the payment option it paid (`selectedPaymentOption.payTo` for retry_http_request_with_x402, or the 402's `accepts`), not a value from the seller's paid reply. Needed with tx_hash: nothing is signed unless the chain shows that transaction paid exactly this wallet.",
      ),
    amount: z
      .string()
      .regex(/^\d+$/, "atomic units, digits only")
      .optional()
      .describe(
        "The amount paid in the asset's atomic units (the payment option's `amount`; 10000 is 0.01 USDC). Checked like pay_to, and only with it.",
      ),
  })
  .strip()
  .refine(({ tx_hash, pay_to }) => tx_hash === undefined || pay_to !== undefined, {
    message: "pay_to goes with tx_hash: the wallet this payment was signed to",
    path: ["pay_to"],
  })
  .refine(({ amount, pay_to }) => amount === undefined || pay_to !== undefined, {
    message: "amount goes with pay_to",
    path: ["amount"],
  })
  .describe("A review of one x402 payment");

export type SearchAgoreanArgs = z.infer<typeof SearchAgoreanSchema>;
export type CheckReviewsArgs = z.infer<typeof CheckReviewsSchema>;
export type ReviewPaymentArgs = z.infer<typeof ReviewPaymentSchema>;
