import { z } from "zod";

/** Default slippage in basis points (300 = 3%). */
export const DEFAULT_SLIPPAGE_BPS = 300;

/** Maximum allowed slippage in basis points (1000 = 10%). */
export const MAX_SLIPPAGE_BPS = 1000;

/** Matches Bitcoin address formats: P2PKH (1...), P2SH (3...), Bech32 (bc1q...), Taproot (bc1p...). */
export const BTC_ADDRESS_REGEX =
  /^(1[1-9A-HJ-NP-Za-km-z]{25,34}|3[1-9A-HJ-NP-Za-km-z]{25,34}|bc1[qp][a-z0-9]{38,58})$/;

export const SwapToBtcSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a positive decimal number")
      .describe("Token amount in whole units (e.g., '100' for 100 USDC)"),
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address")
      .describe("ERC20 token contract address on the source chain"),
    btcAddress: z
      .string()
      .regex(BTC_ADDRESS_REGEX, "Invalid Bitcoin address")
      .describe("Bitcoin address to receive BTC"),
    maxSlippage: z
      .number()
      .min(1)
      .max(MAX_SLIPPAGE_BPS)
      .optional()
      .default(DEFAULT_SLIPPAGE_BPS)
      .describe(`Max slippage in basis points (default ${DEFAULT_SLIPPAGE_BPS} = 3%)`),
  })
  .strip()
  .describe("Swap EVM tokens to BTC via BOB Gateway");

export const GetSupportedRoutesSchema = z
  .object({})
  .strip()
  .describe("Get supported BOB Gateway swap routes");

export const GetOrdersSchema = z
  .object({
    orderId: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Order ID, Bitcoin tx ID, or EVM tx hash. Omit to fetch all orders for the connected wallet",
      ),
  })
  .strip()
  .describe("Get BOB Gateway order status");
