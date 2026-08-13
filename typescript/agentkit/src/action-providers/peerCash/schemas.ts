import { z } from "zod";

/**
 * Action schemas for the peerCash action provider.
 *
 * Peer Cash amounts are expressed as decimal USDC strings ("250" or "12.34",
 * at most 6 decimal places). The provider converts them to USDC base units.
 */

const usdcAmount = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "Must be a decimal USDC amount with at most 6 decimal places")
  .describe("The USDC amount in whole units, e.g. '250' or '12.34'");

const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, "Must be a three-letter uppercase ISO 4217 currency code")
  .describe("Three-letter fiat currency code, e.g. 'USD' or 'EUR'");

const depositId = z
  .string()
  .min(1)
  .describe("The deposit id of the cash-out order, as returned by the cashout action");

/**
 * Input schema for the estimate action.
 */
export const EstimateSchema = z
  .object({
    amountUsdc: usdcAmount,
    currency: currencyCode,
    includeEta: z
      .boolean()
      .optional()
      .describe("Include the historical fill-time estimate (default true)"),
  })
  .describe("Input schema for estimating a Peer Cash fiat payout");

/**
 * Input schema for the capabilities action.
 */
export const CapabilitiesSchema = z
  .object({
    includeFillStats: z
      .boolean()
      .optional()
      .describe("Include 30-day fill counts and median first-fill times per pair (default false)"),
  })
  .describe("Input schema for listing Peer Cash payout capabilities");

/**
 * Input schema for the cashout action. Exactly one of `currency` or
 * `currencies` must be provided.
 */
export const CashoutSchema = z
  .object({
    amountUsdc: usdcAmount,
    platform: z
      .string()
      .min(1)
      .describe("Payout platform id from the capabilities action, e.g. 'venmo' or 'revolut'"),
    currency: currencyCode.optional().describe("The single fiat currency to receive, e.g. 'USD'"),
    currencies: z
      .array(currencyCode)
      .min(1)
      .optional()
      .describe("Multiple fiat currencies the buyer may pay in, e.g. ['EUR', 'GBP', 'USD']"),
    payee: z
      .string()
      .min(1)
      .describe(
        "The payment handle that receives the fiat, formatted per the platform's payeeHint",
      ),
  })
  .refine(args => (args.currency === undefined) !== (args.currencies === undefined), {
    message: "Provide exactly one of currency or currencies",
  })
  .describe("Input schema for creating a Peer Cash cash-out order");

/**
 * Input schema for the order status action.
 */
export const OrderStatusSchema = z
  .object({
    depositId,
  })
  .describe("Input schema for reading the state of a Peer Cash order");

/**
 * Input schema for the list orders action.
 */
export const ListOrdersSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .optional()
      .describe("Wallet address to list orders for (defaults to the connected wallet)"),
    inFlightOnly: z
      .boolean()
      .optional()
      .describe("Only return orders that still need attention (default false)"),
  })
  .describe("Input schema for listing Peer Cash orders for a wallet");

/**
 * Input schema for the withdraw action.
 */
export const WithdrawSchema = z
  .object({
    depositId,
    amountUsdc: usdcAmount
      .optional()
      .describe("Partial USDC amount to withdraw; omit to close the order fully"),
  })
  .describe("Input schema for withdrawing USDC from a Peer Cash order");

/**
 * Input schema for the top up action.
 */
export const TopUpSchema = z
  .object({
    depositId,
    amountUsdc: usdcAmount,
  })
  .describe("Input schema for adding USDC to a live Peer Cash order");

/**
 * Input schema for the configure access policy recovery action.
 */
export const ConfigureAccessPolicySchema = z
  .object({
    depositId,
  })
  .describe("Input schema for attaching the required access policy to a restricted cash-out");
