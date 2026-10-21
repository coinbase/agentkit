import { z } from "zod";

/**
 * Input schema for checking a token or contract before buying or swapping it.
 */
export const CheckTokenSafetySchema = z
  .object({
    address: z
      .string()
      .min(1)
      .max(100)
      .describe(
        "The token or contract to check. Base: 0x followed by 40 hex characters. Solana: the token's mint address.",
      ),
    chain: z
      .enum(["base", "solana"])
      .optional()
      .describe("The chain the token is on. Optional: worked out from the address when left out."),
  })
  .strip()
  .describe("Instructions for checking a token or contract before buying or swapping it");

const AddressBookEntrySchema = z
  .object({
    name: z.string().min(1).max(80).describe("A name the user uses for this address"),
    address: z.string().min(1).max(100).describe("The address"),
  })
  .strip();

/**
 * Input schema for checking a wallet request before signing or sending it.
 */
export const CheckTransactionSchema = z
  .object({
    request: z
      .union([z.record(z.string(), z.unknown()), z.string().min(1).max(65536)])
      .describe(
        "The wallet request exactly as you were asked to sign or send it, not a summary of it. " +
          "Examples: a transaction {type: 'transaction', to, data, value, chainId}; " +
          "EIP-712 typed data such as a permit {type: 'typed_data', typedData}; " +
          "a sign-in message {type: 'personal_sign', message}; " +
          "or a JSON-RPC call such as {method: 'eth_sendTransaction', params: [...]}.",
      ),
    intent: z
      .string()
      .min(1)
      .max(2000)
      .describe(
        "What the user asked for, in their own words. Example: 'Send exactly 25 USDC to 0x2f4e...6f81'.",
      ),
    chain: z
      .string()
      .min(1)
      .max(40)
      .optional()
      .describe("The chain the request is for, for example 'base' or 'ethereum'. Default: base."),
    site: z
      .string()
      .min(1)
      .max(300)
      .optional()
      .describe("The website that asked for the signature, if there is one."),
    addressBook: z
      .array(AddressBookEntrySchema)
      .max(200)
      .optional()
      .describe(
        "People and contracts the user knows, as {name, address}, so an address that imitates one of them is caught.",
      ),
  })
  .strip()
  .describe("Instructions for checking a wallet request before signing or sending it");

/**
 * Configuration options for the TAP Labs action provider.
 */
export interface TapLabsConfig {
  /**
   * The most one check may cost, in USDC. Default 0.03; at most 1.
   * A check that asks for more is refused before anything is signed.
   */
  maxPaymentUsdc?: number;

  /**
   * The most this provider instance may sign for in total, in USDC. Default 1; at most 100.
   * Once it is used up, every check is refused before anything is signed.
   */
  maxTotalUsdc?: number;

  /**
   * Where TAP Labs answers. Default https://labs.theatlasproject.dev.
   * Must be https, except http on localhost for local testing.
   */
  baseUrl?: string;

  /**
   * The only address a payment may go to. Default: TAP's own wallet.
   */
  payTo?: string;

  /**
   * The fetch implementation to use. Default: the global fetch.
   */
  fetch?: typeof fetch;
}
