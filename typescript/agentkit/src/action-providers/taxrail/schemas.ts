import { z } from "zod";

/**
 * Configuration options for TaxRailActionProvider.
 */
export interface TaxRailActionProviderConfig {
  /** Base URL of the TaxRail API (defaults to https://api.taxrail.online). */
  baseUrl?: string;
  /** Optional Base wallet address (0x...) to earn 20% affiliate revenue share on paid unlocks. */
  referrerWallet?: string;
}

/**
 * Input schema for checking pre-trade crypto disposal tax impact.
 */
export const CheckTaxImpactSchema = z
  .object({
    jurisdiction: z
      .enum(["US", "BR"])
      .default("US")
      .describe("Tax jurisdiction: US (IRS 1099-DA / Form 8949) or BR (Lei 14.754 / R$35k rule)"),
    chain: z
      .enum(["base", "ethereum", "arbitrum", "solana"])
      .default("base")
      .describe("Blockchain network where the wallet holds the token"),
    targetAsset: z.string().min(1).describe("Token symbol to sell or swap (e.g., ETH, AERO, WBTC)"),
    sellQuantity: z.number().positive().describe("Quantity of targetAsset to sell or swap"),
    walletAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .describe("EVM wallet address (0x...) for automatic on-chain cost-basis lot scanning"),
  })
  .strict();

/**
 * Input schema for comparing DeFi borrow (Aave v3) vs selling appreciated collateral.
 */
export const CompareBorrowVsSellSchema = z
  .object({
    jurisdiction: z.enum(["US", "BR"]).default("US").describe("Tax jurisdiction (US or BR)"),
    chain: z
      .enum(["base", "ethereum", "arbitrum"])
      .default("base")
      .describe("Aave v3 network (base, ethereum, arbitrum)"),
    collateralAsset: z.string().min(1).describe("Collateral asset symbol (e.g., ETH, cbBTC)"),
    collateralAmount: z.number().positive().describe("Collateral token quantity"),
    collateralPriceUsd: z.number().positive().describe("Current spot price per collateral unit in USD"),
    collateralCostBasisUsd: z.number().nonnegative().describe("Average cost basis per unit in USD"),
    liquidityNeededUsd: z.number().positive().describe("USDC liquidity needed in USD"),
    holdingDays: z
      .number()
      .nonnegative()
      .default(180)
      .describe("Days collateral has already been held"),
  })
  .strict();

/**
 * Input schema for classifying a corporate crypto expense deduction.
 */
export const ClassifyExpenseSchema = z
  .object({
    jurisdiction: z.enum(["US", "BR"]).default("US").describe("Corporate tax jurisdiction"),
    regime: z
      .enum(["LLC_PASS_THROUGH", "C_CORP", "PJ_LUCRO_REAL", "PJ_SIMPLES_EXPORT"])
      .default("C_CORP")
      .describe("Business entity tax regime"),
    vendorName: z.string().min(1).describe("Vendor or merchant name (e.g., OpenAI, AWS, Vercel)"),
    description: z.string().min(1).describe("Expense description (e.g., Cloud GPU & LLM API compute)"),
    amountUsd: z.number().positive().describe("Invoice amount in USD"),
  })
  .strict();

/**
 * Input schema for inspecting x402 pre-trade swap guardrail or Brazil R$35k exemption status.
 */
export const Br35kStatusSchema = z
  .object({
    monthlySalesBrl: z
      .number()
      .nonnegative()
      .default(0)
      .describe("Cumulative crypto sales already executed this calendar month in BRL"),
    plannedSaleUsd: z.number().nonnegative().describe("Planned next crypto sale value in USD"),
    custodyLocation: z
      .enum(["DOMESTIC", "OFFSHORE"])
      .default("DOMESTIC")
      .describe("Brazil licensed exchange (DOMESTIC) vs DEX / offshore CEX (OFFSHORE)"),
    paymentSignature: z
      .string()
      .nullable()
      .describe("Optional x402 PAYMENT-SIGNATURE header if already signed ($0.005 USDC on Base)"),
  })
  .strict();
