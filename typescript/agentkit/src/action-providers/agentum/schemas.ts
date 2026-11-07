import { z } from "zod";

/**
 * Configuration options for the AgentumActionProvider.
 */
export interface AgentumActionProviderConfig {
  /**
   * Agentum server base URL. Defaults to https://agentum.asimplek.cloud.
   */
  baseUrl?: string;

  /**
   * Highest price in USD the agent may pay for a single call. A call whose x402 price is higher
   * is refused before anything is signed. Defaults to 0.03 (batch_resolve costs 0.025).
   */
  maxPriceUsd?: number;

  /**
   * Per-request timeout in milliseconds, covering the paid retry as well. Defaults to 30000.
   */
  timeoutMs?: number;

  /**
   * Identifier sent as X-Agent-Id so the server can meter the free tier (5 calls/day).
   */
  agentId?: string;
}

/**
 * Input schema for resolving a single company to its official registry record.
 */
export const ResolveEntitySchema = z
  .object({
    query: z
      .string()
      .min(1)
      .describe(
        "Company name, domain, or registration number (LEI, CIK, EIN, UK company number, Swiss UID, ABN/ACN, UEN, Lithuanian JAR, EU VAT number).",
      ),
    jurisdiction: z
      .string()
      .optional()
      .describe(
        "Optional 2-letter ISO 3166-1 alpha-2 country code (e.g. 'GB', 'CH', 'AU', 'SG', 'US', 'LT', 'DE'). Auto-detected if omitted.",
      ),
    verifyVat: z
      .boolean()
      .optional()
      .describe("Set true to also validate the associated EU VAT number against live VIES."),
    checkSanctions: z
      .boolean()
      .optional()
      .describe("Set true to also screen the resolved entity against the sanctions lists."),
  })
  .strip();

/**
 * Input schema for validating an EU VAT number against VIES.
 */
export const VerifyVatSchema = z
  .object({
    vatNumber: z
      .string()
      .min(4)
      .describe(
        "EU VAT number including the 2-letter country prefix (e.g. 'DE129274202', 'LT100004278519').",
      ),
  })
  .strip();

/**
 * Input schema for sanctions screening of a company or person.
 */
export const ScreenSanctionsSchema = z
  .object({
    name: z.string().min(1).describe("Company or individual name to screen."),
    country: z.string().optional().describe("Optional 2-letter ISO country code."),
    registrationNumber: z
      .string()
      .optional()
      .describe("Optional company registration number, LEI or tax ID."),
    threshold: z
      .number()
      .min(0.1)
      .max(1)
      .optional()
      .describe("Fuzzy similarity threshold between 0.1 and 1.0 (default 0.75)."),
  })
  .strip();

/**
 * Input schema for a one-call vendor KYB check.
 */
export const CheckVendorSchema = z
  .object({
    name: z.string().min(1).describe("Legal or trade name of the vendor or counterparty."),
    country: z
      .string()
      .optional()
      .describe("Optional 2-letter ISO country code (e.g. 'DE', 'GB', 'US', 'CH')."),
    vatNumber: z
      .string()
      .optional()
      .describe("Optional EU VAT number with country prefix (e.g. 'DE129274202')."),
    registrationNumber: z
      .string()
      .optional()
      .describe("Optional national registration number, LEI or tax ID."),
    domain: z.string().optional().describe("Optional primary corporate web domain."),
  })
  .strip();

/**
 * Input schema for IBAN and payee-country verification.
 */
export const VerifyBankPayeeSchema = z
  .object({
    iban: z
      .string()
      .min(10)
      .describe("International Bank Account Number (IBAN); spaces are permitted."),
    expectedCountry: z
      .string()
      .optional()
      .describe("Expected 2-letter ISO country code of the payee (e.g. 'DE')."),
    payeeName: z.string().optional().describe("Optional legal payee name."),
    payeeTaxId: z
      .string()
      .optional()
      .describe("Optional payee tax ID, used for an ownership lookup in public registers."),
  })
  .strip();

/**
 * Input schema for resolving up to 25 companies in one call.
 */
export const BatchResolveSchema = z
  .object({
    items: z
      .array(
        z.object({
          query: z.string().min(1).describe("Company name, domain, or registration number."),
          country: z.string().optional().describe("Optional 2-letter ISO country code."),
        }),
      )
      .min(1)
      .max(25)
      .describe("Companies to resolve (1 to 25 items)."),
  })
  .strip();

/**
 * Input schema for screening a crypto wallet address against OFAC's listed addresses.
 */
export const ScreenAddressSchema = z
  .object({
    address: z
      .string()
      .min(1)
      .max(128)
      .describe("Wallet address to screen (EVM 0x..., Bitcoin, Tron, Solana, Litecoin)."),
    chain: z
      .enum(["evm", "bitcoin", "tron", "solana", "litecoin", "other"])
      .optional()
      .describe(
        "Optional chain hint. Rejected by the server if it contradicts the address format.",
      ),
  })
  .strip();
