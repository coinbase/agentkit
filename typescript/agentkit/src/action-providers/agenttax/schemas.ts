import { z } from "zod";

/**
 * Configuration for {@link AgentTaxActionProvider}.
 */
export interface AgentTaxConfig {
  /**
   * AgentTax API key. Required for the authenticated actions
   * (`check_nexus_status`, `export_1099_da`, `remit_tax_onchain`).
   *
   * Public actions (`calculate_tax`, `get_local_rate`) work without a key.
   *
   * Get one at https://agenttax.io/dashboard or via
   * `AGENTTAX_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Override the AgentTax API base URL. Defaults to {@link DEFAULT_BASE_URL}.
   * Useful for staging or self-hosted deployments.
   */
  baseUrl?: string;

  /**
   * Default treasury wallet address used by `remit_tax_onchain` when no
   * explicit recipient is supplied by the caller.
   */
  reserveWallet?: `0x${string}`;

  /**
   * Whether to append the AgentTax Base Builder Code to onchain transactions.
   * Defaults to `true`. Disable only if you explicitly want to attribute
   * transactions to a different builder.
   */
  builderCodeEnabled?: boolean;
}

const UsStateSchema = z
  .string()
  .length(2)
  .toUpperCase()
  .describe("Two-letter US state code (e.g. 'TX', 'NY', 'CA')");

const UsZipSchema = z
  .string()
  .regex(/^\d{5}(-\d{4})?$/, "Must be a 5- or 9-digit US ZIP code")
  .describe("US ZIP code (5- or 9-digit)");

const EvmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");

/**
 * Valid `transaction_type` values accepted by the AgentTax `/api/v1/calculate`
 * endpoint. The engine derives `work_type` internally from `transaction_type`.
 */
export const TRANSACTION_TYPES = [
  "compute",
  "api_access",
  "data_purchase",
  "saas",
  "ai_labor",
  "storage",
  "digital_good",
  "consulting",
  "data_processing",
  "cloud_infrastructure",
  "ai_model_access",
  "marketplace_fee",
  "subscription",
  "license",
  "service",
] as const;

/**
 * Input schema for the `calculate_tax` action.
 *
 * Matches the current AgentTax `/api/v1/calculate` request contract:
 * `role`, `amount`, `buyer_state`, `transaction_type`, and `counterparty_id`
 * are required; `buyer_zip` and `is_b2b` are optional.
 */
export const CalculateTaxSchema = z
  .object({
    amount: z
      .number()
      .positive()
      .describe("Transaction amount in whole USD (e.g. 12.5 for $12.50)"),
    buyerState: UsStateSchema,
    buyerZip: UsZipSchema.nullable().describe(
      "Optional US ZIP code — enables zip-level local rate precision where available",
    ),
    transactionType: z
      .enum(TRANSACTION_TYPES)
      .describe(
        "Category of the transaction — drives the AgentTax taxability matrix. " +
          "Valid values: " +
          TRANSACTION_TYPES.join(", "),
      ),
    counterpartyId: z
      .string()
      .min(1)
      .describe(
        "Buyer identifier for audit trail (e.g. wallet address, agent ID). " +
          "Required by the AgentTax API.",
      ),
    isB2B: z
      .boolean()
      .nullable()
      .transform(val => val ?? false)
      .describe("Whether this is a business-to-business transaction. Defaults to false."),
  })
  .describe("Calculate applicable US sales tax for an agent transaction");

/**
 * Input schema for the `get_local_rate` action.
 */
export const GetLocalRateSchema = z
  .object({
    zip: UsZipSchema,
  })
  .describe("Look up zip-level combined (state + local) sales tax rate");

/**
 * Input schema for the `check_nexus_status` action.
 */
export const CheckNexusStatusSchema = z
  .object({
    states: z.array(UsStateSchema).min(1).describe("States to check sales tax nexus status for"),
  })
  .describe(
    "Check whether the configured entity has triggered sales tax nexus in the given states",
  );

/**
 * Input schema for the `export_1099_da` action.
 */
export const Export1099DaSchema = z
  .object({
    year: z.number().int().min(2020).max(2099).describe("Tax year (e.g. 2026)"),
  })
  .describe("Export IRS Form 1099-DA data for the configured entity for a tax year");

/**
 * Input schema for the `remit_tax_onchain` action.
 */
export const RemitTaxOnchainSchema = z
  .object({
    amountUsdc: z
      .number()
      .positive()
      .describe("Amount of USDC to remit, in whole units (e.g. 1.25 for $1.25)"),
    recipient: EvmAddressSchema.nullable().describe(
      "Recipient wallet. Defaults to the provider-configured reserveWallet if omitted.",
    ),
    jurisdiction: UsStateSchema.nullable().describe(
      "Optional two-letter state code identifying the jurisdiction this remittance covers",
    ),
    reference: z
      .string()
      .max(64)
      .nullable()
      .describe("Optional external reference (e.g. AgentTax transaction_id) for audit trail"),
  })
  .describe(
    "Remit collected sales tax as a USDC transfer on Base. " +
      "Appends the AgentTax Base Builder Code to transaction calldata for attribution.",
  );
